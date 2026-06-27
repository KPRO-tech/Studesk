'use client'

import { useMemo, useState, type MouseEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, CalendarDays, Pencil, Clock, Sparkles } from 'lucide-react'
import { db, type RoutineEvent, type EventType, type Subject } from '@/lib/db'
import { useApp } from '@/components/providers'
import { EventDialog } from '@/components/calendar/event-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { WEEKDAYS, WEEKDAYS_SHORT, weekdayIndex, minToTime } from '@/lib/dates'
import { cn } from '@/lib/utils'

const HOUR_HEIGHT = 46
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAYS = [0, 1, 2, 3, 4, 5, 6]

const TYPE_COLOR: Record<EventType, string> = {
  school: 'var(--chart-1)',
  personal: 'var(--chart-2)',
  business: 'var(--chart-4)',
}

type DialogState = {
  event: RoutineEvent | null
  day: number
  startMin: number
  mode: 'view' | 'edit'
}

const TYPE_LABEL: Record<EventType, string> = {
  school: 'Scolaire',
  personal: 'Personnel',
  business: 'Business',
}

export default function CalendarPage() {
  const { userId } = useApp()
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const today = weekdayIndex()

  const routines = useLiveQuery(
    () => (userId ? db.routines.where('userId').equals(userId).toArray() : []),
    [userId],
  )
  const subjects = useLiveQuery(
    () => (userId ? db.subjects.where('userId').equals(userId).toArray() : []),
    [userId],
  )

  const subjectColor = (id?: string) => subjects?.find((s) => s.id === id)?.color
  const subjectName = (id?: string) => subjects?.find((s) => s.id === id)?.name

  const byDay = useMemo(() => {
    const map: Record<number, RoutineEvent[]> = {}
    for (const d of DAYS) map[d] = []
    for (const ev of routines ?? []) {
      if (map[ev.day]) map[ev.day].push(ev)
    }
    for (const d of DAYS) map[d].sort((a, b) => a.startMin - b.startMin)
    return map
  }, [routines])

  const handleColumnClick = (e: MouseEvent<HTMLDivElement>, day: number) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const hour = Math.max(0, Math.min(23, Math.floor(y / HOUR_HEIGHT)))
    setDialog({ event: null, day, startMin: hour * 60, mode: 'edit' })
  }

  const eventLabel = (ev: RoutineEvent) =>
    ev.type === 'school' ? subjectName(ev.subjectId) ?? 'Matière' : ev.title || 'Sans titre'

  const eventColor = (ev: RoutineEvent) =>
    (ev.type === 'school' && subjectColor(ev.subjectId)) || TYPE_COLOR[ev.type]

  const total = routines?.length ?? 0

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Emploi du temps
          </h1>
          <p className="text-sm text-muted-foreground">
            Votre routine type, du lundi au dimanche.
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => setDialog({ event: null, day: today, startMin: 9 * 60, mode: 'edit' })}
        >
          <Plus className="size-4" /> Ajouter un événement
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <div className="min-w-[720px]">
          {/* Day header */}
          <div className="flex border-b border-border">
            <div className="w-12 shrink-0" />
            {DAYS.map((d) => (
              <div
                key={d}
                className={cn(
                  'flex-1 px-2 py-2.5 text-center',
                  d === today && 'bg-primary/5',
                )}
              >
                <span
                  className={cn(
                    'text-sm font-medium',
                    d === today ? 'text-primary' : 'text-foreground',
                  )}
                >
                  <span className="hidden sm:inline">{WEEKDAYS[d]}</span>
                  <span className="sm:hidden">{WEEKDAYS_SHORT[d]}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Grid body */}
          <div className="flex">
            {/* Time gutter */}
            <div className="relative w-12 shrink-0" style={{ height: HOUR_HEIGHT * 24 }}>
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute right-1.5 -translate-y-1.5 text-[11px] text-muted-foreground tabular-nums"
                  style={{ top: h * HOUR_HEIGHT }}
                >
                  {h.toString().padStart(2, '0')}h
                </div>
              ))}
            </div>

            {/* Day columns */}
            {DAYS.map((d) => (
              <div
                key={d}
                onClick={(e) => handleColumnClick(e, d)}
                className={cn(
                  'relative flex-1 cursor-pointer border-l border-border',
                  d === today && 'bg-primary/[0.03]',
                )}
                style={{ height: HOUR_HEIGHT * 24 }}
              >
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute inset-x-0 border-t border-border/60 first:border-t-0"
                    style={{ top: h * HOUR_HEIGHT }}
                  />
                ))}

                {byDay[d].map((ev) => {
                  const top = (ev.startMin / 60) * HOUR_HEIGHT
                  const height = Math.max(
                    22,
                    ((ev.endMin - ev.startMin) / 60) * HOUR_HEIGHT - 3,
                  )
                  const color = eventColor(ev)
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDialog({ event: ev, day: ev.day, startMin: ev.startMin, mode: 'view' })
                      }}
                      className="absolute inset-x-1 overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-left transition-colors hover:brightness-105"
                      style={{
                        top: top + 1.5,
                        height,
                        backgroundColor: `color-mix(in oklch, ${color} 16%, var(--card))`,
                        borderColor: color,
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span className="truncate text-xs font-medium leading-tight">{eventLabel(ev)}</span>
                        {ev.aiGenerated && (
                          <Sparkles className="size-3 text-primary shrink-0" aria-label="Généré par l'IA" />
                        )}
                      </div>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {minToTime(ev.startMin)}–{minToTime(ev.endMin)}
                      </p>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {total === 0 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4" /> Cliquez sur un créneau pour ajouter un
          événement à votre routine.
        </div>
      )}

      {dialog && (
        <Dialog open onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {dialog.mode === 'view'
                  ? "Détails de l'événement"
                  : dialog.event
                    ? "Modifier l'événement"
                    : 'Ajouter un événement'}
              </DialogTitle>
            </DialogHeader>
            {dialog.mode === 'view' && dialog.event ? (
              <EventView
                event={dialog.event}
                subjects={subjects ?? []}
                onEdit={() => setDialog({ ...dialog, mode: 'edit' })}
                onClose={() => setDialog(null)}
              />
            ) : (
              <EventDialog
                userId={userId!}
                event={dialog.event}
                defaultDay={dialog.day}
                defaultStartMin={dialog.startMin}
                subjects={subjects ?? []}
                onClose={() => setDialog(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function EventView({
  event,
  subjects,
  onEdit,
  onClose,
}: {
  event: RoutineEvent
  subjects: Subject[]
  onEdit: () => void
  onClose: () => void
}) {
  const subject = subjects.find((s) => s.id === event.subjectId)
  const color =
    (event.type === 'school' && subject?.color) || TYPE_COLOR[event.type]
  const heading =
    event.type === 'school' ? subject?.name ?? 'Matière' : event.title || 'Sans titre'

  return (
    <div className="flex flex-col gap-4 py-1">
      <div className="flex items-start gap-3">
        <span
          className="mt-1 size-3 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-heading text-lg font-semibold leading-tight">{heading}</h3>
            {event.aiGenerated && (
              <Sparkles className="size-4 text-primary shrink-0" aria-label="Généré par l'IA" />
            )}
          </div>
          <span
            className="mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `color-mix(in oklch, ${color} 16%, var(--card))`,
              color: color,
            }}
          >
            {TYPE_LABEL[event.type]}
          </span>
        </div>
      </div>

      <dl className="flex flex-col gap-2.5 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="size-4 shrink-0" />
          <span className="text-foreground">{WEEKDAYS[event.day]}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="size-4 shrink-0" />
          <span className="text-foreground tabular-nums">
            {minToTime(event.startMin)} – {minToTime(event.endMin)}
          </span>
        </div>
        {event.notes && (
          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-foreground">
            {event.notes}
          </p>
        )}
      </dl>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>
          Fermer
        </Button>
        <Button onClick={onEdit} className="gap-2">
          <Pencil className="size-4" /> Modifier
        </Button>
      </div>
    </div>
  )
}
