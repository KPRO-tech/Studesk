'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus,
  HelpCircle,
  Play,
  Pencil,
  Trash2,
  Dumbbell,
  GraduationCap,
  Timer,
  History,
  Sparkles,
} from 'lucide-react'
import { db, type Quiz, type QuizMode } from '@/lib/db'
import { useApp } from '@/components/providers'
import { QuizBuilder } from '@/components/quiz/quiz-builder'
import { QuizPlayer } from '@/components/quiz/quiz-player'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatRelativeDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type View =
  | { kind: 'list' }
  | { kind: 'create'; quiz: Quiz | null }
  | { kind: 'play'; quiz: Quiz; mode: QuizMode }

const MODES: { key: QuizMode; label: string; desc: string; icon: typeof Dumbbell }[] = [
  { key: 'practice', label: 'Entraînement', desc: 'Correction après chaque question', icon: Dumbbell },
  { key: 'exam', label: 'Examen', desc: 'Résultats à la fin', icon: GraduationCap },
  { key: 'timed', label: 'Chronométré', desc: '30 s par question', icon: Timer },
]

export default function QuizPage() {
  const { userId } = useApp()
  const [view, setView] = useState<View>({ kind: 'list' })
  const [modeFor, setModeFor] = useState<Quiz | null>(null)

  if (view.kind === 'create' && userId) {
    return (
      <QuizBuilder
        quiz={view.quiz}
        onDone={() => setView({ kind: 'list' })}
        onCancel={() => setView({ kind: 'list' })}
      />
    )
  }

  if (view.kind === 'play' && userId) {
    return (
      <QuizPlayer
        quiz={view.quiz}
        mode={view.mode}
        userId={userId}
        onExit={() => setView({ kind: 'list' })}
      />
    )
  }

  return (
    <>
      <QuizList
        userId={userId}
        onCreate={() => setView({ kind: 'create', quiz: null })}
        onEdit={(quiz) => setView({ kind: 'create', quiz })}
        onPlay={(quiz) => setModeFor(quiz)}
      />
      {modeFor && (
        <ModeDialog
          quiz={modeFor}
          onClose={() => setModeFor(null)}
          onSelect={(mode) => {
            const quiz = modeFor
            setModeFor(null)
            setView({ kind: 'play', quiz, mode })
          }}
        />
      )}
    </>
  )
}

function QuizList({
  userId,
  onCreate,
  onEdit,
  onPlay,
}: {
  userId: string | null
  onCreate: () => void
  onEdit: (quiz: Quiz) => void
  onPlay: (quiz: Quiz) => void
}) {
  const quizzes = useLiveQuery(
    () => (userId ? db.quizzes.where('userId').equals(userId).reverse().sortBy('updatedAt') : []),
    [userId],
  )
  const attempts = useLiveQuery(
    () => (userId ? db.quizAttempts.where('userId').equals(userId).toArray() : []),
    [userId],
  )
  const subjects = useLiveQuery(
    () => (userId ? db.subjects.where('userId').equals(userId).toArray() : []),
    [userId],
  )
  const subjectFor = (id?: string) => subjects?.find((s) => s.id === id)

  const bestFor = (quizId: string) => {
    const list = (attempts ?? []).filter((a) => a.quizId === quizId)
    if (list.length === 0) return null
    const best = Math.max(...list.map((a) => Math.round((a.score / a.total) * 100)))
    return { best, count: list.length }
  }

  const remove = async (quiz: Quiz) => {
    await db.quizAttempts.where('quizId').equals(quiz.id).delete()
    await db.quizzes.delete(quiz.id)
    toast.success('Quiz supprimé.')
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Quiz"
        description="Créez des QCM manuellement ou avec l'IA, puis entraînez-vous."
        action={
          <Button onClick={onCreate} className="gap-2">
            <Plus className="size-4" /> Créer un quiz
          </Button>
        }
      />

      {quizzes && quizzes.length > 0 ? (
        <>
          <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Quiz récents
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz) => {
              const stats = bestFor(quiz.id)
              const subject = subjectFor(quiz.subjectId)
              return (
                <Card key={quiz.id} className="flex flex-col gap-3 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <HelpCircle className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-medium">{quiz.title}</p>
                        {quiz.aiGenerated && (
                          <Sparkles className="size-3 text-primary shrink-0" aria-label="Généré par l'IA" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {quiz.questions.length} question{quiz.questions.length > 1 ? 's' : ''} ·{' '}
                        {formatRelativeDay(quiz.updatedAt)}
                      </p>
                      {subject && (
                        <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: subject.color }}
                          />
                          {subject.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {stats && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <History className="size-3.5" />
                      Meilleur score {stats.best}% · {stats.count} tentative
                      {stats.count > 1 ? 's' : ''}
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <Button size="sm" className="flex-1 gap-2" onClick={() => onPlay(quiz)}>
                      <Play className="size-4" /> Démarrer
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => onEdit(quiz)}
                      aria-label="Modifier"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(quiz)}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <HelpCircle className="size-8 text-muted-foreground/60" />
          <div>
            <p className="font-medium">Aucun quiz</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Créez votre premier quiz, manuellement ou avec l&apos;IA.
            </p>
          </div>
          <Button onClick={onCreate} className="gap-2">
            <Plus className="size-4" /> Créer un quiz
          </Button>
        </div>
      )}
    </div>
  )
}

function ModeDialog({
  quiz,
  onClose,
  onSelect,
}: {
  quiz: Quiz
  onClose: () => void
  onSelect: (mode: QuizMode) => void
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{quiz.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Choisissez un mode de jeu.</p>
        <div className="mt-2 flex flex-col gap-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => onSelect(m.key)}
              className={cn(
                'flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent',
              )}
            >
              <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <m.icon className="size-5" />
              </div>
              <div>
                <p className="font-medium">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
