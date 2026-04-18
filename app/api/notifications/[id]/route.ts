// PATCH /api/notifications/[id] — mark a notification as read or unread
// DELETE /api/notifications/[id] — delete a notification
// Both routes verify the notification belongs to the authenticated user.

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// PATCH — mark read / unread
// ---------------------------------------------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify ownership before updating
  const existing = await prisma.notification.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json() as { read?: boolean }
  const read = Boolean(body.read)

  const notification = await prisma.notification.update({
    where: { id },
    data: {
      read,
      readAt: read ? new Date() : null,
    },
  })

  return NextResponse.json({ success: true, data: notification })
}

// ---------------------------------------------------------------------------
// DELETE — remove notification
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify ownership before deleting
  const existing = await prisma.notification.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.notification.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
