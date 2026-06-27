import { DAY } from './dates'
import type { Card, ReviewResult } from './db'

/** Map a review result to an SM-2 quality score (0..5). */
const QUALITY: Record<ReviewResult, number> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
}

export interface Sm2Update {
  easeFactor: number
  interval: number
  repetitions: number
  dueDate: number
}

/**
 * Improved SM-2 scheduling.
 * - "again" resets the learning progress (interval 1 day).
 * - "hard" keeps a shorter interval and slightly lowers ease.
 * - "good"/"easy" grow the interval by the ease factor.
 * A small fuzz factor avoids cards piling up on the same day.
 */
export function scheduleCard(card: Card, result: ReviewResult, now = Date.now()): Sm2Update {
  const q = QUALITY[result]
  let { easeFactor, interval, repetitions } = card

  // Update ease factor (floor at 1.3).
  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  )

  if (result === 'again') {
    repetitions = 0
    interval = 0 // re-show within the same session (due now)
    return { easeFactor, interval, repetitions, dueDate: now + 60_000 }
  }

  if (repetitions === 0) {
    interval = result === 'easy' ? 3 : 1
  } else if (repetitions === 1) {
    interval = result === 'hard' ? 3 : 6
  } else {
    const factor = result === 'hard' ? 1.2 : easeFactor
    interval = Math.round(interval * factor)
    if (result === 'easy') interval = Math.round(interval * 1.3)
  }
  repetitions += 1
  interval = Math.max(1, interval)

  // ±5% fuzz
  const fuzz = 1 + (Math.random() * 0.1 - 0.05)
  const dueDate = now + Math.round(interval * fuzz) * DAY

  return { easeFactor, interval, repetitions, dueDate }
}

/** A fresh card's default scheduling fields. */
export function newCardScheduling(now = Date.now()) {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    dueDate: now,
  }
}

export const RESULT_LABELS: Record<ReviewResult, string> = {
  again: 'À revoir',
  hard: 'Difficile',
  good: 'Correct',
  easy: 'Facile',
}
