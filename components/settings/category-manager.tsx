'use client'

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { db, uid, type CategoryKind } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type ListKind = 'subject' | 'tag' | CategoryKind // subject | tag | task | expense | event

const TABS: { key: ListKind; label: string }[] = [
  { key: 'subject', label: 'Matières' },
  { key: 'task', label: 'Tâches' },
  { key: 'expense', label: 'Dépenses' },
  { key: 'income', label: 'Revenus' },
  { key: 'event', label: 'Événements' },
  { key: 'tag', label: 'Tags' },
]

const PALETTE = [
  'oklch(0.6 0.13 250)',
  'oklch(0.6 0.13 150)',
  'oklch(0.62 0.16 25)',
  'oklch(0.7 0.13 70)',
  'oklch(0.58 0.14 320)',
  'oklch(0.6 0.1 195)',
  'oklch(0.5 0.12 40)',
  'oklch(0.55 0.13 290)',
]

interface Item {
  id: string
  name: string
  color: string
}

const MAX_TAGS = 50

export function CategoryManager({ userId }: { userId: string }) {
  const [kind, setKind] = useState<ListKind>('subject')
  const [adding, setAdding] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)

  const items = useLiveQuery<Item[]>(async () => {
    if (kind === 'subject') {
      return db.subjects.where('userId').equals(userId).toArray()
    }
    if (kind === 'tag') {
      return db.tags.where('userId').equals(userId).toArray()
    }
    return db.categories
      .where('userId')
      .equals(userId)
      .filter((c) => c.kind === kind)
      .toArray()
  }, [userId, kind])

  const sorted = useMemo(
    () => [...(items ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  )

  const nextColor = () => PALETTE[(items?.length ?? 0) % PALETTE.length]

  const add = async () => {
    const name = adding.trim()
    if (!name) return
    if (sorted.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Cet élément existe déjà.')
      return
    }
    if (kind === 'tag' && (items?.length ?? 0) >= MAX_TAGS) {
      toast.error(`Maximum ${MAX_TAGS} tags.`)
      return
    }
    const now = Date.now()
    const base = { id: uid(), userId, name, color: nextColor(), createdAt: now }
    if (kind === 'subject') await db.subjects.add(base)
    else if (kind === 'tag') await db.tags.add(base)
    else await db.categories.add({ ...base, kind })
    setAdding('')
  }

  const saveEdit = async () => {
    if (!editing) return
    const name = editing.name.trim()
    if (!name) return
    if (kind === 'subject') await db.subjects.update(editing.id, { name })
    else if (kind === 'tag') await db.tags.update(editing.id, { name })
    else await db.categories.update(editing.id, { name })
    setEditing(null)
  }

  const remove = async (id: string) => {
    if (kind === 'subject') await db.subjects.delete(id)
    else if (kind === 'tag') await db.tags.delete(id)
    else await db.categories.delete(id)
    toast.success('Élément supprimé.')
  }

  return (
    <div>
      {/* Type switch */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setKind(t.key)
              setEditing(null)
              setAdding('')
            }}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
              kind === t.key
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Add row */}
      <div className="mb-4 flex gap-2">
        <Input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Nouvel élément…"
        />
        <Button onClick={add} className="shrink-0 gap-1.5">
          <Plus className="size-4" /> Ajouter
        </Button>
      </div>

      <Card className="divide-y divide-border p-0">
        {sorted.length > 0 ? (
          sorted.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              {editing?.id === item.id ? (
                <>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit()
                      if (e.key === 'Escape') setEditing(null)
                    }}
                    autoFocus
                    className="h-8 flex-1"
                  />
                  <Button size="icon" variant="ghost" className="size-8" onClick={saveEdit} aria-label="Valider">
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => setEditing(null)}
                    aria-label="Annuler"
                  >
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate text-sm">{item.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground"
                    onClick={() => setEditing({ id: item.id, name: item.name })}
                    aria-label="Modifier"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(item.id)}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun élément.</p>
        )}
      </Card>

      {kind === 'tag' && (
        <p className="mt-2 text-xs text-muted-foreground">
          {items?.length ?? 0} / {MAX_TAGS} tags · maximum 4 par tâche.
        </p>
      )}
    </div>
  )
}
