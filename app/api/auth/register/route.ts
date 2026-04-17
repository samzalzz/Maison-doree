import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import { RegisterSchema } from '@/lib/validators'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate request body against RegisterSchema
    const result = RegisterSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 },
      )
    }

    const { email, password, firstName, lastName, phone } = result.data

    // Normalise email before any DB interaction
    const normalizedEmail = email.toLowerCase().trim()

    // Check if an account already exists for this email
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 },
      )
    }

    // Hash password with bcrypt (cost factor 12)
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user, profile, and loyalty card in a single Prisma transaction
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: 'CUSTOMER',
        profile: {
          create: {
            firstName: firstName ?? null,
            lastName: lastName ?? null,
            phone: phone ?? null,
          },
        },
        loyaltyCard: {
          create: {},
        },
      },
      include: {
        profile: true,
        loyaltyCard: true,
      },
    })

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: user.profile
            ? {
                firstName: user.profile.firstName,
                lastName: user.profile.lastName,
              }
            : null,
          loyaltyCard: user.loyaltyCard
            ? {
                id: user.loyaltyCard.id,
                tier: user.loyaltyCard.tier,
                points: user.loyaltyCard.points,
              }
            : null,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[POST /api/auth/register] Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
