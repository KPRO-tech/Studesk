'use client'

import { useState, useMemo } from 'react'
import { Check, Tag as TagIcon } from 'lucide-react'
import { db, uid, type Subject } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'

export const SUBJECT_PALETTE = [
  'oklch(0.6 0.13 250)',
  'oklch(0.6 0.13 150)',
  'oklch(0.62 0.16 25)',
  'oklch(0.7 0.13 70)',
  'oklch(0.6 0.1 200)',
  'oklch(0.62 0.13 300)',
]

export function SubjectPicker({
  userId,
  subjects,
  value,
  onChange,
}: {
  userId: string
  subjects: Subject[]
  value: string | undefined
  onChange: (subjectId: string | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const current = subjects.find((s) => s.id === value)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return subjects
    return subjects.filter((s) => s.name.toLowerCase().includes(q))
  }, [query, subjects])

  const exactMatch = subjects.find(
    (s) => s.name.toLowerCase() === query.trim().toLowerCase(),
  )

  const addSubject = async () => {
    const name = query.trim()
    if (!name) return
    const id = uid()
    await db.subjects.add({
      id,
      userId,
      name,
      color: SUBJECT_PALETTE[subjects.length % SUBJECT_PALETTE.length],
      createdAt: Date.now(),
    })
    onChange(id)
    setQuery('')
    setOpen(false)
    toast.success('Matière créée et assignée.')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" className="h-8 gap-1.5" />}
      >
        {current ? (
          <>
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: current.color }}
            />
            <span className="max-w-32 truncate">{current.name}</span>
          </>
        ) : (
          <>
            <TagIcon className="size-3.5" />
            Matière
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher ou créer…"
          className="mb-2 h-8"
        />
        <div className="max-h-56 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              onChange(undefined)
              setOpen(false)
            }}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
          >
            <span className="text-muted-foreground">Sans matière</span>
            {!value && <Check className="size-3.5" />}
          </button>
          {matches.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange(s.id)
                setOpen(false)
              }}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              <span className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.name}
              </span>
              {value === s.id && <Check className="size-3.5" />}
            </button>
          ))}
          {query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={addSubject}
              className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              Créer <span className="font-medium">"{query.trim()}"</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
