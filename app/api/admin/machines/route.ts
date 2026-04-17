import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { CreateMachineSchema } from '@/lib/validators-production'

// ---------------------------------------------------------------------------
// POST /api/admin/machines  (admin only)
// ---------------------------------------------------------------------------
// Creates a new machine and associates it with the given lab.
// Body: CreateMachineInput — labId, name, type, batchCapacity, cycleTimeMinutes,
//       available (optional, defaults to true)
// Returns 201 with the created machine record.
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req: NextRequest) => {
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

    const result = CreateMachineSchema.safeParse(body)

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

    const { labId, ...machineData } = result.data

    // Verify the referenced lab actually exists before creating the machine.
    const lab = await prisma.productionLab.findUnique({ where: { id: labId } })

    if (!lab) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LAB_NOT_FOUND',
            message: `Lab '${labId}' was not found. Cannot assign machine to a non-existent lab.`,
          },
        },
        { status: 404 },
      )
    }

    const machine = await prisma.machine.create({
      data: {
        labId,
        ...machineData,
      },
    })

    return NextResponse.json({ success: true, data: machine }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/admin/machines] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create machine.' },
      },
      { status: 500 },
    )
  }
})
