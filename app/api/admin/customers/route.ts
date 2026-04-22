import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

const CreateCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  contactPerson: z.string().optional(),
  paymentTermsDays: z.number().int().min(0).default(30),
  creditLimit: z.number().nonnegative().default(0),
  status: z.enum(['active', 'inactive']).default('active'),
  notes: z.string().optional(),
})

// ---------------------------------------------------------------------------
// GET /api/admin/customers
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? undefined
    const skipRaw = parseInt(searchParams.get('skip') ?? '0', 10)
    const takeRaw = parseInt(searchParams.get('take') ?? '20', 10)

    const skip = Number.isNaN(skipRaw) || skipRaw < 0 ? 0 : skipRaw
    const take = Number.isNaN(takeRaw) || takeRaw < 1 ? 20 : Math.min(takeRaw, 100)

    const where = status ? { status } : {}

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: customers,
      pagination: { skip, take, total, hasMore: skip + take < total },
    })
  } catch (err) {
    console.error('[customers] GET error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve customers.' } },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// POST /api/admin/customers
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON.' } },
        { status: 400 },
      )
    }

    const input = CreateCustomerSchema.parse(body)

    const customer = await prisma.customer.create({
      data: input,
    })

    return NextResponse.json({ success: true, data: customer }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', details: error.errors } },
        { status: 422 },
      )
    }
    console.error('[customers] POST error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create customer.' } },
      { status: 500 },
    )
  }
})
