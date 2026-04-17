import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { UserProfileSchema } from '@/lib/validators'
import { withAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// GET /api/users  (authenticated user)
// ---------------------------------------------------------------------------
// Returns the current user's profile information.
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req, { token }) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: token.id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            address: true,
            city: true,
            zipCode: true,
            profilePhoto: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found.',
          },
        },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error('[GET /api/users] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve user profile.',
        },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// PUT /api/users  (authenticated user)
// ---------------------------------------------------------------------------
// Body: UserProfileSchema (partial)
// Updates the current user's profile information.
// Creates a UserProfile record if it doesn't exist.
// ---------------------------------------------------------------------------

export const PUT = withAuth(async (req, { token }) => {
  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Request body must be valid JSON.',
          },
        },
        { status: 400 },
      )
    }

    // Validate with partial schema (all fields optional)
    const result = UserProfileSchema.partial().safeParse(body)

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

    const updateData = result.data

    // Check if profile exists
    const existingProfile = await prisma.userProfile.findUnique({
      where: { userId: token.id },
    })

    let profile

    if (existingProfile) {
      // Update existing profile
      profile = await prisma.userProfile.update({
        where: { userId: token.id },
        data: updateData,
      })
    } else {
      // Create new profile
      profile = await prisma.userProfile.create({
        data: {
          userId: token.id,
          ...updateData,
        },
      })
    }

    // Fetch full user with profile
    const user = await prisma.user.findUnique({
      where: { id: token.id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            address: true,
            city: true,
            zipCode: true,
            profilePhoto: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error('[PUT /api/users] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update user profile.',
        },
      },
      { status: 500 },
    )
  }
})
