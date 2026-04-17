/**
 * POST /api/admin/production/transfer-suggestions/[id]/execute
 *   Execute a pending transfer suggestion.
 *   Creates an actual inter-lab stock transfer via the workflow TRANSFER_STOCK
 *   action config, deducting from the source lab and crediting the dest lab.
 *   Marks the suggestion as "executed".
 *
 * POST /api/admin/production/transfer-suggestions/[id]/dismiss
 *   Mark a suggestion as "dismissed" without acting on it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { DismissTransferSuggestionSchema } from '@/lib/validators-production'
import type { AuthToken } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function notFound(message: string): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message } },
    { status: 404 },
  )
}

function conflict(message: string): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'CONFLICT', message } },
    { status: 409 },
  )
}

// ---------------------------------------------------------------------------
// Shared suggestion loader
// ---------------------------------------------------------------------------

async function loadSuggestion(id: string) {
  return prisma.transferSuggestion.findUnique({
    where: { id },
    include: {
      sourceLab: { select: { id: true, name: true } },
      destLab: { select: { id: true, name: true } },
      material: { select: { id: true, name: true, unit: true } },
    },
  })
}

// ---------------------------------------------------------------------------
// POST /api/admin/production/transfer-suggestions/[id]/execute
// ---------------------------------------------------------------------------

async function executeHandler(
  req: NextRequest,
  { params, token }: { params?: Record<string, string | string[]>; token: AuthToken },
): Promise<NextResponse> {
  const id = params?.id as string | undefined
  if (!id) return notFound('Suggestion ID is required.')

  // Check the action segment in the URL — must end with /execute
  const url = new URL(req.url)
  const action = url.pathname.split('/').at(-1)

  if (action !== 'execute' && action !== 'dismiss') {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Unknown action.' } },
      { status: 404 },
    )
  }

  try {
    const suggestion = await loadSuggestion(id)
    if (!suggestion) return notFound('Transfer suggestion not found.')

    if (suggestion.status !== 'pending') {
      return conflict(
        `Suggestion is already "${suggestion.status}" and cannot be ${action}d.`,
      )
    }

    if (action === 'dismiss') {
      // Parse optional body
      let body: Record<string, unknown> = {}
      try {
        body = await req.json()
      } catch {
        // empty body is fine
      }
      DismissTransferSuggestionSchema.parse(body)

      const updated = await prisma.transferSuggestion.update({
        where: { id },
        data: { status: 'dismissed' },
      })

      return NextResponse.json({ success: true, data: updated })
    }

    // action === 'execute'
    // -------------------------------------------------------------------------
    // Transfer stock: deduct from source lab, add to dest lab, in a transaction
    // -------------------------------------------------------------------------
    const sourceQty = await prisma.labStock.findUnique({
      where: { labId_materialId: { labId: suggestion.sourceLabId, materialId: suggestion.materialId } },
      select: { quantity: true },
    })

    if (!sourceQty) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: 'Source lab has no stock record for this material.',
          },
        },
        { status: 422 },
      )
    }

    const suggestedNum = Number(suggestion.suggestedQuantity)
    const sourceNum = Number(sourceQty.quantity)

    if (sourceNum < suggestedNum) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: `Source lab only has ${sourceNum} ${suggestion.material.unit} available, but ${suggestedNum} are needed.`,
          },
        },
        { status: 422 },
      )
    }

    const now = new Date()

    await prisma.$transaction([
      // Deduct from source
      prisma.labStock.update({
        where: { labId_materialId: { labId: suggestion.sourceLabId, materialId: suggestion.materialId } },
        data: { quantity: { decrement: suggestion.suggestedQuantity } },
      }),

      // Credit destination (upsert in case dest has no existing stock record)
      prisma.labStock.upsert({
        where: { labId_materialId: { labId: suggestion.destLabId, materialId: suggestion.materialId } },
        create: {
          labId: suggestion.destLabId,
          materialId: suggestion.materialId,
          quantity: suggestion.suggestedQuantity,
          minThreshold: 0,
        },
        update: { quantity: { increment: suggestion.suggestedQuantity } },
      }),

      // Mark suggestion executed
      prisma.transferSuggestion.update({
        where: { id },
        data: { status: 'executed', executedAt: now },
      }),
    ])

    const updated = await loadSuggestion(id)
    return NextResponse.json({ success: true, data: updated }, { status: 200 })
  } catch (err) {
    console.error('[transfer-suggestions] execute/dismiss error:', err)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while processing the suggestion.',
        },
      },
      { status: 500 },
    )
  }
}

export const POST = withAdminAuth(executeHandler)
