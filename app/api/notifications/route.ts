// GET /api/notifications — list the current user's notifications (newest first)
// Requires an authenticated session; returns 401 otherwise.

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({
    success: true,
    data: notifications,
  })
}
