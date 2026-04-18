// GET /api/notifications — list the current user's notifications (newest first)
// Requires an authenticated session; returns 401 otherwise.
//
// Query params:
//   cursor  – opaque pagination cursor (base64-encoded id); absent = first page
//   limit   – page size (default 50, max 100)

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const rawCursor = searchParams.get('cursor')
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50),
  )

  let cursorId: string | undefined
  if (rawCursor) {
    try {
      cursorId = Buffer.from(rawCursor, 'base64url').toString('utf8')
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid cursor.' } },
        { status: 400 },
      )
    }
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  })

  const hasNextPage = notifications.length > limit
  const page = hasNextPage ? notifications.slice(0, limit) : notifications
  const lastItem = page[page.length - 1]
  const nextCursor =
    hasNextPage && lastItem
      ? Buffer.from(lastItem.id).toString('base64url')
      : null

  return NextResponse.json({
    success: true,
    data: page,
    nextCursor,
    pagination: {
      limit,
      nextCursor,
      hasNextPage,
    },
  })
}
