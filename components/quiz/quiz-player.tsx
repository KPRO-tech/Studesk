'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, X, Clock, ArrowRight, RotateCcw, ChevronLeft } from 'lucide-react'
import { db, uid, type Quiz, type QuizMode } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function arraysEqual(a: number[], b: number[]) {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

export function QuizPlayer({
  quiz,
  mode,
  userId,
  onExit,
}: {
  quiz: Quiz
  mode: QuizMode
  userId: string
  onExit: () => void
}) {
  const total = quiz.questions.length
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<number[][]>(() => quiz.questions.map(() => []))
  const [revealed, setRevealed] = useState(false)
  const [finished, setFinished] = useState(false)
  const [startedAt] = useState(() => Date.now())

  const totalTime = mode === 'timed' ? quiz.timeLimit ?? total * 30 : 0
  const [remaining, setRemaining] = useState(totalTime)

  const current = quiz.questions[index]
  const multi = current?.correct.length > 1

  const finish = useMemo(
    () => async (finalAnswers: number[][]) => {
      const score = quiz.questions.reduce(
        (s, q, i) => s + (arraysEqual(finalAnswers[i] ?? [], q.correct) ? 1 : 0),
        0,
      )
      await db.quizAttempts.add({
        id: uid(),
        quizId: quiz.id,
        userId,
        mode,
        answers: finalAnswers,
        score,
        total,
        durationMs: Date.now() - startedAt,
        completedAt: Date.now(),
      })
      setFinished(true)
    },
    [quiz, userId, mode, total, startedAt],
  )

  // Timed mode countdown
  useEffect(() => {
    if (mode !== 'timed' || finished) return
    if (remaining <= 0) {
      void finish(answers)
      return
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [mode, remaining, finished, finish, answers])

  if (finished) {
    return <Results quiz={quiz} answers={answers} mode={mode} onExit={onExit} />
  }

  const toggleOption = (optionIndex: number) => {
    if (revealed) return
    setAnswers((prev) => {
      const next = [...prev]
      const cur = next[index] ?? []
      if (multi) {
        next[index] = cur.includes(optionIndex)
          ? cur.filter((o) => o !== optionIndex)
          : [...cur, optionIndex]
      } else {
        next[index] = [optionIndex]
      }
      return next
    })
  }

  const selected = answers[index] ?? []
  const canNext = selected.length > 0

  const next = () => {
    if (mode === 'practice' && !revealed) {
      setRevealed(true)
      return
    }
    if (index + 1 >= total) {
      void finish(answers)
    } else {
      setIndex((i) => i + 1)
      setRevealed(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={onExit} aria-label="Quitter">
          <ChevronLeft className="size-4" />
        </Button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((index + (revealed ? 1 : 0)) / total) * 100}%` }}
          />
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {index + 1}/{total}
        </span>
        {mode === 'timed' && (
          <span
            className={cn(
              'flex items-center gap-1 text-sm font-medium tabular-nums',
              remaining <= 10 ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            <Clock className="size-4" />
            {Math.floor(remaining / 60)}:{(remaining % 60).toString().padStart(2, '0')}
          </span>
        )}
      </div>

      <Card className="p-6">
        <p className="font-heading text-lg font-medium text-balance">{current.question}</p>
        {multi && (
          <p className="mt-1 text-xs text-muted-foreground">Plusieurs réponses possibles.</p>
        )}
        <div className="mt-4 flex flex-col gap-2">
          {current.options.map((opt, i) => {
            const isSelected = selected.includes(i)
            const isCorrect = current.correct.includes(i)
            const showState = revealed
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleOption(i)}
                disabled={revealed}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                  !showState && isSelected && 'border-primary bg-primary/5',
                  !showState && !isSelected && 'border-border hover:bg-accent',
                  showState && isCorrect && 'border-primary bg-primary/10',
                  showState && isSelected && !isCorrect && 'border-destructive bg-destructive/10',
                  showState && !isCorrect && !isSelected && 'border-border opacity-70',
                )}
              >
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border text-xs',
                    isSelected && !showState && 'border-primary bg-primary text-primary-foreground',
                    showState && isCorrect && 'border-primary bg-primary text-primary-foreground',
                    showState && isSelected && !isCorrect && 'border-destructive bg-destructive text-primary-foreground',
                  )}
                >
                  {showState && isCorrect ? (
                    <Check className="size-3" />
                  ) : showState && isSelected && !isCorrect ? (
                    <X className="size-3" />
                  ) : (
                    String.fromCharCode(65 + i)
                  )}
                </span>
                {opt}
              </button>
            )
          })}
        </div>

        {revealed && current.explanation && (
          <div className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            {current.explanation}
          </div>
        )}
      </Card>

      <div className="mt-4 flex justify-end">
        <Button onClick={next} disabled={!canNext} className="gap-2">
          {mode === 'practice' && !revealed
            ? 'Vérifier'
            : index + 1 >= total
              ? 'Terminer'
              : 'Suivant'}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function Results({
  quiz,
  answers,
  mode,
  onExit,
}: {
  quiz: Quiz
  answers: number[][]
  mode: QuizMode
  onExit: () => void
}) {
  const results = quiz.questions.map((q, i) => ({
    q,
    given: answers[i] ?? [],
    correct: arraysEqual(answers[i] ?? [], q.correct),
  }))
  const score = results.filter((r) => r.correct).length
  const total = quiz.questions.length
  const pct = Math.round((score / total) * 100)
  const wrong = results.filter((r) => !r.correct)

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <div
          className={cn(
            'flex size-20 items-center justify-center rounded-full text-2xl font-semibold',
            pct >= 70 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive',
          )}
        >
          {pct}%
        </div>
        <h2 className="font-heading text-xl font-semibold">
          {score} / {total} bonnes réponses
        </h2>
        <p className="text-sm text-muted-foreground">
          Mode {mode === 'practice' ? 'entraînement' : mode === 'exam' ? 'examen' : 'chronométré'}
        </p>
        <div className="mt-2 flex gap-2">
          <Button variant="outline" onClick={onExit} className="gap-2">
            <RotateCcw className="size-4" /> Retour
          </Button>
        </div>
      </Card>

      {wrong.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Analyse des erreurs ({wrong.length})
          </h3>
          <ul className="flex flex-col gap-3">
            {wrong.map(({ q, given }, i) => (
              <li key={i}>
                <Card className="p-4">
                  <p className="font-medium">{q.question}</p>
                  <p className="mt-2 text-sm text-destructive">
                    Votre réponse :{' '}
                    {given.length > 0
                      ? given.map((g) => q.options[g]).join(', ')
                      : 'Aucune'}
                  </p>
                  <p className="mt-1 text-sm text-primary">
                    Bonne réponse : {q.correct.map((c) => q.options[c]).join(', ')}
                  </p>
                  {q.explanation && (
                    <p className="mt-2 text-sm text-muted-foreground">{q.explanation}</p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
