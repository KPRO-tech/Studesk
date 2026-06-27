'use client'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, ListChecks, Trash2, Check, X, Tag as TagIcon, Pencil, Sparkles } from 'lucide-react'
import { db, uid, type Task, type Tag } from '@/lib/db'
import { useApp } from '@/components/providers'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { isPast, isToday, formatRelativeDay, todayInputValue, localToTs, DAY } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
const MAX_TAGS_GLOBAL = 50
const MAX_TAGS_PER_TASK = 4
type Urgency = 'overdue' | 'today' | 'upcoming' | 'none'
function urgencyOf(task: Task): Urgency {
    if (task.dueDate == null) return 'none'
    if (isPast(task.dueDate)) return 'overdue'
    if (isToday(task.dueDate)) return 'today'
    return 'upcoming'
}
const URGENCY_RANK: Record<Urgency, number> = {
    overdue: 0,
    today: 1,
    upcoming: 2,
    none: 3,
}
export default function TasksPage() {
    const { userId } = useApp()
    const [dialog, setDialog] = useState<{ task: Task | null; mode: 'view' | 'edit' } | null>(null)
    const [activeTags, setActiveTags] = useState<string[]>([])
    const tasks = useLiveQuery(
        () => (userId ? db.tasks.where('userId').equals(userId).toArray() : []),
        [userId],
    )
    const tags = useLiveQuery(
        () => (userId ? db.tags.where('userId').equals(userId).toArray() : []),
        [userId],
    )
    const categories = useLiveQuery(
        () =>
            userId
                ? db.categories.where('userId').equals(userId).filter((c) => c.kind === 'task').toArray()
                : [],
        [userId],
    )
    const tagMap = useMemo(() => new Map((tags ?? []).map((t) => [t.id, t])), [tags])
    const visible = useMemo(() => {
        let list = tasks ?? []
        if (activeTags.length > 0) {
            list = list.filter((t) => t.tagIds.some((id) => activeTags.includes(id)))
        }
        return list
    }, [tasks, activeTags])
    // Group by category, hide empty categories, sort within by urgency then date.
    const columns = useMemo(() => {
        const groups = new Map<string, Task[]>()
        for (const t of visible) {
            const key = t.category || 'Sans catégorie'
            if (!groups.has(key)) groups.set(key, [])
            groups.get(key)!.push(t)
        }
        for (const arr of groups.values()) {
            arr.sort((a, b) => {
                // done last
                if ((a.status === 'done') !== (b.status === 'done'))
                    return a.status === 'done' ? 1 : -1
                const ua = urgencyOf(a)
                const ub = urgencyOf(b)
                if (ua !== ub) return URGENCY_RANK[ua] - URGENCY_RANK[ub]
                return (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity)
            })
        }
        // Order columns by their most urgent task
        return [...groups.entries()].sort((a, b) => {
            const minRank = (arr: Task[]) =>
                Math.min(...arr.map((t) => URGENCY_RANK[urgencyOf(t)]))
            return minRank(a[1]) - minRank(b[1])
        })
    }, [visible])
    const toggleFilter = (id: string) =>
        setActiveTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
    const toggleDone = (task: Task) =>
        db.tasks.update(task.id, {
            status: task.status === 'done' ? 'todo' : 'done',
            completedAt: task.status === 'done' ? undefined : Date.now(),
            updatedAt: Date.now(),
            sync: 'pending',
        })
    const removeTask = async (task: Task) => {
        await db.tasks.delete(task.id)
        toast.success('Tâche supprimée.')
    }
    return (
        <div className="mx-auto max-w-6xl">
            <PageHeader
                title="Tâches"
                description="Organisées par catégorie. Les tâches en retard remontent automatiquement."
                action={
                    <Button
                        onClick={() => setDialog({ task: null, mode: 'edit' })}
                        className="gap-2"
                    >
                        <Plus className="size-4" /> Nouvelle tâche
                    </Button>
                }
            />
            {/* Tag filters */}
            {tags && tags.length > 0 && (
                <div className="mb-6 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <TagIcon className="size-3.5" /> Filtrer :
                    </span>
                    {tags.map((tag) => {
                        const active = activeTags.includes(tag.id)
                        return (
                            <button
                                key={tag.id}
                                type="button"
                                onClick={() => toggleFilter(tag.id)}
                                className={cn(
                                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                                    active ? 'border-transparent text-primary-foreground' : 'border-border hover:bg-accent',
                                )}
                                style={active ? { backgroundColor: tag.color } : undefined}
                            >
                                <span
                                    className="size-2 rounded-full"
                                    style={{ backgroundColor: active ? 'currentColor' : tag.color }}
                                />
                                {tag.name}
                            </button>
                        )
                    })}
                    {activeTags.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setActiveTags([])}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                            <X className="size-3" /> Réinitialiser
                        </button>
                    )}
                </div>
            )}
            {columns.length > 0 ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {columns.map(([category, items]) => (
                        <section key={category}>
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                    {category}
                                </h2>
                                <span className="text-xs text-muted-foreground">{items.length}</span>
                            </div>
                            <ul className="flex flex-col gap-2">
                                {items.map((task) => (
                                    <li key={task.id}>
                                        <TaskCard
                                            task={task}
                                            tagMap={tagMap}
                                            onToggle={() => toggleDone(task)}
                                            onView={() => setDialog({ task, mode: 'view' })}
                                            onEdit={() => setDialog({ task, mode: 'edit' })}
                                            onDelete={() => removeTask(task)}
                                        />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
                    <ListChecks className="size-8 text-muted-foreground/60" />
                    <p className="text-sm text-muted-foreground">
                        {activeTags.length > 0 ? 'Aucune tâche pour ces tags.' : 'Aucune tâche pour le moment.'}
                    </p>
                </div>
            )}
            {dialog && (
                <Dialog open onOpenChange={(o) => !o && setDialog(null)}>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                {dialog.mode === 'view'
                                    ? 'Détails de la tâche'
                                    : dialog.task
                                        ? 'Modifier la tâche'
                                        : 'Nouvelle tâche'}
                            </DialogTitle>
                        </DialogHeader>
                        {dialog.mode === 'view' && dialog.task ? (
                            <TaskView
                                task={dialog.task}
                                tagMap={tagMap}
                                onEdit={() => setDialog({ ...dialog, mode: 'edit' })}
                                onClose={() => setDialog(null)}
                            />
                        ) : (
                            <TaskDialog
                                userId={userId!}
                                task={dialog.task}
                                categories={(categories ?? []).map((c) => c.name)}
                                tags={tags ?? []}
                                onClose={() => setDialog(null)}
                            />
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}
function TaskCard({
    task,
    tagMap,
    onToggle,
    onView,
    onEdit,
    onDelete,
}: {
    task: Task
    tagMap: Map<string, Tag>
    onToggle: () => void
    onView: () => void
    onEdit: () => void
    onDelete: () => void
}) {
    const urgency = urgencyOf(task)
    const done = task.status === 'done'
    return (
        <Card
            className={cn(
                'group flex items-start gap-3 p-3 transition-colors',
                urgency === 'overdue' && !done && 'border-destructive/40',
            )}
            onClick={onView}
        >
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    onToggle()
                }}
                className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                    done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 hover:border-primary',
                )}
                aria-label={done ? 'Marquer à faire' : 'Marquer terminé'}
            >
                {done && <Check className="size-3" />}
            </button>
            <button type="button" className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-1.5">
                    <p className={cn('font-medium', done && 'text-muted-foreground line-through')}>
                        {task.title}
                    </p>
                    {task.aiGenerated && (
                        <Sparkles className="size-3 text-primary shrink-0" aria-label="Généré par l'IA" />
                    )}
                </div>
                {task.dueDate != null && (
                    <p
                        className={cn(
                            'mt-0.5 text-xs font-medium',
                            done
                                ? 'text-muted-foreground'
                                : urgency === 'overdue'
                                    ? 'text-destructive'
                                    : urgency === 'today'
                                        ? 'text-amber-600 dark:text-amber-500'
                                        : 'text-muted-foreground',
                        )}
                    >
                        {formatRelativeDay(task.dueDate)}
                    </p>
                )}
                {task.tagIds.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                        {task.tagIds.map((id) => {
                            const tag = tagMap.get(id)
                            if (!tag) return null
                            return (
                                <span
                                    key={id}
                                    className="flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[11px]"
                                >
                                    <span className="size-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                                    {tag.name}
                                </span>
                            )
                        })}
                    </div>
                )}
            </button>
            <div className="flex shrink-0 items-center gap-0.5">
                <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                        e.stopPropagation()
                        onEdit()
                    }}
                    aria-label="Modifier la tâche"
                >
                    <Pencil className="size-3.5" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                        e.stopPropagation()
                        onDelete()
                    }}
                    aria-label="Supprimer la tâche"
                >
                    <Trash2 className="size-3.5" />
                </Button>
            </div>
        </Card>
    )
}

function TaskDialog({
    userId,
    task,
    categories,
    tags,
    onClose,
}: {
    userId: string
    task: Task | null
    categories: string[]
    tags: Tag[]
    onClose: () => void
}) {
    const [title, setTitle] = useState(task?.title ?? '')
    const [notes, setNotes] = useState(task?.notes ?? '')
    const [category, setCategory] = useState(task?.category ?? categories[0] ?? 'Général')
    const [due, setDue] = useState(
        task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
    )
    const [selectedTags, setSelectedTags] = useState<string[]>(task?.tagIds ?? [])
    const [newTag, setNewTag] = useState('')
    const today = todayInputValue()
    const toggleTag = (id: string) => {
        setSelectedTags((prev) => {
            if (prev.includes(id)) return prev.filter((t) => t !== id)
            if (prev.length >= MAX_TAGS_PER_TASK) {
                toast.error(`Maximum ${MAX_TAGS_PER_TASK} tags par tâche.`)
                return prev
            }
            return [...prev, id]
        })
    }
    const createTag = async () => {
        const name = newTag.trim()
        if (!name) return
        if (tags.length >= MAX_TAGS_GLOBAL) {
            toast.error(`Maximum ${MAX_TAGS_GLOBAL} tags au total.`)
            return
        }
        if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
            toast.error('Ce tag existe déjà.')
            return
        }
        const id = uid()
        const palette = ['oklch(0.6 0.13 250)', 'oklch(0.6 0.13 150)', 'oklch(0.62 0.16 25)', 'oklch(0.7 0.13 70)']
        await db.tags.add({
            id,
            userId,
            name,
            color: palette[tags.length % palette.length],
            createdAt: Date.now(),
        })
        setNewTag('')
        if (selectedTags.length < MAX_TAGS_PER_TASK) setSelectedTags((p) => [...p, id])
    }
    const save = async () => {
        if (!title.trim()) {
            toast.error('Donnez un titre à la tâche.')
            return
        }
        let dueDate: number | undefined
        if (due) {
            dueDate = localToTs(due + 'T12:00')
            // Block past dates (allow today).
            if (dueDate < Date.now() - DAY) {
                toast.error('Impossible de choisir une date passée.')
                return
            }
        }
        const now = Date.now()
        if (task) {
            await db.tasks.update(task.id, {
                title: title.trim(),
                notes,
                category,
                dueDate,
                tagIds: selectedTags,
                updatedAt: now,
                sync: 'pending',
            })
        } else {
            await db.tasks.add({
                id: uid(),
                userId,
                title: title.trim(),
                notes,
                status: 'todo',
                category,
                dueDate,
                tagIds: selectedTags,
                createdAt: now,
                updatedAt: now,
                sync: 'pending',
            })
        }
        onClose()
    }
    const remove = async () => {
        if (!task) return
        await db.tasks.delete(task.id)
        toast.success('Tâche supprimée.')
        onClose()
    }
    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{task ? 'Modifier la tâche' : 'Nouvelle tâche'}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="task-title">Titre</Label>
                        <Input
                            id="task-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <Label>Catégorie</Label>
                            <Select value={category} onValueChange={(v) => setCategory(v || categories[0] || 'Général')}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.length > 0 ? (
                                        categories.map((c) => (
                                            <SelectItem key={c} value={c}>
                                                {c}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="Général">Général</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="task-due">Échéance</Label>
                            <Input
                                id="task-due"
                                type="date"
                                min={today}
                                value={due}
                                onChange={(e) => setDue(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label>Tags ({selectedTags.length}/{MAX_TAGS_PER_TASK})</Label>
                        <div className="flex flex-wrap gap-1.5">
                            {tags.map((tag) => {
                                const active = selectedTags.includes(tag.id)
                                return (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => toggleTag(tag.id)}
                                        className={cn(
                                            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                                            active ? 'border-transparent text-primary-foreground' : 'border-border hover:bg-accent',
                                        )}
                                        style={active ? { backgroundColor: tag.color } : undefined}
                                    >
                                        <span
                                            className="size-2 rounded-full"
                                            style={{ backgroundColor: active ? 'currentColor' : tag.color }}
                                        />
                                        {tag.name}
                                    </button>
                                )
                            })}
                        </div>
                        <div className="mt-1 flex gap-2">
                            <Input
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        createTag()
                                    }
                                }}
                                placeholder="Nouveau tag…"
                                className="h-8"
                            />
                            <Button type="button" size="sm" variant="outline" onClick={createTag}>
                                Ajouter
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="task-notes">Notes</Label>
                        <Textarea
                            id="task-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="resize-none"
                            placeholder="Optionnel"
                        />
                    </div>
                </div>
                <DialogFooter className="flex-row justify-between sm:justify-between">
                    {task ? (
                        <Button variant="ghost" className="text-destructive" onClick={remove}>
                            <Trash2 className="size-4" /> Supprimer
                        </Button>
                    ) : (
                        <span />
                    )}
                    <Button onClick={save}>{task ? 'Enregistrer' : 'Créer'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
function TaskView({
    task,
    tagMap,
    onEdit,
    onClose,
}: {
    task: Task
    tagMap: Map<string, Tag>
    onEdit: () => void
    onClose: () => void
}) {
    const urgency = urgencyOf(task)
    const done = task.status === 'done'
    return (
        <div className="flex flex-col gap-4 py-2">
            <div>
                <h3 className={cn('font-heading text-xl font-semibold', done && 'line-through text-muted-foreground')}>
                    {task.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                    Catégorie : {task.category}
                </p>
            </div>
            <dl className="flex flex-col gap-2.5 text-sm">
                {task.dueDate != null && (
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Échéance :</span>
                        <span
                            className={cn(
                                'font-medium',
                                done
                                    ? 'text-muted-foreground'
                                    : urgency === 'overdue'
                                        ? 'text-destructive'
                                        : urgency === 'today'
                                            ? 'text-amber-600 dark:text-amber-500'
                                            : 'text-foreground',
                            )}
                        >
                            {formatRelativeDay(task.dueDate)}
                        </span>
                    </div>
                )}
                {task.tagIds.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Tags :</span>
                        <div className="flex flex-wrap gap-1">
                            {task.tagIds.map((id) => {
                                const tag = tagMap.get(id)
                                if (!tag) return null
                                return (
                                    <span
                                        key={id}
                                        className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs"
                                    >
                                        <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                        {tag.name}
                                    </span>
                                )
                            })}
                        </div>
                    </div>
                )}
                {task.notes && (
                    <div className="mt-2">
                        <span className="text-muted-foreground">Notes :</span>
                        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-foreground">
                            {task.notes}
                        </p>
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