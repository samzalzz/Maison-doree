import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

type RouteContext = { params?: Record<string, string | string[]> }

const UpdateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  contactPerson: z.string().optional(),
  paymentTermsDays: z.number().int().min(0).optional(),
  creditLimit: z.number().nonnegative().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  notes: z.string().optional(),
})

function notFound(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found.' } },
    { status: 404 },
  )
}

// ---------------------------------------------------------------------------
// GET /api/admin/customers/[id]
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest, { params }: RouteContext) => {
  const id = params?.id as string | undefined
  if (!id) return notFound()

  try {
    const customer = await prisma.customer.findUnique({ where: { id } })
    if (!customer) return notFound()
    return NextResponse.json({ success: true, data: customer })
  } catch (err) {
    console.error('[customers/[id]] GET error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve customer.' } },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// PUT /api/admin/customers/[id]
// ---------------------------------------------------------------------------

export const PUT = withAdminAuth(async (req: NextRequest, { params }: RouteContext) => {
  const id = params?.id as string | undefined
  if (!id) return notFound()

  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON.' } },
        { status: 400 },
      )
    }

    const input = UpdateCustomerSchema.parse(body)

    const customer = await prisma.customer.update({
      where: { id },
      data: input,
    })

    return NextResponse.json({ success: true, data: customer })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', details: err.errors } },
        { status: 422 },
      )
    }
    if ((err as { code?: string }).code === 'P2025') return notFound()
    console.error('[customers/[id]] PUT error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update customer.' } },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/customers/[id]
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(async (req: NextRequest, { params }: RouteContext) => {
  const id = params?.id as string | undefined
  if (!id) return notFound()

  try {
    const customer = await prisma.customer.delete({ where: { id } })
    return NextResponse.json({ success: true, data: customer })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') return notFound()
    console.error('[customers/[id]] DELETE error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete customer.' } },
      { status: 500 },
    )
  }
})
