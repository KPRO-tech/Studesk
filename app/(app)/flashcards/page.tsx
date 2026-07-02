'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus,
  Layers,
  Play,
  Pencil,
  Trash2,
  ArrowLeft,
  History,
  GraduationCap,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { db, uid, type Deck, type Card as FlashCard, type ReviewResult, type Visibility } from '@/lib/db'
import { useApp } from '@/components/providers'
import { newCardScheduling, RESULT_LABELS } from '@/lib/sm2'
import { ReviewSession } from '@/components/flashcards/review-session'
import { VisibilityToggle } from '@/components/community/visibility-toggle'
import { ImportedBadge } from '@/components/community/imported-badge'
import { PageHeader } from '@/components/page-header'
import { SubjectPicker } from '@/components/subject-picker'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatRelativeDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function FlashcardsPage() {
  const { userId } = useApp()
  const [openDeck, setOpenDeck] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<{ deckId: string; cards: FlashCard[] } | null>(
    null,
  )

  if (reviewing && userId) {
    return (
      <div className="mx-auto max-w-3xl">
        <ReviewSession
          cards={reviewing.cards}
          userId={userId}
          deckId={reviewing.deckId}
          onExit={() => setReviewing(null)}
        />
      </div>
    )
  }

  if (openDeck && userId) {
    return (
      <DeckView
        deckId={openDeck}
        userId={userId}
        onBack={() => setOpenDeck(null)}
        onReview={(cards) => setReviewing({ deckId: openDeck, cards })}
      />
    )
  }

  return <DeckList userId={userId} onOpen={setOpenDeck} onReview={setReviewing} />
}

/* ------------------------------------------------------------------ */
/* Deck list                                                           */
/* ------------------------------------------------------------------ */

function DeckList({
  userId,
  onOpen,
  onReview,
}: {
  userId: string | null
  onOpen: (id: string) => void
  onReview: (r: { deckId: string; cards: FlashCard[] }) => void
}) {
  const [editing, setEditing] = useState<Deck | null>(null)
  const [creating, setCreating] = useState(false)

  const decks = useLiveQuery(
    () => (userId ? db.decks.where('userId').equals(userId).reverse().sortBy('updatedAt') : []),
    [userId],
  )
  const cards = useLiveQuery(
    () => (userId ? db.cards.where('userId').equals(userId).toArray() : []),
    [userId],
  )
  const subjects = useLiveQuery(
    () => (userId ? db.subjects.where('userId').equals(userId).toArray() : []),
    [userId],
  )

  const now = Date.now()
  const countFor = (deckId: string) => cards?.filter((c) => c.deckId === deckId).length ?? 0
  const dueFor = (deckId: string) =>
    cards?.filter((c) => c.deckId === deckId && (c.dueDate <= now || c.lastResult === 'again')).length ?? 0

  const reviewAll = () => {
    if (!cards) return
    const due = cards.filter((c) => c.dueDate <= now || c.lastResult === 'again')
    if (due.length === 0) {
      toast.info('Aucune carte à réviser pour le moment.')
      return
    }
    // Group review across decks isn't supported by the session deckId, so
    // review the deck with the most due cards. Simpler: review all due cards
    // tagging the first deck. We pass deckId of first due card.
    onReview({ deckId: due[0].deckId, cards: due })
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Flashcards"
        description="Révision espacée façon Anki, propulsée par l'algorithme SM-2."
        action={
          <>
            <Button variant="outline" onClick={reviewAll} className="gap-2">
              <Play className="size-4" /> Réviser
            </Button>
            <Button onClick={() => setCreating(true)} className="gap-2">
              <Plus className="size-4" /> Nouveau paquet
            </Button>
          </>
        }
      />

      {decks === undefined || cards === undefined ? (
        <div className="flex justify-center p-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : decks.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => {
            const total = countFor(deck.id)
            const due = dueFor(deck.id)
            return (
              <Card key={deck.id} className="flex flex-col gap-3 p-5" onClick={() => onOpen(deck.id)}>
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Layers className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-medium">{deck.name}</p>
                          {deck.aiGenerated && (
                            <Sparkles className="size-3 text-primary shrink-0" aria-label="Généré par l'IA" />
                          )}
                          <ImportedBadge importedFrom={deck.importedFrom} />
                        </div>
                        {deck.subjectId && subjects && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: subjects.find((s) => s.id === deck.subjectId)?.color }}
                            />
                            {subjects.find((s) => s.id === deck.subjectId)?.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {total} carte{total > 1 ? 's' : ''}
                        {due > 0 && ` · ${due} à réviser`}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditing(deck)
                      }}
                      aria-label="Modifier le paquet"
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={due > 0 ? 'default' : 'outline'}
                  className="gap-2"
                  disabled={total === 0}
                  onClick={() => {
                    const list = (cards ?? []).filter(
                      (c) => c.deckId === deck.id && (c.dueDate <= now || c.lastResult === 'again'),
                    )
                    const fallback = (cards ?? []).filter((c) => c.deckId === deck.id)
                    onReview({
                      deckId: deck.id,
                      cards: list.length > 0 ? list : fallback,
                    })
                  }}
                >
                  <Play className="size-4" />
                  {due > 0 ? `Réviser (${due})` : 'Revoir tout'}
                </Button>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={Layers}
          title="Aucun paquet"
          text="Créez votre premier paquet de flashcards pour commencer à réviser."
          action={
            <Button onClick={() => setCreating(true)} className="gap-2">
              <Plus className="size-4" /> Nouveau paquet
            </Button>
          }
        />
      )}

      {(creating || editing) && (
        <DeckDialog
          userId={userId!}
          deck={editing}
          subjects={subjects ?? []}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function DeckDialog({
  userId,
  deck,
  subjects,
  onClose,
}: {
  userId: string
  deck: Deck | null
  subjects: import('@/lib/db').Subject[]
  onClose: () => void
}) {
  const [name, setName] = useState(deck?.name ?? '')
  const [description, setDescription] = useState(deck?.description ?? '')
  const [subjectId, setSubjectId] = useState<string | undefined>(deck?.subjectId)
  const [visibility, setVisibility] = useState<Visibility>(deck?.visibility ?? 'private')

  const save = async () => {
    if (!name.trim()) {
      toast.error('Donnez un nom au paquet.')
      return
    }
    const now = Date.now()
    if (deck) {
      await db.decks.update(deck.id, { name: name.trim(), description, subjectId: subjectId || undefined, updatedAt: now, visibility })
    } else {
      await db.decks.add({
        id: uid(),
        userId,
        name: name.trim(),
        description,
        visibility,
        subjectId: subjectId || undefined,
        createdAt: now,
        updatedAt: now,
        sync: 'pending',
      })
    }
    onClose()
  }

  const remove = async () => {
    if (!deck) return
    await db.cards.where('deckId').equals(deck.id).delete()
    await db.reviews.where('deckId').equals(deck.id).delete()
    await db.decks.delete(deck.id)
    toast.success('Paquet supprimé.')
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{deck ? 'Modifier le paquet' : 'Nouveau paquet'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deck-name">Nom</Label>
            <Input
              id="deck-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Vocabulaire anglais"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Matière (Optionnel)</Label>
            <SubjectPicker
              userId={userId}
              subjects={subjects}
              value={subjectId}
              onChange={setSubjectId}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deck-desc">Description</Label>
            <Textarea
              id="deck-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionnel"
              className="resize-none"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <Label>Visibilité</Label>
              <span className="text-xs text-muted-foreground">
                Rendez ce paquet public pour le partager.
              </span>
            </div>
            <VisibilityToggle value={visibility} onChange={setVisibility} />
          </div>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {deck ? (
            <Button variant="ghost" className="text-destructive" onClick={remove}>
              <Trash2 className="size-4" /> Supprimer
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save}>{deck ? 'Enregistrer' : 'Créer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Deck view (cards + history)                                         */
/* ------------------------------------------------------------------ */

function DeckView({
  deckId,
  userId,
  onBack,
  onReview,
}: {
  deckId: string
  userId: string
  onBack: () => void
  onReview: (cards: FlashCard[]) => void
}) {
  const [editingCard, setEditingCard] = useState<FlashCard | null>(null)
  const [creatingCard, setCreatingCard] = useState(false)
  const [historyCard, setHistoryCard] = useState<FlashCard | null>(null)

  const deck = useLiveQuery(() => db.decks.get(deckId), [deckId])
  const cards = useLiveQuery(
    () => db.cards.where('deckId').equals(deckId).reverse().sortBy('createdAt'),
    [deckId],
  )
  const subjects = useLiveQuery(
    () => db.subjects.where('userId').equals(userId).toArray(),
    [userId],
  )
  const subject = deck?.subjectId ? subjects?.find((s) => s.id === deck.subjectId) : undefined

  const now = Date.now()

  const deleteCard = async (card: FlashCard) => {
    await db.reviews.where('cardId').equals(card.id).delete()
    await db.cards.delete(card.id)
    toast.success('Carte supprimée.')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={onBack} aria-label="Retour">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-heading text-xl font-semibold">{deck?.name}</h1>
            {subject && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: subject.color }}
                />
                {subject.name}
              </span>
            )}
          </div>
          {deck?.description && (
            <p className="truncate text-sm text-muted-foreground">{deck.description}</p>
          )}
        </div>
        {deck && (
          <VisibilityToggle
            value={deck.visibility}
            onChange={(v) => db.decks.update(deck.id, { visibility: v, updatedAt: Date.now() })}
          />
        )}
        <Button
          variant="outline"
          className="gap-2"
          disabled={!cards || cards.length === 0}
          onClick={() => {
            if (!cards) return
            const due = cards.filter((c) => c.dueDate <= now)
            onReview(due.length > 0 ? due : cards)
          }}
        >
          <Play className="size-4" /> Réviser
        </Button>
        <Button className="gap-2" onClick={() => setCreatingCard(true)}>
          <Plus className="size-4" /> Carte
        </Button>
      </div>

      {cards === undefined || deck === undefined ? (
        <div className="flex justify-center p-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : cards.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {cards.map((card) => (
            <li key={card.id}>
              <Card className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{card.front}</p>
                  <div className="mt-1.5">
                    <CardStatus card={card} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground"
                    onClick={() => setHistoryCard(card)}
                    aria-label="Historique"
                  >
                    <History className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground"
                    onClick={() => setEditingCard(card)}
                    aria-label="Modifier"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteCard(card)}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={GraduationCap}
          title="Aucune carte"
          text="Ajoutez des cartes question / réponse à ce paquet."
          action={
            <Button onClick={() => setCreatingCard(true)} className="gap-2">
              <Plus className="size-4" /> Ajouter une carte
            </Button>
          }
        />
      )}

      {(creatingCard || editingCard) && (
        <CardDialog
          userId={userId}
          deckId={deckId}
          card={editingCard}
          onClose={() => {
            setCreatingCard(false)
            setEditingCard(null)
          }}
        />
      )}

      {historyCard && (
        <HistoryDialog card={historyCard} onClose={() => setHistoryCard(null)} />
      )}
    </div>
  )
}

function CardDialog({
  userId,
  deckId,
  card,
  onClose,
}: {
  userId: string
  deckId: string
  card: FlashCard | null
  onClose: () => void
}) {
  const [front, setFront] = useState(card?.front ?? '')
  const [back, setBack] = useState(card?.back ?? '')

  const save = async () => {
    if (!front.trim() || !back.trim()) {
      toast.error('Renseignez la question et la réponse.')
      return
    }
    const now = Date.now()
    if (card) {
      await db.cards.update(card.id, {
        front: front.trim(),
        back: back.trim(),
        updatedAt: now,
        sync: 'pending',
      })
      onClose()
    } else {
      await db.cards.add({
        id: uid(),
        deckId,
        userId,
        front: front.trim(),
        back: back.trim(),
        ...newCardScheduling(now),
        createdAt: now,
        updatedAt: now,
        sync: 'pending',
      })
      await db.decks.update(deckId, { updatedAt: now })
      toast.success('Carte ajoutée.')
      onClose()
    }
  }

  const remove = async () => {
    if (!card) return
    await db.reviews.where('cardId').equals(card.id).delete()
    await db.cards.delete(card.id)
    toast.success('Carte supprimée.')
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{card ? 'Modifier la carte' : 'Nouvelle carte'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-front">Question (recto)</Label>
            <Textarea
              id="card-front"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              className="resize-none"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-back">Réponse (verso)</Label>
            <Textarea
              id="card-back"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {card ? (
            <Button variant="ghost" className="text-destructive" onClick={remove}>
              <Trash2 className="size-4" /> Supprimer
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save}>{card ? 'Enregistrer' : 'Ajouter'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function HistoryDialog({ card, onClose }: { card: FlashCard; onClose: () => void }) {
  const logs = useLiveQuery(
    () => db.reviews.where('cardId').equals(card.id).reverse().sortBy('reviewedAt'),
    [card.id],
  )

  const badgeClass: Record<ReviewResult, string> = {
    again: 'text-destructive',
    hard: 'text-amber-600 dark:text-amber-500',
    good: 'text-foreground',
    easy: 'text-primary',
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Historique de révision</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{card.front}</p>
        <div className="mt-2 max-h-72 overflow-y-auto">
          {logs && logs.length > 0 ? (
            <ul className="divide-y divide-border">
              {logs.map((log) => (
                <li key={log.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>
                    Vu le{' '}
                    {new Date(log.reviewedAt).toLocaleDateString('fr-FR')} à{' '}
                    {new Date(log.reviewedAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className={cn('font-medium', badgeClass[log.result])}>
                    {RESULT_LABELS[log.result]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Cette carte n&apos;a pas encore été révisée.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const RESULT_STYLES: Record<ReviewResult, string> = {
  again: 'bg-destructive/10 text-destructive',
  hard: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  good: 'bg-muted text-foreground',
  easy: 'bg-primary/10 text-primary',
}

function CardStatus({ card }: { card: FlashCard }) {
  // A card that has never been reviewed is simply waiting to be studied.
  if (!card.lastReviewedAt) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        À réviser
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      Révisé {formatRelativeDay(card.lastReviewedAt)}
      {card.lastResult && (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-medium',
            RESULT_STYLES[card.lastResult],
          )}
        >
          {RESULT_LABELS[card.lastResult]}
        </span>
      )}
    </span>
  )
}

function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  text: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
      <Icon className="size-8 text-muted-foreground/60" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      </div>
      {action}
    </div>
  )
}
