/**
 * GET /api/admin/users
 *
 * Admin-only endpoint to search and list users for dropdowns/selectors.
 *
 * Query params:
 *   search  – case-insensitive match on email, firstName, or lastName
 *   role    – filter by Role enum value (CUSTOMER | ADMIN | DRIVER)
 *   cursor  – base64url-encoded user id for cursor pagination
 *   limit   – page size (default 20, max 100)
 */

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)

    const search = searchParams.get('search')?.trim() ?? ''
    const rawRole = searchParams.get('role')
    const rawCursor = searchParams.get('cursor')
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))

    const validRoles = ['CUSTOMER', 'ADMIN', 'DRIVER'] as const
    type RoleValue = (typeof validRoles)[number]
    const role: RoleValue | undefined =
      rawRole && validRoles.includes(rawRole as RoleValue)
        ? (rawRole as RoleValue)
        : undefined

    const where: Prisma.UserWhereInput = {}

    if (role) {
      where.role = role
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { firstName: { contains: search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: search, mode: 'insensitive' } } },
      ]
    }

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

    const users = await prisma.user.findMany({
      where,
      take: limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    })

    const hasNextPage = users.length > limit
    const page = hasNextPage ? users.slice(0, limit) : users
    const lastItem = page[page.length - 1]
    const nextCursor =
      hasNextPage && lastItem ? Buffer.from(lastItem.id).toString('base64url') : null

    return NextResponse.json({
      success: true,
      data: page,
      pagination: { limit, nextCursor, hasNextPage },
    })
  } catch (error) {
    console.error('[GET /api/admin/users] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list users.' } },
      { status: 500 },
    )
  }
})
