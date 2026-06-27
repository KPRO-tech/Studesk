'use client'

import { useMemo, useState } from 'react'
import { X, RotateCcw, Check } from 'lucide-react'
import { db, uid, type Card, type ReviewResult } from '@/lib/db'
import { scheduleCard, RESULT_LABELS } from '@/lib/sm2'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const RATINGS: { key: ReviewResult; className: string }[] = [
  { key: 'again', className: 'border-destructive/40 text-destructive hover:bg-destructive/10' },
  { key: 'hard', className: 'hover:bg-accent' },
  { key: 'good', className: 'hover:bg-accent' },
  { key: 'easy', className: 'border-primary/40 text-primary hover:bg-primary/10' },
]

export function ReviewSession({
  cards,
  userId,
  deckId,
  onExit,
}: {
  cards: Card[]
  userId: string
  deckId: string
  onExit: () => void
}) {
  // Stable queue for this session
  const initial = useMemo(() => cards, [cards])
  const [queue] = useState<Card[]>(initial)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [stats, setStats] = useState({ reviewed: 0, again: 0 })

  const current = queue[index]
  const done = index >= queue.length

  const rate = async (result: ReviewResult) => {
    if (!current) return
    const now = Date.now()
    const update = scheduleCard(current, result, now)
    await db.cards.update(current.id, {
      ...update,
      lastResult: result,
      lastReviewedAt: now,
      updatedAt: now,
      sync: 'pending',
    })
    await db.reviews.add({
      id: uid(),
      cardId: current.id,
      deckId,
      userId,
      result,
      reviewedAt: now,
    })

    setStats((s) => ({
      reviewed: s.reviewed + 1,
      again: s.again + (result === 'again' ? 1 : 0),
    }))

    // Every rating — including "À revoir" — simply records the result and
    // moves on to the next available card, ending the session when none remain.
    setFlipped(false)
    setIndex((i) => i + 1)
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="size-7" />
        </div>
        <h2 className="font-heading text-xl font-semibold">Session terminée</h2>
        <p className="text-sm text-muted-foreground">
          {stats.reviewed} révision{stats.reviewed > 1 ? 's' : ''} effectuée
          {stats.reviewed > 1 ? 's' : ''}.
        </p>
        <Button onClick={onExit} className="mt-2">
          Retour au paquet
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <div className="mb-4 flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={onExit} aria-label="Quitter">
          <X className="size-4" />
        </Button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(index / queue.length) * 100}%` }}
          />
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {index + 1}/{queue.length}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className={cn('flip-card h-72 w-full text-left', flipped && 'flipped')}
        aria-label="Retourner la carte"
      >
        <div className="flip-card-inner">
          <div className="flip-card-face flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-6">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Question
            </span>
            <p className="text-center text-xl font-medium text-balance">{current.front}</p>
            <span className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <RotateCcw className="size-3.5" /> Cliquez pour révéler
            </span>
          </div>
          <div className="flip-card-face flip-card-back flex flex-col items-center justify-center gap-3 rounded-xl border border-primary/30 bg-card p-6">
            <span className="text-xs uppercase tracking-wide text-primary">Réponse</span>
            <p className="text-center text-xl font-medium text-balance">{current.back}</p>
          </div>
        </div>
      </button>

      {flipped ? (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map((r) => (
            <Button
              key={r.key}
              variant="outline"
              onClick={() => rate(r.key)}
              className={cn('h-11', r.className)}
            >
              {RESULT_LABELS[r.key]}
            </Button>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Retournez la carte pour vous auto-évaluer.
        </p>
      )}
    </div>
  )
}
