'use client'

import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Layers,
  ListChecks,
  Wallet,
  CalendarDays,
  Clock,
  ArrowRight,
  ArrowUpRight,
  GraduationCap,
  CheckCircle2,
  BookOpen,
  SquarePen,
} from 'lucide-react'
import { db } from '@/lib/db'
import { useApp } from '@/components/providers'
import { LiveClock } from '@/components/live-clock'
import { Card } from '@/components/ui/card'
import {
  startOfMonth,
  endOfMonth,
  formatRelativeDay,
  isPast,
  weekdayIndex,
  minToTime,
  DAY,
} from '@/lib/dates'
import { cn } from '@/lib/utils'

const EVENT_LABEL: Record<string, string> = {
  school: 'Scolaire',
  personal: 'Personnel',
  business: 'Business',
}

export default function DashboardPage() {
  const { userId, user, settings } = useApp()
  const locale = settings?.locale ?? 'fr-FR'
  const currency = settings?.currency ?? 'EUR'
  const now = Date.now()

  const dueCards = useLiveQuery(
    () =>
      userId
        ? db.cards.where('userId').equals(userId).filter((c) => c.dueDate <= now || c.lastResult === 'again').count()
        : 0,
    [userId],
  )
  const pendingTasks = useLiveQuery(
    () =>
      userId
        ? db.tasks.where('userId').equals(userId).filter((t) => t.status !== 'done').count()
        : 0,
    [userId],
  )
  const monthExpenses = useLiveQuery(async () => {
    if (!userId) return 0
    const from = startOfMonth()
    const to = endOfMonth()
    const tx = await db.transactions
      .where('userId')
      .equals(userId)
      .filter((t) => t.type === 'expense' && t.date >= from && t.date <= to)
      .toArray()
    return tx.reduce((s, t) => s + t.amount, 0)
  }, [userId])

  const today = weekdayIndex()
  const todayEvents = useLiveQuery(async () => {
    if (!userId) return []
    const list = await db.routines
      .where('userId')
      .equals(userId)
      .filter((r) => r.day === today)
      .toArray()
    return list.sort((a, b) => a.startMin - b.startMin)
  }, [userId, today])

  const subjects = useLiveQuery(
    () => (userId ? db.subjects.where('userId').equals(userId).toArray() : []),
    [userId],
  )
  const subjectName = (id?: string) => subjects?.find((s) => s.id === id)?.name

  const upcoming = useLiveQuery(async () => {
    if (!userId) return []
    const horizon = now + 7 * DAY
    const tasks = await db.tasks
      .where('userId')
      .equals(userId)
      .filter((t) => t.status !== 'done' && t.dueDate != null && t.dueDate <= horizon)
      .toArray()
    return tasks.sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0)).slice(0, 6)
  }, [userId])

  const stats = [
    {
      label: 'Cartes à réviser',
      value: dueCards ?? 0,
      icon: Layers,
      href: '/flashcards',
    },
    {
      label: 'Tâches en attente',
      value: pendingTasks ?? 0,
      icon: ListChecks,
      href: '/tasks',
    },
    {
      label: 'Dépenses du mois',
      value: (monthExpenses ?? 0).toLocaleString(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }),
      icon: Wallet,
      href: '/budget',
    },
  ]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-balance">
          {greeting}, {user?.firstName}
        </h1>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="flex flex-row items-center justify-between p-5 transition-colors hover:border-primary/40">
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-1 font-heading text-2xl font-semibold">
                  {s.value}
                </p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <s.icon className="size-5 text-primary" />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Sections */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Today */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            <h2 className="font-heading text-lg font-semibold">Aujourd&apos;hui</h2>
          </div>
          <Card className="divide-y divide-border p-0">
            {todayEvents && todayEvents.length > 0 ? (
              todayEvents.map((e) => {
                const label =
                  e.type === 'school'
                    ? subjectName(e.subjectId) ?? 'Matière'
                    : e.title || 'Sans titre'
                return (
                  <div key={e.id} className="flex items-center gap-3 p-4">
                    <div className="flex flex-col items-center text-xs text-muted-foreground tabular-nums">
                      <Clock className="mb-1 size-3.5" />
                      {minToTime(e.startMin)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">
                        {EVENT_LABEL[e.type] ?? e.type}
                      </p>
                    </div>
                  </div>
                )
              })
            ) : (
              <EmptyRow icon={CalendarDays} text="Aucun événement aujourd'hui" />
            )}
          </Card>
        </section>

        {/* Upcoming */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <ArrowRight className="size-4 text-primary" />
            <h2 className="font-heading text-lg font-semibold">À venir</h2>
          </div>
          <Card className="divide-y divide-border p-0">
            {upcoming && upcoming.length > 0 ? (
              upcoming.map((t) => {
                const overdue = t.dueDate != null && isPast(t.dueDate)
                return (
                  <div key={t.id} className="flex items-center gap-3 p-4">
                    <CheckCircle2
                      className={cn(
                        'size-4 shrink-0',
                        overdue ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.category}</p>
                    </div>
                    {t.dueDate != null && (
                      <span
                        className={cn(
                          'shrink-0 text-xs font-medium',
                          overdue ? 'text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {formatRelativeDay(t.dueDate, locale)}
                      </span>
                    )}
                  </div>
                )
              })
            ) : (
              <EmptyRow icon={GraduationCap} text="Rien de prévu dans les 7 jours" />
            )}
          </Card>
        </section>
      </div>

      {/* Quick links */}
      <section className="mt-8">
        <h2 className="mb-3 font-heading text-lg font-semibold">Accès rapides</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="group flex items-start gap-4 p-5 transition-colors hover:border-primary/40 hover:bg-accent/40">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <link.icon className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-semibold">{link.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{link.desc}</p>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

const QUICK_LINKS = [
  { href: '/notes', title: 'Fiches & cours', desc: 'Notes, audio, résumés.', icon: BookOpen },
  { href: '/flashcards', title: 'Flashcards', desc: 'Répétition espacée SM-2.', icon: Layers },
  { href: '/quiz', title: 'Quiz', desc: 'QCM auto-corrigés.', icon: ListChecks },
  { href: '/calendar', title: 'Emploi du temps', desc: 'Semaine type.', icon: CalendarDays },
  { href: '/tasks', title: 'Devoirs & to-do', desc: 'Échéances, examens.', icon: SquarePen },
  { href: '/budget', title: 'Budget', desc: 'Dépenses & objectifs.', icon: Wallet },
] as const

function EmptyRow({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>
  text: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Icon className="size-6 text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
