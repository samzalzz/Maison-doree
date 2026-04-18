/**
 * GET /api/admin/production/forecast-ml
 *   Returns ML-style demand forecasts per recipe.
 *   Currently delegates to rolling-average algorithm (Phase 2).
 *   When a real ML service is available, update lib/ml-forecaster.ts.
 *
 * Query params:
 *   days     – number of days to forecast (1–30, default 7)
 *   recipeId – optional: filter to a single recipe
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { mlForecast } from '@/lib/ml-forecaster'
import type { MlForecastResponse } from '@/lib/types-production'

const DEFAULT_DAYS = 7
const MAX_DAYS = 30

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)

    // ------------------------------------------------------------------
    // 1. Parse & validate query parameters
    // ------------------------------------------------------------------
    const daysRaw = parseInt(searchParams.get('days') ?? String(DEFAULT_DAYS), 10)
    const days = Number.isNaN(daysRaw) || daysRaw < 1
      ? DEFAULT_DAYS
      : Math.min(daysRaw, MAX_DAYS)

    const recipeIdFilter = searchParams.get('recipeId') ?? undefined

    // ------------------------------------------------------------------
    // 2. Determine which recipes to forecast
    // ------------------------------------------------------------------
    let recipes: Array<{ id: string; name: string }>

    if (recipeIdFilter) {
      const recipe = await prisma.recipe.findUnique({
        where: { id: recipeIdFilter },
        select: { id: true, name: true },
      })
      if (!recipe) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Recipe not found.' } },
          { status: 404 },
        )
      }
      recipes = [recipe]
    } else {
      recipes = await prisma.recipe.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    }

    // ------------------------------------------------------------------
    // 3. Run forecast for each recipe
    // ------------------------------------------------------------------
    const results: MlForecastResponse[] = await Promise.all(
      recipes.map(async (recipe) => {
        const forecast = await mlForecast(recipe.id, days)
        return {
          recipeId: recipe.id,
          recipe: { id: recipe.id, name: recipe.name },
          predictions: forecast.predictions,
          confidence: forecast.confidence,
          model: forecast.model,
        }
      }),
    )

    return NextResponse.json({
      success: true,
      data: results,
      meta: {
        days,
        model: 'rolling_average_v1',
        note: 'Forecasts are currently produced by a rolling-average algorithm. Connect an ML service via lib/ml-forecaster.ts to upgrade.',
      },
    })
  } catch (err) {
    console.error('[forecast-ml] Unexpected error:', err)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while generating ML forecasts.',
        },
      },
      { status: 500 },
    )
  }
})
