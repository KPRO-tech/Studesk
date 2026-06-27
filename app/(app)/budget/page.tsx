'use client'

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  Trash2,
  Target,
  Pencil,
  Smile,
  Meh,
  Frown,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import { db, uid, type Transaction, type Goal, type GoalKind } from '@/lib/db'
import { useApp } from '@/components/providers'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { startOfDay, startOfMonth, endOfMonth, DAY, formatDate, todayInputValue, localToTs } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Period = 'week' | 'month' | 'year'

function rangeFor(period: Period): [number, number] {
  const now = new Date()
  if (period === 'week') {
    const dow = (now.getDay() + 6) % 7
    const start = startOfDay(Date.now() - dow * DAY)
    return [start, start + 7 * DAY - 1]
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1).getTime()
    const end = new Date(now.getFullYear() + 1, 0, 1).getTime() - 1
    return [start, end]
  }
  return [startOfMonth(), endOfMonth()]
}

const PERIOD_LABEL: Record<Period, string> = {
  week: 'cette semaine',
  month: 'ce mois-ci',
  year: 'cette année',
}

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

type SpendStatus = 'good' | 'warning' | 'failed'

function spendStatusOf(ratio: number): SpendStatus {
  if (ratio >= 1) return 'failed'
  if (ratio >= 0.8) return 'warning'
  return 'good'
}

const STATUS_STYLE: Record<
  SpendStatus,
  { icon: typeof Smile; bar: string; text: string; ring: string; message: string }
> = {
  good: {
    icon: Smile,
    bar: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-500',
    ring: 'border-emerald-500/30 bg-emerald-500/5',
    message: 'Tout va bien, vous tenez votre budget.',
  },
  warning: {
    icon: Meh,
    bar: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-500',
    ring: 'border-amber-500/40 bg-amber-500/5',
    message: 'Attention, vous approchez de votre limite.',
  },
  failed: {
    icon: Frown,
    bar: 'bg-destructive',
    text: 'text-destructive',
    ring: 'border-destructive/40 bg-destructive/5',
    message: 'Objectif échoué : vous avez dépassé votre limite.',
  },
}

export default function BudgetPage() {
  const { userId, settings } = useApp()
  const locale = settings?.locale ?? 'fr-FR'
  const currency = settings?.currency ?? 'EUR'
  const [period, setPeriod] = useState<Period>('month')
  const [txDialog, setTxDialog] = useState<{ tx: Transaction | null; mode: 'view' | 'edit' } | null>(null)
  const [goalDialog, setGoalDialog] = useState<{ goal: Goal | null; kind: GoalKind } | null>(null)
  const [breakdown, setBreakdown] = useState<'expense' | 'income'>('expense')

  const fmt = (n: number) =>
    n.toLocaleString(locale, { style: 'currency', currency, maximumFractionDigits: 0 })

  const [from, to] = useMemo(() => rangeFor(period), [period])

  const txs = useLiveQuery(
    () =>
      userId
        ? db.transactions
          .where('userId')
          .equals(userId)
          .filter((t) => t.date >= from && t.date <= to)
          .toArray()
        : [],
    [userId, from, to],
  )
  const expenseCategories = useLiveQuery(
    () =>
      userId
        ? db.categories.where('userId').equals(userId).filter((c) => c.kind === 'expense').toArray()
        : [],
    [userId],
  )
  const incomeCategories = useLiveQuery(
    () =>
      userId
        ? db.categories.where('userId').equals(userId).filter((c) => c.kind === 'income').toArray()
        : [],
    [userId],
  )
  const goals = useLiveQuery(
    () => (userId ? db.goals.where('userId').equals(userId).toArray() : []),
    [userId],
  )

  const getPeriodLabel = (p: Period) => {
    const now = new Date()
    if (p === 'month') {
      const monthStr = now.toLocaleDateString('fr-FR', { month: 'long' })
      return `de ce mois (${monthStr})`
    }
    if (p === 'year') {
      return `de cette année (${now.getFullYear()})`
    }
    if (p === 'week') {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
      const start = new Date(now.setDate(diff))
      const end = new Date(now.setDate(diff + 6))
      const startStr = start.getDate()
      const endStr = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
      return `de cette semaine (du ${startStr} au ${endStr})`
    }
    return ''
  }

  const income = (txs ?? []).filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = (txs ?? []).filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expense

  const spendingGoal = (goals ?? []).find((g) => g.kind === 'spending') ?? null
  const goalPeriod = spendingGoal?.period || 'month'
  const [goalFrom, goalTo] = useMemo(() => rangeFor(goalPeriod), [goalPeriod])

  const goalTxs = useLiveQuery(
    () =>
      userId && spendingGoal
        ? db.transactions
          .where('userId')
          .equals(userId)
          .filter((t) => t.date >= goalFrom && t.date <= goalTo && t.type === 'expense')
          .toArray()
        : [],
    [userId, goalFrom, goalTo, spendingGoal],
  )
  const goalExpense = (goalTxs ?? []).reduce((s, t) => s + t.amount, 0)

  const savingsGoals = (goals ?? []).filter((g) => g.kind !== 'spending')

  const spendRatio = spendingGoal && spendingGoal.target > 0 ? goalExpense / spendingGoal.target : 0
  const spendStatus = spendStatusOf(spendRatio)

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of txs ?? []) {
      if (t.type !== breakdown) continue
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [txs, breakdown])
  const maxCat = byCategory[0]?.[1] ?? 0

  const recent = useMemo(
    () => [...(txs ?? [])].sort((a, b) => b.date - a.date).slice(0, 12),
    [txs],
  )

  const overLimit = spendingGoal != null && spendStatus === 'failed'

  const kpis = [
    { label: 'Revenus', value: fmt(income), icon: TrendingUp, tone: 'text-primary' },
    {
      label: 'Dépenses',
      value: fmt(expense),
      icon: TrendingDown,
      tone: overLimit ? 'text-destructive' : 'text-foreground',
    },
    {
      label: 'Solde',
      value: fmt(balance),
      icon: Wallet,
      tone: balance >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-destructive',
    },
  ]

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Budget"
        description="Suivez vos revenus, dépenses et objectifs."
        action={
          <Button onClick={() => setTxDialog({ tx: null, mode: 'edit' })} className="gap-2">
            <Plus className="size-4" /> Transaction
          </Button>
        }
      />

      {/* Period switch */}
      <div className="mb-6 inline-flex rounded-lg border border-border p-1">
        {(['week', 'month', 'year'] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : 'Année'}
          </button>
        ))}
      </div>

      {/* No-spend objective (distinct from savings goals, shown on top) */}
      <SpendingObjective
        goal={spendingGoal}
        spent={goalExpense}
        ratio={spendRatio}
        status={spendStatus}
        periodLabel={getPeriodLabel(goalPeriod as Period)}
        fmt={fmt}
        onEdit={() => setGoalDialog({ goal: spendingGoal, kind: 'spending' })}
      />

      {/* KPIs */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <Card
            key={k.label}
            className={cn(
              'flex items-center justify-between p-5',
              k.label === 'Dépenses' && overLimit && 'border-destructive/40',
            )}
          >
            <div>
              <p className="text-sm text-muted-foreground">{k.label}</p>
              <p className={cn('mt-1 font-heading text-2xl font-semibold tabular-nums', k.tone)}>
                {k.value}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <k.icon className="size-5" />
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Category breakdown (expense / income) */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-heading text-lg font-semibold">Par catégorie</h2>
            <div className="inline-flex rounded-lg border border-border p-0.5">
              {(['expense', 'income'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBreakdown(b)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    breakdown === b
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {b === 'expense' ? 'Dépenses' : 'Revenus'}
                </button>
              ))}
            </div>
          </div>
          <Card className="p-5">
            {byCategory.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {byCategory.map(([cat, amount], i) => (
                  <li key={cat}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{cat}</span>
                      <span className="tabular-nums text-muted-foreground">{fmt(amount)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${maxCat ? (amount / maxCat) * 100 : 0}%`,
                          backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {breakdown === 'expense'
                  ? 'Aucune dépense sur cette période.'
                  : 'Aucun revenu sur cette période.'}
              </p>
            )}
          </Card>
        </section>

        {/* Savings goals */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Objectifs d&apos;épargne</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setGoalDialog({ goal: null, kind: 'savings' })}
              className="gap-1.5"
            >
              <Plus className="size-3.5" /> Objectif
            </Button>
          </div>
          <Card className="divide-y divide-border p-0">
            {savingsGoals.length > 0 ? (
              savingsGoals.map((goal) => {
                const pct = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0
                const reached = goal.current >= goal.target && goal.target > 0
                return (
                  <div key={goal.id} className="p-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium">
                        {goal.title}
                        {reached && <Smile className="size-4 text-emerald-600 dark:text-emerald-500" />}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {fmt(goal.current)} / {fmt(goal.target)}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => setGoalDialog({ goal, kind: 'savings' })}
                          aria-label="Modifier l'objectif"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Target className="size-6 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">Aucun objectif d&apos;épargne.</p>
              </div>
            )}
          </Card>
        </section>
      </div>

      {/* Recent transactions */}
      <section className="mt-8">
        <h2 className="mb-3 font-heading text-lg font-semibold">Transactions récentes</h2>
        <Card className="divide-y divide-border p-0">
          {recent.length > 0 ? (
            recent.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTxDialog({ tx: t, mode: 'view' })}
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent"
              >
                <div
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg',
                    t.type === 'income' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive',
                  )}
                >
                  {t.type === 'income' ? (
                    <TrendingUp className="size-4" />
                  ) : (
                    <TrendingDown className="size-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.label || t.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.category} · {formatDate(t.date, locale)}
                    {t.goalId && (goals ?? []).some((g) => g.id === t.goalId) && (
                      <>
                        {' · '}
                        <span className="inline-flex items-center gap-1 text-primary">
                          <ArrowRight className="size-3" />
                          {(goals ?? []).find((g) => g.id === t.goalId)?.title}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 font-medium tabular-nums',
                    t.type === 'income' ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {t.type === 'income' ? '+' : '-'}
                  {fmt(t.amount)}
                </span>
              </button>
            ))
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucune transaction. Ajoutez-en une pour commencer.
            </p>
          )}
        </Card>
      </section>

      {txDialog && (
        <Dialog open onOpenChange={(o) => !o && setTxDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {txDialog.mode === 'view'
                  ? 'Détails de la transaction'
                  : txDialog.tx
                    ? 'Modifier la transaction'
                    : 'Nouvelle transaction'}
              </DialogTitle>
            </DialogHeader>
            {txDialog.mode === 'view' && txDialog.tx ? (
              <TransactionView
                tx={txDialog.tx}
                savingsGoals={savingsGoals}
                onEdit={() => setTxDialog({ ...txDialog, mode: 'edit' })}
                onClose={() => setTxDialog(null)}
              />
            ) : (
              <TransactionDialog
                userId={userId!}
                tx={txDialog.tx}
                expenseCategories={Array.from(new Set((expenseCategories ?? []).map((c) => c.name)))}
                incomeCategories={Array.from(new Set((incomeCategories ?? []).map((c) => c.name)))}
                savingsGoals={savingsGoals}
                onClose={() => setTxDialog(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
      {goalDialog && (
        <GoalDialog
          userId={userId!}
          goal={goalDialog.goal}
          kind={goalDialog.kind}
          onClose={() => setGoalDialog(null)}
        />
      )}
    </div>
  )
}

function SpendingObjective({
  goal,
  spent,
  ratio,
  status,
  periodLabel,
  fmt,
  onEdit,
}: {
  goal: Goal | null
  spent: number
  ratio: number
  status: SpendStatus
  periodLabel: string
  fmt: (n: number) => string
  onEdit: () => void
}) {
  if (!goal) {
    return (
      <Card className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="font-medium">Objectif de non-dépenses</p>
            <p className="text-sm text-muted-foreground">
              Fixez une limite à ne pas dépasser et suivez-la avec un indicateur.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={onEdit} className="gap-1.5">
          <Plus className="size-4" /> Définir une limite
        </Button>
      </Card>
    )
  }

  const style = STATUS_STYLE[status]
  const FaceIcon = style.icon
  const pct = Math.min(100, ratio * 100)
  const remaining = goal.target - spent

  return (
    <Card className={cn('border p-5', style.ring)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <FaceIcon className={cn('size-9 shrink-0', style.text)} />
          <div>
            <p className="flex items-center gap-2 font-medium">
              {goal.title || 'Limite de dépenses'}
            </p>
            <p className={cn('text-sm font-medium', style.text)}>{style.message}</p>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={onEdit}
          aria-label="Modifier la limite"
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="tabular-nums">
            {fmt(spent)} <span className="text-muted-foreground">/ {fmt(goal.target)}</span>
          </span>
          <span className={cn('tabular-nums font-medium', style.text)}>
            {remaining >= 0
              ? `${fmt(remaining)} restant`
              : `${fmt(Math.abs(remaining))} de dépassement`}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full transition-all', style.bar)} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Suivi des dépenses {periodLabel}.
        </p>
      </div>
    </Card>
  )
}

async function adjustGoalCurrent(goalId: string | undefined, delta: number) {
  if (!goalId || delta === 0) return
  const g = await db.goals.get(goalId)
  if (!g || g.kind === 'spending') return
  await db.goals.update(goalId, {
    current: Math.max(0, g.current + delta),
    updatedAt: Date.now(),
  })
}

function TransactionDialog({
  userId,
  tx,
  expenseCategories,
  incomeCategories,
  savingsGoals,
  onClose,
}: {
  userId: string
  tx: Transaction | null
  expenseCategories: string[]
  incomeCategories: string[]
  savingsGoals: Goal[]
  onClose: () => void
}) {
  const [type, setType] = useState<'income' | 'expense'>(tx?.type ?? 'expense')
  const [amount, setAmount] = useState(tx ? String(tx.amount) : '')
  const [label, setLabel] = useState(tx?.label ?? '')
  const activeCategories = type === 'income' ? incomeCategories : expenseCategories
  const [category, setCategory] = useState(tx?.category ?? '')
  const [goalId, setGoalId] = useState<string>(tx?.goalId ?? '')
  const [date, setDate] = useState(
    tx ? new Date(tx.date).toISOString().slice(0, 10) : todayInputValue(),
  )

  // Keep category valid when switching type.
  const effectiveCategory = activeCategories.includes(category)
    ? category
    : activeCategories[0] ?? 'Divers'

  const save = async () => {
    const value = Number(amount)
    if (!value || value <= 0) {
      toast.error('Saisissez un montant valide.')
      return
    }
    const now = Date.now()
    const newGoalId = goalId || undefined
    const payload = {
      type,
      amount: value,
      label: label.trim(),
      category: effectiveCategory,
      goalId: newGoalId,
      date: localToTs(date + 'T12:00'),
      sync: 'pending' as const,
    }
    if (tx) {
      // Reconcile savings goal contributions.
      await adjustGoalCurrent(tx.goalId, tx.type === 'expense' ? tx.amount : -tx.amount)
      await adjustGoalCurrent(newGoalId, type === 'expense' ? -value : value)
      await db.transactions.update(tx.id, payload)
    } else {
      await adjustGoalCurrent(newGoalId, type === 'expense' ? -value : value)
      await db.transactions.add({ id: uid(), userId, createdAt: now, ...payload })
    }
    if (newGoalId) toast.success('Transaction affectée à votre objectif.')
    onClose()
  }

  const remove = async () => {
    if (!tx) return
    await adjustGoalCurrent(tx.goalId, tx.type === 'expense' ? tx.amount : -tx.amount)
    await db.transactions.delete(tx.id)
    toast.success('Transaction supprimée.')
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tx ? 'Modifier la transaction' : 'Nouvelle transaction'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                  type === t ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
                )}
              >
                {t === 'expense' ? 'Dépense' : 'Revenu'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-amount">Montant</Label>
              <Input
                id="tx-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-date">Date</Label>
              <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Catégorie {type === 'income' ? '(revenu)' : '(dépense)'}</Label>
            <Select value={effectiveCategory} onValueChange={(v) => setCategory(v || activeCategories[0] || 'Divers')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeCategories.length > 0 ? (
                  activeCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="Divers">Divers</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {savingsGoals.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Affecter à un objectif (optionnel)</Label>
              <Select value={goalId || 'none'} onValueChange={(v) => setGoalId(!v || v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue>
                    {(value) =>
                      value === 'none' || !value
                        ? 'Aucun objectif'
                        : savingsGoals.find((g) => g.id === value)?.title ?? 'Aucun objectif'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun objectif</SelectItem>
                  {savingsGoals.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {goalId && (
                <p className="text-xs text-muted-foreground">
                  Le montant sera automatiquement soustrait (dépense) ou ajouté (revenu) à la progression de l&apos;objectif.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-label">Libellé</Label>
            <Input
              id="tx-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Optionnel"
            />
          </div>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {tx ? (
            <Button variant="ghost" className="text-destructive" onClick={remove}>
              <Trash2 className="size-4" /> Supprimer
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save}>{tx ? 'Enregistrer' : 'Ajouter'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GoalDialog({
  userId,
  goal,
  kind,
  onClose,
}: {
  userId: string
  goal: Goal | null
  kind: GoalKind
  onClose: () => void
}) {
  const isSpending = kind === 'spending'
  const [title, setTitle] = useState(goal?.title ?? (isSpending ? 'Limite de dépenses' : ''))
  const [target, setTarget] = useState(goal ? String(goal.target) : '')
  const [current, setCurrent] = useState(goal ? String(goal.current) : '0')
  const [period, setPeriod] = useState<Period>(goal?.period ?? 'month')

  const save = async () => {
    if (!isSpending && !title.trim()) {
      toast.error("Donnez un nom à l'objectif.")
      return
    }
    const t = Number(target)
    if (!t || t <= 0) {
      toast.error(isSpending ? 'Saisissez une limite valide.' : 'Saisissez un montant cible.')
      return
    }
    const now = Date.now()
    if (goal) {
      await db.goals.update(goal.id, {
        title: title.trim() || (isSpending ? 'Limite de dépenses' : ''),
        target: t,
        current: isSpending ? 0 : Number(current) || 0,
        period: isSpending ? period : undefined,
        updatedAt: now,
      })
    } else {
      await db.goals.add({
        id: uid(),
        userId,
        kind,
        title: title.trim() || (isSpending ? 'Limite de dépenses' : ''),
        target: t,
        current: isSpending ? 0 : Number(current) || 0,
        period: isSpending ? period : undefined,
        createdAt: now,
        updatedAt: now,
      })
    }
    onClose()
  }

  const remove = async () => {
    if (!goal) return
    await db.goals.delete(goal.id)
    toast.success(isSpending ? 'Limite supprimée.' : 'Objectif supprimé.')
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {goal
              ? isSpending
                ? 'Modifier la limite'
                : "Modifier l'objectif"
              : isSpending
                ? 'Limite de dépenses'
                : "Nouvel objectif d'épargne"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-title">{isSpending ? 'Nom (optionnel)' : 'Nom'}</Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isSpending ? 'Ex. Budget mensuel, Sorties...' : 'Ex. Épargne ordinateur'}
              autoFocus
            />
          </div>
          <div className={cn('grid gap-3', isSpending ? 'grid-cols-1' : 'grid-cols-2')}>
            {!isSpending && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="goal-current">Actuel</Label>
                <Input
                  id="goal-current"
                  type="number"
                  min="0"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              </div>
            )}

            {isSpending && (
              <div className="flex flex-col gap-1.5">
                <Label>Période</Label>
                <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                  <SelectTrigger>
                    <SelectItem value={period}>
                      {period === 'week' ? 'Par semaine' : period === 'month' ? 'Par mois' : 'Par année'}
                    </SelectItem>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Par semaine</SelectItem>
                    <SelectItem value="month">Par mois</SelectItem>
                    <SelectItem value="year">Par année</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-target">
                {isSpending ? 'Limite autorisée' : 'Montant cible'}
              </Label>
              <Input
                id="goal-target"
                type="number"
                min="0"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                autoFocus={isSpending}
              />
            </div>
          </div>
          {isSpending && (
            <p className="text-xs text-muted-foreground">
              Un indicateur vous préviendra dès que vos dépenses approchent ou dépassent cette
              limite sur la période sélectionnée.
            </p>
          )}
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {goal ? (
            <Button variant="ghost" className="text-destructive" onClick={remove}>
              <Trash2 className="size-4" /> Supprimer
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save}>{goal ? 'Enregistrer' : 'Créer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TransactionView({
  tx,
  savingsGoals,
  onEdit,
  onClose,
}: {
  tx: Transaction
  savingsGoals: Goal[]
  onEdit: () => void
  onClose: () => void
}) {
  const { settings } = useApp()
  const locale = settings?.locale ?? 'fr-FR'
  const currency = settings?.currency ?? 'EUR'
  const fmt = (n: number) => n.toLocaleString(locale, { style: 'currency', currency, maximumFractionDigits: 0 })

  const isIncome = tx.type === 'income'

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'flex size-12 items-center justify-center rounded-xl',
            isIncome ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive',
          )}
        >
          {isIncome ? <TrendingUp className="size-6" /> : <TrendingDown className="size-6" />}
        </div>
        <div>
          <h3 className="font-heading text-xl font-semibold">
            {tx.label || tx.category}
          </h3>
          <p className={cn('text-lg font-medium', isIncome ? 'text-primary' : 'text-foreground')}>
            {isIncome ? '+' : '-'}{fmt(tx.amount)}
          </p>
        </div>
      </div>

      <dl className="flex flex-col gap-2.5 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Date :</span>
          <span className="font-medium">{new Date(tx.date).toLocaleDateString(locale)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Catégorie :</span>
          <span className="font-medium">{tx.category}</span>
        </div>
        {tx.goalId && savingsGoals.some((g) => g.id === tx.goalId) && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Objectif :</span>
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              <Target className="size-3.5" />
              {savingsGoals.find((g) => g.id === tx.goalId)?.title}
            </span>
          </div>
        )}
      </dl>

      <div className="flex items-center justify-end gap-2 pt-2">
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
