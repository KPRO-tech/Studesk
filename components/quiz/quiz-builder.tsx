'use client'

import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Check,
  ChevronLeft,
  Tag as TagIcon,
  Upload,
  FileText,
  X,
} from 'lucide-react'
import { db, uid, type Quiz, type QuizQuestion, type Subject } from '@/lib/db'
import {
  completeChat,
  buildQuizPrompt,
  buildQuizPromptWithSubject,
  parseQuizJson,
  parseQuizWithSubject,
  SYSTEM_PROMPT,
} from '@/lib/ai'
import { extractPdfText } from '@/lib/pdf'
import { useApp } from '@/components/providers'
import { useOnline } from '@/lib/use-online'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const SUBJECT_PALETTE = [
  'oklch(0.6 0.13 250)',
  'oklch(0.6 0.13 150)',
  'oklch(0.62 0.16 25)',
  'oklch(0.7 0.13 70)',
  'oklch(0.6 0.1 200)',
  'oklch(0.62 0.13 300)',
]

function emptyQuestion(): QuizQuestion {
  return { id: uid(), question: '', options: ['', ''], correct: [], explanation: '' }
}

export function QuizBuilder({
  quiz,
  onDone,
  onCancel,
}: {
  quiz: Quiz | null
  onDone: () => void
  onCancel: () => void
}) {
  const { userId, settings } = useApp()
  const [title, setTitle] = useState(quiz?.title ?? '')
  const [subjectId, setSubjectId] = useState<string | undefined>(quiz?.subjectId)
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    quiz?.questions.length ? quiz.questions : [emptyQuestion()],
  )

  const subjects = useLiveQuery(
    () => (userId ? db.subjects.where('userId').equals(userId).toArray() : []),
    [userId],
  )

  const update = (id: string, patch: Partial<QuizQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)))

  /** Find a subject by name (case-insensitive) or create it, return its id. */
  const resolveSubject = async (name: string): Promise<string | undefined> => {
    if (!userId) return undefined
    const existing = (subjects ?? []).find(
      (s) => s.name.toLowerCase() === name.trim().toLowerCase(),
    )
    if (existing) return existing.id
    const id = uid()
    await db.subjects.add({
      id,
      userId,
      name: name.trim(),
      color: SUBJECT_PALETTE[(subjects?.length ?? 0) % SUBJECT_PALETTE.length],
      createdAt: Date.now(),
    })
    return id
  }

  const save = async () => {
    if (!userId) return
    if (!title.trim()) {
      toast.error('Donnez un titre au quiz.')
      return
    }
    const clean = questions
      .map((q) => ({ ...q, options: q.options.filter((o) => o.trim() !== '') }))
      .filter((q) => q.question.trim() && q.options.length >= 2 && q.correct.length > 0)
    if (clean.length === 0) {
      toast.error('Ajoutez au moins une question complète avec une bonne réponse.')
      return
    }
    const now = Date.now()
    if (quiz) {
      await db.quizzes.update(quiz.id, {
        title: title.trim(),
        subjectId: subjectId || undefined,
        questions: clean,
        updatedAt: now,
        sync: 'pending',
      })
    } else {
      await db.quizzes.add({
        id: uid(),
        userId,
        title: title.trim(),
        subjectId: subjectId || undefined,
        questions: clean,
        createdAt: now,
        updatedAt: now,
        sync: 'pending',
      })
    }
    toast.success('Quiz enregistré.')
    onDone()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={onCancel} aria-label="Retour">
          <ChevronLeft className="size-4" />
        </Button>
        <h1 className="flex-1 font-heading text-xl font-semibold">
          {quiz ? 'Modifier le quiz' : 'Créer un quiz'}
        </h1>
        <Button onClick={save}>Enregistrer</Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="quiz-title">Titre</Label>
          <Input
            id="quiz-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. Chapitre 3 — La Révolution française"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Matière</Label>
          <SubjectPicker
            userId={userId ?? ''}
            subjects={subjects ?? []}
            value={subjectId}
            onChange={setSubjectId}
          />
        </div>
      </div>

      <Tabs defaultValue="manual">
        <TabsList className="mb-4">
          <TabsTrigger value="manual">Manuel</TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="mr-1.5 size-3.5" /> IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai">
          <AiGenerator
            apiKey={settings?.openrouterApiKey}
            model={settings?.openrouterModel}
            onGenerated={async (qs, detectedSubject, suggestedTitle) => {
              setQuestions(qs)
              if (detectedSubject && !subjectId) {
                const id = await resolveSubject(detectedSubject)
                if (id) setSubjectId(id)
              }
              if (suggestedTitle && !title) {
                setTitle(suggestedTitle)
              }
            }}
          />
          {questions.some((q) => q.question) && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Les questions générées apparaissent dans l&apos;onglet « Manuel » pour
              relecture.
            </p>
          )}
        </TabsContent>

        <TabsContent value="manual">
          <div className="flex flex-col gap-4">
            {questions.map((q, qi) => (
              <QuestionEditor
                key={q.id}
                question={q}
                index={qi}
                canDelete={questions.length > 1}
                onChange={(patch) => update(q.id, patch)}
                onDelete={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))}
              />
            ))}
            <Button
              variant="outline"
              onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}
              className="gap-2"
            >
              <Plus className="size-4" /> Ajouter une question
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SubjectPicker({
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
    if (!name || !userId) return
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
      <PopoverTrigger render={<Button variant="outline" className="h-10 gap-1.5 sm:w-44 sm:justify-start" />}>
          {current ? (
            <>
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: current.color }}
              />
              <span className="truncate">{current.name}</span>
            </>
          ) : (
            <>
              <TagIcon className="size-3.5" />
              Aucune
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
            <span className="text-muted-foreground">Aucune matière</span>
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
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-primary transition-colors hover:bg-accent"
            >
              <Plus className="size-3.5" /> Créer « {query.trim()} »
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function QuestionEditor({
  question,
  index,
  canDelete,
  onChange,
  onDelete,
}: {
  question: QuizQuestion
  index: number
  canDelete: boolean
  onChange: (patch: Partial<QuizQuestion>) => void
  onDelete: () => void
}) {
  const setOption = (i: number, value: string) => {
    const options = [...question.options]
    options[i] = value
    onChange({ options })
  }
  const toggleCorrect = (i: number) => {
    const correct = question.correct.includes(i)
      ? question.correct.filter((c) => c !== i)
      : [...question.correct, i]
    onChange({ correct })
  }
  const addOption = () =>
    question.options.length < 6 && onChange({ options: [...question.options, ''] })
  const removeOption = (i: number) => {
    if (question.options.length <= 2) return
    const options = question.options.filter((_, idx) => idx !== i)
    const correct = question.correct
      .filter((c) => c !== i)
      .map((c) => (c > i ? c - 1 : c))
    onChange({ options, correct })
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Question {index + 1}
        </span>
        {canDelete && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label="Supprimer la question"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <Textarea
        value={question.question}
        onChange={(e) => onChange({ question: e.target.value })}
        placeholder="Énoncé de la question"
        className="mb-3 resize-none"
      />
      <p className="mb-1.5 text-xs text-muted-foreground">
        Cochez la (ou les) bonne(s) réponse(s).
      </p>
      <div className="flex flex-col gap-2">
        {question.options.map((opt, i) => {
          const correct = question.correct.includes(i)
          return (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleCorrect(i)}
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors',
                  correct ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent',
                )}
                aria-label="Marquer comme correcte"
              >
                {correct && <Check className="size-3.5" />}
              </button>
              <Input
                value={opt}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`Proposition ${String.fromCharCode(65 + i)}`}
                className="h-9"
              />
              {question.options.length > 2 && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0 text-muted-foreground"
                  onClick={() => removeOption(i)}
                  aria-label="Retirer la proposition"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          )
        })}
      </div>
      {question.options.length < 6 && (
        <Button variant="ghost" size="sm" onClick={addOption} className="mt-2 gap-1.5">
          <Plus className="size-3.5" /> Proposition
        </Button>
      )}
      <Input
        value={question.explanation ?? ''}
        onChange={(e) => onChange({ explanation: e.target.value })}
        placeholder="Explication (optionnel)"
        className="mt-3 h-9"
      />
    </Card>
  )
}

type GenMode = 'prompt' | 'note' | 'pdf'

function AiGenerator({
  apiKey,
  model,
  onGenerated,
}: {
  apiKey?: string
  model?: string
  onGenerated: (qs: QuizQuestion[], detectedSubject?: string, suggestedTitle?: string) => void
}) {
  const { userId } = useApp()
  const online = useOnline()
  const [mode, setMode] = useState<GenMode>('prompt')
  const [source, setSource] = useState('')
  const [noteId, setNoteId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [extra, setExtra] = useState('')
  const [count, setCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const notes = useLiveQuery(
    () => (userId ? db.notes.where('userId').equals(userId).toArray() : []),
    [userId],
  )

  const toQuestions = (
    parsed: { question: string; options: string[]; correct: number[]; explanation?: string }[],
  ): QuizQuestion[] =>
    parsed.map((p) => ({
      id: uid(),
      question: p.question,
      options: p.options,
      correct: p.correct.filter((c) => c < p.options.length),
      explanation: p.explanation ?? '',
    }))

  const generate = async () => {
    if (!online) {
      toast.error('La génération IA nécessite une connexion.')
      return
    }
    setLoading(true)
    try {
      if (mode === 'pdf') {
        if (!file) {
          toast.error('Sélectionnez un fichier PDF.')
          return
        }
        const { text } = await extractPdfText(file)
        const raw = await completeChat(
          [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildQuizPromptWithSubject(text, count, extra) },
          ],
          { apiKey, model },
        )
        const { subject, questions } = parseQuizWithSubject(raw)
        onGenerated(toQuestions(questions), subject, file.name.replace(/\.pdf$/i, ''))
        toast.success(
          subject
            ? `${questions.length} questions générées · matière : ${subject}.`
            : `${questions.length} questions générées.`,
        )
        return
      }

      let content = source.trim()
      let suggestedTitle = content.split('\n')[0].slice(0, 40)
      if (mode === 'note') {
        const note = notes?.find((n) => n.id === noteId)
        if (!note) {
          toast.error('Sélectionnez une fiche.')
          return
        }
        content = `${note.title}\n\n${note.content}`
        suggestedTitle = note.title || suggestedTitle
      }
      if (!content) {
        toast.error('Indiquez un sujet ou une fiche.')
        return
      }
      const raw = await completeChat(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildQuizPrompt(content, count) },
        ],
        { apiKey, model },
      )
      const parsed = parseQuizJson(raw)
      onGenerated(toQuestions(parsed), undefined, suggestedTitle)
      toast.success(`${parsed.length} questions générées. Vérifiez-les dans « Manuel ».`)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      toast.error(
        message === 'empty_pdf'
          ? 'PDF illisible ou vide. Essayez un autre fichier.'
          : message && !['no_json', 'empty', 'not_array'].includes(message)
            ? message
            : "L'IA n'a pas renvoyé de quiz exploitable. Réessayez.",
      )
    } finally {
      setLoading(false)
    }
  }

  const MODES: { key: GenMode; label: string }[] = [
    { key: 'prompt', label: 'Sujet / texte' },
    { key: 'note', label: 'Depuis une fiche' },
    { key: 'pdf', label: 'Depuis un PDF' },
  ]

  return (
    <Card className="flex flex-col gap-4 p-4">
      {!online && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Hors ligne : la génération IA est indisponible. Vous pouvez toujours créer le
          quiz manuellement.
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={cn(
              'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
              mode === m.key ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'prompt' && (
        <Textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Collez un cours, un texte, ou décrivez le sujet du quiz…"
          className="min-h-28 resize-none"
        />
      )}

      {mode === 'note' && (
        <Select value={noteId} onValueChange={(v) => setNoteId(v || '')}>
          <SelectTrigger>
            <SelectValue placeholder="Choisir une fiche" />
          </SelectTrigger>
          <SelectContent>
            {(notes ?? []).filter((n) => n.content.trim()).map((n) => (
              <SelectItem key={n.id} value={n.id}>
                {n.title || 'Sans titre'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {mode === 'pdf' && (
        <div className="flex flex-col gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 shrink-0"
                onClick={() => {
                  setFile(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
                aria-label="Retirer le fichier"
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              className="gap-2"
            >
              <Upload className="size-4" /> Choisir un fichier PDF
            </Button>
          )}
          <Textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="Consigne supplémentaire (optionnel) — ex. « Concentre-toi sur le chapitre 2 »"
            className="min-h-20 resize-none"
          />
          <p className="text-xs text-muted-foreground">
            L&apos;IA détecte automatiquement la matière à partir du contenu du PDF.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Label htmlFor="q-count" className="text-sm">
          Nombre de questions
        </Label>
        <Input
          id="q-count"
          type="number"
          min={1}
          max={20}
          value={count}
          onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
          className="h-9 w-20"
        />
      </div>

      <Button onClick={generate} disabled={loading || !online} className="gap-2">
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Génération…
          </>
        ) : (
          <>
            <Sparkles className="size-4" /> Générer le quiz
          </>
        )}
      </Button>
    </Card>
  )
}
