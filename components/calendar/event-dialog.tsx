'use client'

import { useMemo, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { db, uid, type RoutineEvent, type EventType, type Subject } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { WEEKDAYS, timeToMin, minToTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const TYPES: { key: EventType; label: string }[] = [
  { key: 'school', label: 'Scolaire' },
  { key: 'personal', label: 'Personnel' },
]

const PALETTE = ['oklch(0.6 0.13 250)', 'oklch(0.6 0.13 150)', 'oklch(0.62 0.16 25)', 'oklch(0.7 0.13 70)']

export function EventDialog({
  userId,
  event,
  defaultDay,
  defaultStartMin,
  subjects,
  onClose,
}: {
  userId: string
  event: RoutineEvent | null
  defaultDay: number
  defaultStartMin: number
  subjects: Subject[]
  onClose: () => void
}) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [type, setType] = useState<EventType>(event?.type ?? 'school')
  const [day, setDay] = useState<number>(event?.day ?? defaultDay)
  const [start, setStart] = useState(minToTime(event?.startMin ?? defaultStartMin))
  const [end, setEnd] = useState(minToTime(event?.endMin ?? defaultStartMin + 60))
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [subjectId, setSubjectId] = useState(event?.subjectId ?? '')
  const [subjectQuery, setSubjectQuery] = useState(
    event?.subjectId ? subjects.find((s) => s.id === event.subjectId)?.name ?? '' : '',
  )

  const matches = useMemo(() => {
    const q = subjectQuery.trim().toLowerCase()
    if (!q) return subjects.slice(0, 6)
    return subjects.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 6)
  }, [subjectQuery, subjects])

  const exactMatch = subjects.find(
    (s) => s.name.toLowerCase() === subjectQuery.trim().toLowerCase(),
  )

  const addSubject = async () => {
    const name = subjectQuery.trim()
    if (!name) return
    const id = uid()
    await db.subjects.add({
      id,
      userId,
      name,
      color: PALETTE[subjects.length % PALETTE.length],
      createdAt: Date.now(),
    })
    setSubjectId(id)
    toast.success('Matière ajoutée.')
  }

  const save = async () => {
    const startMin = timeToMin(start)
    const endMin = timeToMin(end)
    if (type === 'school') {
      if (!subjectId) {
        toast.error('Choisissez une matière.')
        return
      }
    } else if (!title.trim()) {
      toast.error("Donnez un titre à l'événement.")
      return
    }
    if (endMin <= startMin) {
      toast.error('La fin doit suivre le début.')
      return
    }
    const now = Date.now()
    const payload = {
      title: type === 'school' ? '' : title.trim(),
      type,
      subjectId: type === 'school' ? subjectId || undefined : undefined,
      day,
      startMin,
      endMin,
      notes,
      updatedAt: now,
      sync: 'pending' as const,
    }
    if (event) {
      await db.routines.update(event.id, payload)
    } else {
      await db.routines.add({ id: uid(), userId, createdAt: now, ...payload })
    }
    onClose()
  }

  const remove = async () => {
    if (!event) return
    await db.routines.delete(event.id)
    toast.success('Créneau supprimé.')
    onClose()
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex flex-col gap-1.5">
        <Label>Type</Label>
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              className={cn(
                'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                type === t.key ? 'border-primary bg-primary/5 text-foreground' : 'border-border hover:bg-accent',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {type === 'school' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ev-subject">Matière</Label>
          <Input
            id="ev-subject"
            value={subjectQuery}
            onChange={(e) => {
              setSubjectQuery(e.target.value)
              setSubjectId('')
            }}
            placeholder="Commencez à taper…"
          />
          {subjectQuery.trim() && !exactMatch && (
            <button
              type="button"
              onClick={addSubject}
              className="flex items-center gap-1.5 self-start text-sm text-primary hover:underline"
            >
              <Plus className="size-3.5" /> Ajouter la matière « {subjectQuery.trim()} »
            </button>
          )}
          {matches.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {matches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSubjectId(s.id)
                    setSubjectQuery(s.name)
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                    subjectId === s.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
                  )}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ev-title">Titre</Label>
          <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ev-day">Jour</Label>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setDay(i)}
              className={cn(
                'rounded-md border py-1.5 text-xs font-medium transition-colors',
                day === i ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:bg-accent',
              )}
              aria-label={label}
            >
              {label.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ev-start">Début</Label>
          <Input id="ev-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ev-end">Fin</Label>
          <Input id="ev-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ev-notes">Notes</Label>
        <Textarea
          id="ev-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="resize-none"
          placeholder="Optionnel"
        />
      </div>

      <div className="flex items-center justify-between">
        {event ? (
          <Button variant="ghost" className="text-destructive" onClick={remove}>
            <Trash2 className="size-4" /> Supprimer
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={save}>{event ? 'Enregistrer' : 'Ajouter'}</Button>
      </div>
    </div>
  )
}
