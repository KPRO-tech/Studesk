'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus,
  Search,
  Trash2,
  Pin,
  PinOff,
  FileDown,
  FileText,
  ArrowLeft,
  Tag as TagIcon,
  ArrowDownUp,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { db, uid, type Note, type Subject } from '@/lib/db'
import { useApp } from '@/components/providers'
import { RichTextEditor } from '@/components/notes/rich-text-editor'
import { VisibilityToggle } from '@/components/community/visibility-toggle'
import { ImportedBadge } from '@/components/community/imported-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toEditorHtml, htmlToText } from '@/lib/richtext'
import {
  exportNotePdf,
  isUnsupportedPdfContentError,
  sanitizePdfHtml,
  sanitizePdfPlainText,
  type PdfUnsupportedCharacter,
} from '@/lib/pdf'
import { formatRelativeDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type SortKey = 'updated' | 'created' | 'title'

const SORT_LABEL: Record<SortKey, string> = {
  updated: 'Récemment modifiées',
  created: 'Récemment créées',
  title: 'Titre (A→Z)',
}
import { SubjectPicker } from '@/components/subject-picker'

export default function NotesPage() {
  const { userId } = useApp()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('updated')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const [activeId, setActiveId] = useState<string | null>(null)

  const notes = useLiveQuery(
    () => (userId ? db.notes.where('userId').equals(userId).toArray() : []),
    [userId],
  )
  const subjects = useLiveQuery(
    () => (userId ? db.subjects.where('userId').equals(userId).toArray() : []),
    [userId],
  )

  const subjectById = useMemo(() => {
    const map = new Map<string, Subject>()
    for (const s of subjects ?? []) map.set(s.id, s)
    return map
  }, [subjects])

  const filtered = useMemo(() => {
    if (!notes) return []
    const q = search.trim().toLowerCase()
    let list = notes
    if (subjectFilter !== 'all') {
      list =
        subjectFilter === 'none'
          ? list.filter((n) => !n.subjectId)
          : list.filter((n) => n.subjectId === subjectFilter)
    }
    if (q) {
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          htmlToText(n.content).toLowerCase().includes(q),
      )
    }
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'created') return b.createdAt - a.createdAt
      return b.updatedAt - a.updatedAt
    })
  }, [notes, search, sort, subjectFilter])

  const active = notes?.find((n) => n.id === activeId) ?? null

  const create = async () => {
    if (!userId) return
    const now = Date.now()
    const note: Note = {
      id: uid(),
      userId,
      title: '',
      content: '',
      subjectId: subjectFilter !== 'all' && subjectFilter !== 'none' ? subjectFilter : undefined,
      pinned: false,
      createdAt: now,
      updatedAt: now,
      sync: 'pending',
    }
    await db.notes.add(note)
    setActiveId(note.id)
  }

  return (
    <div className="mx-auto h-full max-w-6xl">
      <div className="grid h-full gap-0 overflow-hidden rounded-xl border border-border md:grid-cols-[340px_1fr]">
        {/* List + filters */}
        <div
          className={cn(
            'flex min-h-0 flex-col border-border md:border-r',
            active && 'hidden md:flex',
          )}
        >
          <div className="flex flex-col gap-2.5 border-b border-border p-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher une note…"
                  className="pl-8"
                />
              </div>
              <Button size="icon" onClick={create} aria-label="Nouvelle note">
                <Plus className="size-4" />
              </Button>
            </div>

            {/* Sort + subject filters */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {filtered.length} note{filtered.length > 1 ? 's' : ''}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" />}
                >
                  <ArrowDownUp className="size-3.5" />
                  {SORT_LABEL[sort]}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={sort}
                    onValueChange={(v) => setSort(v as SortKey)}
                  >
                    {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                      <DropdownMenuRadioItem key={k} value={k}>
                        {SORT_LABEL[k]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              <FilterChip
                label="Toutes"
                active={subjectFilter === 'all'}
                onClick={() => setSubjectFilter('all')}
              />
              {(subjects ?? []).map((s) => (
                <FilterChip
                  key={s.id}
                  label={s.name}
                  color={s.color}
                  active={subjectFilter === s.id}
                  onClick={() => setSubjectFilter(s.id)}
                />
              ))}
              <FilterChip
                label="Sans matière"
                active={subjectFilter === 'none'}
                onClick={() => setSubjectFilter('none')}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length > 0 ? (
              <ul className="divide-y divide-border">
                {filtered.map((n) => {
                  const subject = n.subjectId ? subjectById.get(n.subjectId) : undefined
                  const preview = htmlToText(n.content)
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(n.id)}
                        className={cn(
                          'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-accent',
                          activeId === n.id && 'bg-accent',
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          {n.pinned && (
                            <Pin className="size-3 shrink-0 fill-primary text-primary" />
                          )}
                          <span className="truncate font-medium">
                            {n.title || 'Sans titre'}
                          </span>
                          {n.aiGenerated && (
                            <Sparkles className="size-3 text-primary shrink-0" aria-label="Généré par l'IA" />
                          )}
                          <ImportedBadge importedFrom={n.importedFrom} />
                        </div>
                        <span className="truncate text-xs text-muted-foreground">
                          {preview.slice(0, 70) || 'Aucun contenu'}
                        </span>
                        <div className="flex items-center gap-2">
                          {subject && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: subject.color }}
                              />
                              {subject.name}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground">
                            {formatRelativeDay(n.updatedAt)}
                          </span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
                <FileText className="size-7 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">
                  {search || subjectFilter !== 'all'
                    ? 'Aucun résultat.'
                    : 'Aucune note pour le moment.'}
                </p>
                {!search && subjectFilter === 'all' && (
                  <Button variant="outline" size="sm" onClick={create} className="mt-1">
                    <Plus className="size-4" /> Créer une note
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className={cn('min-h-0', !active && 'hidden md:block')}>
          {active ? (
            <NoteEditor
              key={active.id}
              note={active}
              userId={userId!}
              subjects={subjects ?? []}
              onClose={() => setActiveId(null)}
              onDelete={() => setActiveId(null)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
              <FileText className="size-8 text-muted-foreground/50" />
              <p className="text-sm">Sélectionnez une note ou créez-en une.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string
  color?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border text-muted-foreground hover:bg-accent',
      )}
    >
      {color && (
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      {label}
    </button>
  )
}

function NoteEditor({
  note,
  userId,
  subjects,
  onClose,
  onDelete,
}: {
  note: Note
  userId: string
  subjects: Subject[]
  onClose: () => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [saved, setSaved] = useState(true)
  const [unsupportedPdfChars, setUnsupportedPdfChars] = useState<
    PdfUnsupportedCharacter[]
  >([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Autosave with 400ms debounce
  useEffect(() => {
    if (title === note.title && content === note.content) return
    setSaved(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      await db.notes.update(note.id, {
        title,
        content,
        updatedAt: Date.now(),
        sync: 'pending',
      })
      setSaved(true)
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [title, content, note.id, note.title, note.content])

  const togglePin = () =>
    db.notes.update(note.id, { pinned: !note.pinned, updatedAt: Date.now() })

  const remove = async () => {
    await db.audio.where('noteId').equals(note.id).delete()
    await db.notes.delete(note.id)
    toast.success('Note supprimée.')
    onDelete()
  }

  const [exporting, setExporting] = useState(false)

  const exportPdf = async () => {
    setExporting(true)
    setUnsupportedPdfChars([])
    try {
      await exportNotePdf({
        title,
        html: content,
        updatedAt: note.updatedAt,
      })
    } catch (err) {
      console.log('[v0] PDF export failed:', err)
      if (isUnsupportedPdfContentError(err)) {
        setUnsupportedPdfChars(err.issues)
        return
      }
      toast.error("L'export PDF a échoué.")
    } finally {
      setExporting(false)
    }
  }

  const setSubject = (subjectId: string | undefined) =>
    db.notes.update(note.id, { subjectId, updatedAt: Date.now(), sync: 'pending' })

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button
          size="icon"
          variant="ghost"
          className="size-8 md:hidden"
          onClick={onClose}
          aria-label="Retour"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <SubjectPicker
          userId={userId}
          subjects={subjects}
          value={note.subjectId}
          onChange={setSubject}
        />
        <span className="flex-1 text-right text-xs text-muted-foreground">
          {saved ? 'Enregistré' : 'Enregistrement…'}
        </span>
        <VisibilityToggle
          value={note.visibility}
          onChange={(v) =>
            db.notes.update(note.id, { visibility: v, updatedAt: Date.now(), sync: 'pending' })
          }
        />
        <Button size="icon" variant="ghost" className="size-8" onClick={togglePin} aria-label="Épingler">
          {note.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          onClick={exportPdf}
          disabled={exporting}
          aria-label="Exporter en PDF"
        >
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 text-muted-foreground hover:text-destructive"
          onClick={remove}
          aria-label="Supprimer"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pt-4">
        <input
          value={title}
          onChange={(e) => setTitle(sanitizePdfPlainText(e.target.value))}
          placeholder="Titre"
          className="w-full shrink-0 bg-transparent font-heading text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
        />
        <div className="mt-2 flex min-h-0 flex-1 flex-col">
          <RichTextEditor
            initialHtml={toEditorHtml(note.content)}
            onChange={(nextHtml) => setContent(sanitizePdfHtml(nextHtml))}
            sanitizeHtml={sanitizePdfHtml}
            sanitizePlainText={sanitizePdfPlainText}
          />
        </div>
      </div>
      <UnsupportedPdfDialog
        issues={unsupportedPdfChars}
        onOpenChange={(open) => {
          if (!open) setUnsupportedPdfChars([])
        }}
      />
    </div>
  )
}

function UnsupportedPdfDialog({
  issues,
  onOpenChange,
}: {
  issues: PdfUnsupportedCharacter[]
  onOpenChange: (open: boolean) => void
}) {
  const hasEmoji = issues.some((issue) => issue.reason === 'emoji')
  const hasControl = issues.some((issue) => issue.reason === 'control')
  const hasUnsupported = issues.some((issue) => issue.reason === 'unsupported')

  return (
    <Dialog open={issues.length > 0} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export PDF impossible</DialogTitle>
          <DialogDescription>
            Certains caractères de cette note ne sont pas compatibles avec
            l'export PDF texte. Supprimez-les avant de télécharger le fichier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {hasEmoji && <li>Emojis ou pictogrammes.</li>}
            {hasControl && <li>Caractères invisibles ou de contrôle.</li>}
            {hasUnsupported && <li>Symboles non pris en charge par le PDF.</li>}
          </ul>

          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Caractères détectés
            </p>
            <div className="flex flex-wrap gap-1.5">
              {issues.map((issue) => (
                <span
                  key={issue.codePoint}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                >
                  {issue.reason === 'control' ? 'invisible' : issue.char}{' '}
                  <span className="text-muted-foreground">{issue.codePoint}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Compris</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
