import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { CreateBatchSchema } from '@/lib/validators-production'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a human-readable, unique batch number.
 * Format: BATCH-YYYY-MM-DD-XXXX  (XXXX = zero-padded daily sequence count)
 * The count query runs inside the transaction to prevent race conditions.
 */
async function generateBatchNumber(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')

  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  const todayCount = await tx.productionBatch.count({
    where: { createdAt: { gte: startOfDay, lt: endOfDay } },
  })

  const seq = String(todayCount + 1).padStart(4, '0')
  return `BATCH-${yyyy}-${mm}-${dd}-${seq}`
}

// ---------------------------------------------------------------------------
// POST /api/admin/production/batches  (admin only)
// ---------------------------------------------------------------------------
// Creates a new production batch with full pre-flight validation:
//
//  1. Schema validation (Zod)           — dates, positive integers, CUIDs
//  2. Lab existence check               — lab must exist
//  3. Recipe existence + ingredients    — recipe must exist and have ingredients
//  4. Material stock check              — each ingredient must be sufficiently
//                                         stocked at the target lab
//  5. Lab capacity check                — active (PLANNED/IN_PROGRESS) batches
//                                         must be < lab.capacity
//  6. Machine ownership check           — if machineId given, must belong to lab
//  7. Employee ownership check          — if employeeId given, must belong to lab
//
// If all checks pass:
//  - BEGIN TRANSACTION
//  - Create ProductionBatch (status = PLANNED)
//  - DECREMENT each LabStock by (ingredient.quantity × batchQuantity)
//  - COMMIT
//
// Returns 201 with the full batch record, or 400/404/409 with a
// BatchValidationError describing exactly what went wrong.
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req: NextRequest, { token }) => {
  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON.' },
        },
        { status: 400 },
      )
    }

    // -----------------------------------------------------------------------
    // Step 1 — Zod schema validation
    // -----------------------------------------------------------------------
    const result = CreateBatchSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed.',
            details: result.error.flatten(),
          },
        },
        { status: 422 },
      )
    }

    const {
      labId,
      recipeId,
      quantity: batchQuantity,
      plannedStartTime,
      estimatedCompletionTime,
      machineId,
      employeeId,
    } = result.data

    // -----------------------------------------------------------------------
    // Step 2 — Lab existence check
    // -----------------------------------------------------------------------
    const lab = await prisma.productionLab.findUnique({ where: { id: labId } })

    if (!lab) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LAB_NOT_FOUND',
            message: `Lab '${labId}' was not found.`,
          },
        },
        { status: 404 },
      )
    }

    // -----------------------------------------------------------------------
    // Step 3 — Recipe existence + ingredient fetch
    // -----------------------------------------------------------------------
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ingredients: {
          select: {
            id: true,
            rawMaterialId: true,
            intermediateProductId: true,
            quantity: true,
            unit: true,
          },
        },
      },
    })

    if (!recipe) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RECIPE_NOT_FOUND',
            message: `Recipe '${recipeId}' was not found.`,
          },
        },
        { status: 404 },
      )
    }

    if (recipe.ingredients.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_RECIPE',
            message: `Recipe '${recipe.name}' has no ingredients and cannot be used to create a batch.`,
          },
        },
        { status: 422 },
      )
    }

    // -----------------------------------------------------------------------
    // Step 4 — Material stock check at the target lab
    // Every ingredient must have enough quantity available in the lab stock.
    // We collect all shortages before returning so the caller can see the
    // complete picture in one response rather than one error at a time.
    // -----------------------------------------------------------------------
    const ingredientMaterialIds = recipe.ingredients.map(
      (ing) => (ing.rawMaterialId ?? ing.intermediateProductId) as string,
    )

    const labStocks = await prisma.labStock.findMany({
      where: {
        labId,
        materialId: { in: ingredientMaterialIds },
      },
    })

    // Build an O(1) lookup map: materialId -> LabStock
    const stockMap = new Map(labStocks.map((s) => [s.materialId, s]))

    const shortages: Array<{ materialId: string; required: number; available: number }> = []

    for (const ingredient of recipe.ingredients) {
      const materialId = (ingredient.rawMaterialId ?? ingredient.intermediateProductId) as string
      const required = ingredient.quantity.toNumber() * batchQuantity

      const stock = stockMap.get(materialId)
      const available = stock ? stock.quantity.toNumber() : 0

      if (available < required) {
        shortages.push({ materialId, required, available })
      }
    }

    if (shortages.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_MATERIALS',
            message: `Insufficient materials in lab '${lab.name}' to fulfill this batch.`,
            details: { shortages },
          },
        },
        { status: 409 },
      )
    }

    // -----------------------------------------------------------------------
    // Step 5 — Lab capacity check
    // Count active (PLANNED / IN_PROGRESS) batches and compare to lab.capacity.
    // -----------------------------------------------------------------------
    const activeBatchCount = await prisma.productionBatch.count({
      where: {
        labId,
        status: { in: ['PLANNED', 'IN_PROGRESS'] },
      },
    })

    if (activeBatchCount >= lab.capacity) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_CAPACITY',
            message: `Lab '${lab.name}' is at full capacity (${lab.capacity} concurrent batches). Wait for an active batch to complete before scheduling a new one.`,
            details: { activeBatchCount, maxCapacity: lab.capacity },
          },
        },
        { status: 409 },
      )
    }

    // -----------------------------------------------------------------------
    // Step 6 — Machine ownership check (optional field)
    // -----------------------------------------------------------------------
    if (machineId) {
      const machine = await prisma.machine.findUnique({ where: { id: machineId } })

      if (!machine) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'MACHINE_NOT_FOUND',
              message: `Machine '${machineId}' was not found.`,
            },
          },
          { status: 404 },
        )
      }

      if (machine.labId !== labId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'MACHINE_NOT_IN_LAB',
              message: `Machine '${machineId}' does not belong to lab '${labId}'.`,
            },
          },
          { status: 422 },
        )
      }

      if (!machine.available) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'MACHINE_UNAVAILABLE',
              message: `Machine '${machine.name}' is currently marked as unavailable.`,
              details: { suggestions: ['Choose a different machine or wait until it becomes available.'] },
            },
          },
          { status: 409 },
        )
      }
    }

    // -----------------------------------------------------------------------
    // Step 7 — Employee ownership check (optional field)
    // -----------------------------------------------------------------------
    if (employeeId) {
      const employee = await prisma.labEmployee.findUnique({ where: { id: employeeId } })

      if (!employee) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'EMPLOYEE_NOT_FOUND',
              message: `Employee '${employeeId}' was not found.`,
            },
          },
          { status: 404 },
        )
      }

      if (employee.labId !== labId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'EMPLOYEE_NOT_IN_LAB',
              message: `Employee '${employee.name}' is not assigned to lab '${labId}'.`,
            },
          },
          { status: 422 },
        )
      }
    }

    // -----------------------------------------------------------------------
    // Step 8 — Atomic transaction: create batch + decrement stock
    // Both operations succeed together or neither is persisted.
    // -----------------------------------------------------------------------
    const batch = await prisma.$transaction(async (tx) => {
      const batchNumber = await generateBatchNumber(tx)

      // Create the ProductionBatch with an initial PLANNED status.
      const created = await tx.productionBatch.create({
        data: {
          batchNumber,
          labId,
          recipeId,
          quantity: batchQuantity,
          status: 'PLANNED',
          plannedStartTime: new Date(plannedStartTime),
          estimatedCompletionTime: new Date(estimatedCompletionTime),
          machineId: machineId ?? null,
          employeeId: employeeId ?? null,
          createdBy: token.id,
        },
        include: {
          lab: { select: { id: true, name: true, type: true } },
          recipe: { select: { id: true, name: true, laborMinutes: true } },
          machine: { select: { id: true, name: true, type: true } },
          employee: { select: { id: true, name: true, role: true } },
        },
      })

      // Decrement each ingredient's stock in the target lab.
      // We run these in parallel inside the transaction for efficiency.
      await Promise.all(
        recipe.ingredients.map((ingredient) => {
          const materialId = (ingredient.rawMaterialId ?? ingredient.intermediateProductId) as string
          const decrementBy = ingredient.quantity.toNumber() * batchQuantity

          return tx.labStock.updateMany({
            where: { labId, materialId },
            data: {
              // Prisma decrement operation is atomic and safe under concurrency.
              quantity: { decrement: new Prisma.Decimal(decrementBy) },
            },
          })
        }),
      )

      return created
    })

    return NextResponse.json({ success: true, data: batch }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/admin/production/batches] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create production batch.' },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// GET /api/admin/production/batches  (admin only)
// ---------------------------------------------------------------------------
// Returns a paginated list of production batches.
// Supports optional filters:
//   labId   – filter by production lab
//   status  – filter by ProductionStatus enum value
//   from    – ISO date string, lower bound on plannedStartTime
//   to      – ISO date string, upper bound on plannedStartTime
//   skip    – pagination offset (default 0)
//   take    – page size (default 20, max 100)
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)

    const skip = Math.max(0, parseInt(searchParams.get('skip') ?? '0', 10) || 0)
    const take = Math.min(100, Math.max(1, parseInt(searchParams.get('take') ?? '20', 10) || 20))

    const labId = searchParams.get('labId') ?? undefined

    const validStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'CANCELLED'] as const
    type BatchStatus = (typeof validStatuses)[number]
    const rawStatus = searchParams.get('status')
    const status: BatchStatus | undefined =
      rawStatus && validStatuses.includes(rawStatus as BatchStatus)
        ? (rawStatus as BatchStatus)
        : undefined

    // Parse optional date-range filters
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const fromDate = fromParam && !isNaN(Date.parse(fromParam)) ? new Date(fromParam) : undefined
    const toDate = toParam && !isNaN(Date.parse(toParam)) ? new Date(toParam) : undefined

    const where: Prisma.ProductionBatchWhereInput = {}
    if (labId) where.labId = labId
    if (status) where.status = status
    if (fromDate || toDate) {
      where.plannedStartTime = {}
      if (fromDate) where.plannedStartTime.gte = fromDate
      if (toDate) where.plannedStartTime.lte = toDate
    }

    const [batches, total] = await Promise.all([
      prisma.productionBatch.findMany({
        where,
        skip,
        take,
        orderBy: { plannedStartTime: 'asc' },
        include: {
          lab: { select: { id: true, name: true, type: true } },
          recipe: { select: { id: true, name: true, laborMinutes: true } },
          machine: { select: { id: true, name: true } },
          employee: { select: { id: true, name: true, role: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.productionBatch.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: batches,
      pagination: { skip, take, total, hasMore: skip + take < total },
    })
  } catch (error) {
    console.error('[GET /api/admin/production/batches] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve production batches.' },
      },
      { status: 500 },
    )
  }
})
