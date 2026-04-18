// GET /api/notifications/preferences — fetch (or auto-create) user preferences
// PATCH /api/notifications/preferences — update one or more preference fields
// Both routes require an authenticated session.

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// GET — retrieve preferences, creating defaults if none exist yet
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let preferences = await prisma.notificationPreference.findUnique({
    where: { userId: session.user.id },
  })

  // Auto-create with all defaults on first access
  if (!preferences) {
    preferences = await prisma.notificationPreference.create({
      data: { userId: session.user.id },
    })
  }

  return NextResponse.json({ success: true, data: preferences })
}

// ---------------------------------------------------------------------------
// PATCH — partial update of preference fields
// Accepted boolean fields match the NotificationPreference model:
// emailOrders, emailDelivery, emailPayment, emailTickets, emailLoyalty,
// smsOrders, smsDelivery, smsPayment
// ---------------------------------------------------------------------------

export async function PATCH(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as Record<string, boolean>

  // Allowlist only recognised boolean preference keys
  const allowed = [
    'emailOrders',
    'emailDelivery',
    'emailPayment',
    'emailTickets',
    'emailLoyalty',
    'smsOrders',
    'smsDelivery',
    'smsPayment',
  ]

  const updates: Record<string, boolean> = {}
  for (const key of allowed) {
    if (key in body && typeof body[key] === 'boolean') {
      updates[key] = body[key]
    }
  }

  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    update: updates,
    create: { userId: session.user.id, ...updates },
  })

  return NextResponse.json({ success: true, data: preferences })
}
