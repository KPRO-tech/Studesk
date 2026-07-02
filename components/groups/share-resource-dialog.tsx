'use client'

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Layers, ListChecks, FileText } from 'lucide-react'
import { db, type Note, type Deck, type Quiz, type Card } from '@/lib/db'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type ShareKind = 'note' | 'deck' | 'quiz'

interface Item {
    id: string
    title: string
    meta: string
}

export function ShareResourceDialog({
    open,
    onOpenChange,
    userId,
    onSelect,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    userId: string
    onSelect: (kind: ShareKind, id: string, title: string) => void
}) {
    const [search, setSearch] = useState('')

    const notes = useLiveQuery(
        () => (open ? db.notes.where('userId').equals(userId).toArray() : Promise.resolve([] as Note[])),
        [userId, open],
    )
    const decks = useLiveQuery(
        () => (open ? db.decks.where('userId').equals(userId).toArray() : Promise.resolve([] as Deck[])),
        [userId, open],
    )
    const quizzes = useLiveQuery(
        () => (open ? db.quizzes.where('userId').equals(userId).toArray() : Promise.resolve([] as Quiz[])),
        [userId, open],
    )
    const cardCounts = useLiveQuery(
        () => (open ? db.cards.where('userId').equals(userId).toArray() : Promise.resolve([] as Card[])),
        [userId, open],
    )

    const q = search.trim().toLowerCase()
    const filter = (title: string) => !q || title.toLowerCase().includes(q)

    const noteItems: Item[] = useMemo(
        () =>
            (notes ?? [])
                .filter((n) => filter(n.title))
                .map((n) => ({ id: n.id, title: n.title || 'Sans titre', meta: 'Fiche' })),
        [notes, q],
    )
    const deckItems: Item[] = useMemo(() => {
        const counts = new Map<string, number>()
        for (const c of cardCounts ?? []) counts.set(c.deckId, (counts.get(c.deckId) ?? 0) + 1)
        return (decks ?? [])
            .filter((d) => filter(d.name))
            .map((d) => ({
                id: d.id,
                title: d.name,
                meta: `${counts.get(d.id) ?? 0} carte${(counts.get(d.id) ?? 0) > 1 ? 's' : ''}`,
            }))
    }, [decks, cardCounts, q])
    const quizItems: Item[] = useMemo(
        () =>
            (quizzes ?? [])
                .filter((quiz) => filter(quiz.title))
                .map((quiz) => ({
                    id: quiz.id,
                    title: quiz.title,
                    meta: `${quiz.questions.length} question${quiz.questions.length > 1 ? 's' : ''}`,
                })),
        [quizzes, q],
    )

    const pick = (kind: ShareKind, item: Item) => {
        onSelect(kind, item.id, item.title)
        onOpenChange(false)
        setSearch('')
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Partager une ressource</DialogTitle>
                    <DialogDescription>
                        Choisissez une de vos fiches, flashcards ou quiz à joindre au message.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher…"
                        className="pl-9"
                    />
                </div>

                <Tabs defaultValue="deck">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="deck" className="gap-1.5">
                            <Layers className="size-4" /> Flashcards
                        </TabsTrigger>
                        <TabsTrigger value="quiz" className="gap-1.5">
                            <ListChecks className="size-4" /> Quiz
                        </TabsTrigger>
                        <TabsTrigger value="note" className="gap-1.5">
                            <FileText className="size-4" /> Fiches
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="deck" className="mt-3">
                        <ItemList items={deckItems} icon={Layers} onPick={(it) => pick('deck', it)} />
                    </TabsContent>
                    <TabsContent value="quiz" className="mt-3">
                        <ItemList items={quizItems} icon={ListChecks} onPick={(it) => pick('quiz', it)} />
                    </TabsContent>
                    <TabsContent value="note" className="mt-3">
                        <ItemList items={noteItems} icon={FileText} onPick={(it) => pick('note', it)} />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}

function ItemList({
    items,
    icon: Icon,
    onPick,
}: {
    items: Item[]
    icon: typeof Layers
    onPick: (item: Item) => void
}) {
    if (items.length === 0) {
        return (
            <p className="py-10 text-center text-sm text-muted-foreground">
                Aucune ressource à partager ici.
            </p>
        )
    }
    return (
        <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {items.map((item) => (
                <li key={item.id}>
                    <button
                        type="button"
                        onClick={() => onPick(item)}
                        className={cn(
                            'flex w-full items-center gap-3 rounded-lg border border-border p-2.5 text-left transition-colors hover:border-primary/50 hover:bg-accent',
                        )}
                    >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.meta}</p>
                        </div>
                    </button>
                </li>
            ))}
        </ul>
    )
}