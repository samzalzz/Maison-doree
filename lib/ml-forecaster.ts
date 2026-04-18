/**
 * ML Forecaster — stub for future ML model integration
 *
 * Currently delegates to the existing rolling-average algorithm so that the
 * API surface is stable and can be wired up to an external ML service
 * (e.g. TensorFlow Serving, SageMaker) without changing call sites.
 *
 * When a real ML backend is available:
 *  1. Replace the body of `mlForecast` with an HTTP call to the model endpoint.
 *  2. Map the external response onto `MlForecastResult` so consumers remain
 *     decoupled from the upstream API shape.
 *  3. Update `model` to identify the active model version.
 */

import { prisma } from '@/lib/db/prisma'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOOKBACK_DAYS = 30
const ROLLING_WINDOW_DAYS = 7

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MlForecastResult = {
  recipeId: string
  /** One predicted quantity per requested day, indexed 0 = day+1 … n-1 = day+n */
  predictions: number[]
  /** 0-100 confidence score */
  confidence: number
  /** Identifies which model/version produced this forecast */
  model: string
}

// ---------------------------------------------------------------------------
// Internal rolling-average helper
// ---------------------------------------------------------------------------

async function getRollingAverage(recipeId: string, windowDays: number): Promise<number> {
  const lookbackStart = new Date()
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - LOOKBACK_DAYS)
  lookbackStart.setUTCHours(0, 0, 0, 0)

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const batches = await prisma.productionBatch.findMany({
    where: {
      recipeId,
      status: 'COMPLETED',
      actualCompletionTime: { gte: lookbackStart },
    },
    select: { quantity: true, actualCompletionTime: true },
  })

  // Group totals by calendar day
  const dailyMap = new Map<string, number>()
  for (const b of batches) {
    if (!b.actualCompletionTime) continue
    const key = b.actualCompletionTime.toISOString().slice(0, 10)
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + b.quantity)
  }

  // Rolling average over the last windowDays days
  let sum = 0
  let count = 0
  for (let i = 1; i <= windowDays; i++) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    const qty = dailyMap.get(d.toISOString().slice(0, 10))
    if (qty !== undefined) {
      sum += qty
      count++
    }
  }

  return count === 0 ? 0 : Math.round(sum / count)
}

// ---------------------------------------------------------------------------
// Confidence helper (mirrors the logic in the forecast route)
// ---------------------------------------------------------------------------

function deriveConfidence(rollingAvg: number): number {
  // Without a real ML model the confidence is capped at 70 to signal that
  // this is a statistical estimate, not a learned prediction.
  if (rollingAvg === 0) return 0
  return 70
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns an ML-style forecast for a given recipe over the requested number
 * of days.
 *
 * Current implementation: delegates to a 7-day rolling average and fills
 * every forecast day with the same value.
 *
 * Future implementation: call an external ML inference endpoint and map its
 * response to `MlForecastResult`.
 *
 * @param recipeId - The Prisma CUID of the recipe to forecast.
 * @param days     - Number of future days to predict (1–30).
 */
export async function mlForecast(
  recipeId: string,
  days: number,
): Promise<MlForecastResult> {
  // TODO: swap this block for an HTTP call to the ML service once available.
  // Example:
  //   const res = await fetch(`${process.env.ML_SERVICE_URL}/forecast`, {
  //     method: 'POST',
  //     body: JSON.stringify({ recipeId, days }),
  //     headers: { 'Content-Type': 'application/json' },
  //   })
  //   const json = await res.json()
  //   return { recipeId, predictions: json.predictions, confidence: json.confidence, model: json.model_version }

  const rollingAvg = await getRollingAverage(recipeId, ROLLING_WINDOW_DAYS)

  return {
    recipeId,
    predictions: Array(days).fill(rollingAvg) as number[],
    confidence: deriveConfidence(rollingAvg),
    model: 'rolling_average_v1',
  }
}
