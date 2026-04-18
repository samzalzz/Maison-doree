import { prisma } from '@/lib/db/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const contactSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').max(100),
  email: z.string().email('Adresse email invalide'),
  subject: z.string().min(3, 'Le sujet doit contenir au moins 3 caractères').max(200),
  message: z
    .string()
    .min(10, 'Le message doit contenir au moins 10 caractères')
    .max(5000),
})

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide' },
      { status: 400 },
    )
  }

  const parsed = contactSchema.safeParse(body)

  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return NextResponse.json(
      { error: firstError?.message ?? 'Données invalides' },
      { status: 422 },
    )
  }

  const { name, email, subject, message } = parsed.data

  const submission = await prisma.contactSubmission.create({
    data: {
      name,
      email,
      subject,
      message,
      status: 'NEW',
    },
  })

  return NextResponse.json(
    {
      success: true,
      data: { id: submission.id },
    },
    { status: 201 },
  )
}
