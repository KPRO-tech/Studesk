'use client'

import { useRef, useState, useEffect, type FormEvent, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Sparkles,
  Send,
  Square,
  WifiOff,
  Copy,
  Check,
  Paperclip,
  FileText,
  X,
  ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '@/components/providers'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useOnline } from '@/lib/use-online'
import { db, uid, type AiMessage } from '@/lib/db'
import { getAvatarIcon } from '@/lib/avatar-icons'
import { extractPdfText } from '@/lib/pdf'
import { AI_PRESETS, DEFAULT_MODEL, FREE_MODELS, type ChatMessage } from '@/lib/ai'
import { getDatabaseContext, buildAgentSystemPrompt, parseActions, cleanAgentResponse, executeAction } from '@/lib/ai-agent'
import { cn } from '@/lib/utils'

interface PdfContext {
  name: string
  text: string
  pages: number
}

const TITLE_MAX = 48

function makeTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= TITLE_MAX) return clean || 'Nouvelle conversation'
  return clean.slice(0, TITLE_MAX).trimEnd() + '…'
}

export default function AiChatPage() {
  const { userId, settings } = useApp()
  const online = useOnline()
  const params = useParams()
  const router = useRouter()

  const idParam = params.id as string
  const isNew = idParam === 'new'

  const [activeId, setActiveId] = useState<string>(isNew ? uid() : idParam)
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [title, setTitle] = useState('Nouvelle conversation')
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [pdf, setPdf] = useState<PdfContext | null>(null)
  const [parsingPdf, setParsingPdf] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const apiKey = settings?.openrouterApiKey?.trim() ?? ''
  const savedModel = settings?.openrouterModel?.trim() ?? ''
  const activeModel = savedModel || DEFAULT_MODEL
  const modelLabel =
    FREE_MODELS.find((m) => m.id === activeModel)?.label ?? activeModel
  const AvatarIcon = getAvatarIcon(settings?.avatarIcon)

  // Load existing conversation if not "new"
  useEffect(() => {
    if (isNew) {
      setHasLoaded(true)
      return
    }
    const load = async () => {
      const conv = await db.conversations.get(idParam)
      if (conv) {
        setMessages(conv.messages)
        setTitle(conv.title)
      } else {
        toast.error('Conversation introuvable.')
        router.replace('/ai')
      }
      setHasLoaded(true)
    }
    load()
  }, [idParam, isNew, router])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
  }

  const persist = async (id: string, msgs: AiMessage[], firstUserText: string) => {
    if (!userId) return
    const now = Date.now()
    const existing = await db.conversations.get(id)
    if (existing) {
      await db.conversations.update(id, { messages: msgs, updatedAt: now })
    } else {
      const newTitle = makeTitle(firstUserText)
      setTitle(newTitle)
      await db.conversations.add({
        id,
        userId,
        title: newTitle,
        messages: msgs,
        createdAt: now,
        updatedAt: now,
      })
      // If it was "new", we gracefully replace the URL without reloading
      if (isNew) {
        window.history.replaceState(null, '', `/ai/${id}`)
      }
    }
  }

  const onPickPdf = async (file: File | undefined) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Choisis un fichier PDF.')
      return
    }
    setParsingPdf(true)
    try {
      const { text, pages } = await extractPdfText(file)
      setPdf({ name: file.name, text, pages })
      toast.success(`PDF importé — ${pages} page${pages > 1 ? 's' : ''}.`)
    } catch {
      toast.error("Impossible de lire ce PDF (texte introuvable).")
    } finally {
      setParsingPdf(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const send = async (text: string) => {
    const content = text.trim()
    if ((!content && !pdf) || streaming) return
    if (!online) {
      toast.error("Hors ligne — l'assistant IA nécessite une connexion.")
      return
    }
    if (!userId) return

    const displayContent = pdf 
      ? `[PDF: ${pdf.name} | ${pdf.pages} p.]\n\n${content || `Analyse le document « ${pdf.name} ».`}`
      : content
    const userMsg: AiMessage = { id: uid(), role: 'user', content: displayContent }
    const assistantId = uid()
    const history = [...messages, userMsg]

    setMessages([...history, { id: assistantId, role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    const pdfForRequest = pdf
    setPdf(null)

    await persist(activeId, history, history[0]?.content ?? displayContent)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const dbContext = await getDatabaseContext(userId)
      const systemPrompt = buildAgentSystemPrompt(dbContext)

      const payload: ChatMessage[] = history.map((m, i) => {
        if (i === history.length - 1 && pdfForRequest) {
          return {
            role: 'user',
            content: `${m.content}\n\n--- Contenu du document « ${pdfForRequest.name} » ---\n${pdfForRequest.text}`,
          }
        }
        return { role: m.role, content: m.content }
      })
      payload.unshift({ role: 'system', content: systemPrompt })

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload, apiKey, model: savedModel }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.message ?? 'Une erreur est survenue.')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let acc = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') continue
          try {
            const json = JSON.parse(data)
            const delta = json.choices?.[0]?.delta?.content
            if (typeof delta === 'string' && delta) {
              acc += delta
              const cleaned = cleanAgentResponse(acc)
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: cleaned } : m)),
              )
            }
          } catch {
            /* ignore */
          }
        }
      }

      // At the end, clean the text and extract actions
      const finalRaw = acc || 'Aucune réponse reçue. Réessaie.'
      const actionsProposed = parseActions(finalRaw)
      const cleanedContent = cleanAgentResponse(finalRaw)

      const finalMsgs: AiMessage[] = [
        ...history,
        {
          id: assistantId,
          role: 'assistant',
          content: cleanedContent,
          actionsProposed: actionsProposed.length > 0 ? actionsProposed : undefined
        },
      ]
      setMessages(finalMsgs)
      await persist(activeId, finalMsgs, history[0]?.content ?? displayContent)
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setMessages((prev) => {
          void persist(activeId, prev, history[0]?.content ?? displayContent)
          return prev
        })
      } else {
        const message = (e as Error).message
        toast.error(message)
        const errMsgs: AiMessage[] = [
          ...history,
          { id: assistantId, role: 'assistant', content: `⚠️ ${message}` },
        ]
        setMessages(errMsgs)
        await persist(activeId, errMsgs, history[0]?.content ?? displayContent)
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(input)
  }

  if (!hasLoaded) {
    return null // Could be a skeleton/spinner
  }

  const empty = messages.length === 0

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-4xl flex-col">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/ai')} className="shrink-0">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="truncate font-heading text-xl font-semibold">{title}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="font-normal text-[10px] py-0">
              {modelLabel}
            </Badge>
            <span>{apiKey ? 'Clé personnelle' : 'Modèle gratuit par défaut'}</span>
            {!online && (
              <span className="inline-flex items-center gap-1 text-destructive">
                <WifiOff className="size-3.5" />
                Hors ligne
              </span>
            )}
          </div>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col p-0">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {empty ? (
            <EmptyState onPick={(p) => setInput(p)} />
          ) : (
            <div className="flex flex-col gap-6">
              {messages.map((m) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  streaming={streaming}
                  avatar={<AvatarIcon className="size-4" />}
                  onExecuteActions={async (actions) => {
                    if (!userId) return
                    let successCount = 0
                    for (const action of actions) {
                      const res = await executeAction(action, userId)
                      if (res.success) successCount++
                      else toast.error(`Erreur: ${res.message}`)
                    }
                    if (successCount > 0) toast.success(`${successCount} action(s) effectuée(s) !`)
                    // Update the message state
                    setMessages(prev => {
                      const updated = prev.map(msg =>
                        msg.id === m.id
                          ? { ...msg, actionsApproved: true, actionsExecuted: successCount }
                          : msg
                      )
                      void persist(activeId, updated, updated[0]?.content ?? '')
                      return updated
                    })
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="border-t border-border p-3 sm:p-4">
          {pdf && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{pdf.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {pdf.pages} p.
              </span>
              <button
                type="button"
                onClick={() => setPdf(null)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Retirer le PDF"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => onPickPdf(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!online || parsingPdf || streaming}
              onClick={() => fileRef.current?.click()}
              aria-label="Joindre un PDF"
            >
              {parsingPdf ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Paperclip className="size-4" />
              )}
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(input)
                }
              }}
              placeholder={
                online ? 'Pose ta question…' : "Connexion requise pour l'assistant IA"
              }
              disabled={!online}
              rows={1}
              className="max-h-40 min-h-[44px] resize-none"
            />
            {streaming ? (
              <Button type="button" variant="outline" size="icon" onClick={stop}>
                <Square className="size-4" />
                <span className="sr-only">Arrêter</span>
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={(!input.trim() && !pdf) || !online}
              >
                <Send className="size-4" />
                <span className="sr-only">Envoyer</span>
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex h-auto flex-col items-center justify-center gap-6 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Sparkles className="size-6" />
      </div>
      <div className="max-w-sm">
        <h2 className="font-heading text-lg font-semibold">Comment puis-je t&apos;aider ?</h2>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Colle un cours, importe un PDF ou pose une question. Choisis un raccourci
          pour démarrer.
        </p>
      </div>
      <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {AI_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.prompt)}
            className="flex flex-col gap-0.5 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/50"
          >
            <span className="text-sm font-medium">{p.label}</span>
            <span className="text-xs text-muted-foreground">{p.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageRow({
  message,
  streaming,
  avatar,
  onExecuteActions,
}: {
  message: AiMessage
  streaming: boolean
  avatar: ReactNode
  onExecuteActions?: (actions: import('@/lib/db').AiAction[]) => void
}) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const copy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg',
          isUser ? 'bg-muted text-primary' : 'bg-primary text-primary-foreground',
        )}
      >
        {isUser ? avatar : <Sparkles className="size-4" />}
      </div>
      <div className={cn('group min-w-0 max-w-[85%]', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded-xl px-4 py-2.5 text-sm leading-relaxed',
            isUser ? 'bg-secondary text-primary' : 'bg-muted/50',
          )}
        >
          {message.content ? (
            <FormattedText content={message.content} />
          ) : (
            <span className="inline-flex gap-1">
              <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
            </span>
          )}

          {/* Action Approval UI */}
          {!isUser && message.actionsProposed && message.actionsProposed.length > 0 && (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                Actions Proposées
              </h4>
              <ul className="mb-3 flex flex-col gap-1 text-sm">
                {message.actionsProposed.map((act, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <div className="size-1.5 rounded-full bg-primary/50" />
                    <span>
                      <strong className="mr-1 font-medium">{act.type}</strong>
                      <span className="text-muted-foreground">dans la collection</span>{' '}
                      <code>{act.collection}</code>
                    </span>
                  </li>
                ))}
              </ul>
              {message.actionsApproved ? (
                <div className="flex items-center gap-2 text-xs font-medium text-green-600 dark:text-green-400">
                  <Check className="size-4" />
                  {message.actionsExecuted ?? 0} action(s) exécutée(s) avec succès.
                </div>
              ) : (
                <Button
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => onExecuteActions?.(message.actionsProposed!)}
                >
                  <Sparkles className="size-4" /> Approuver et exécuter
                </Button>
              )}
            </div>
          )}

        </div>
        {!isUser && message.content && !streaming && (
          <button
            type="button"
            onClick={copy}
            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? 'Copié' : 'Copier'}
          </button>
        )}
      </div>
    </div>
  )
}

function Dot({ delay = '0ms' }: { delay?: string }) {
  return (
    <span
      className="inline-block size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
      style={{ animationDelay: delay }}
    />
  )
}

/** Lightweight Markdown-ish renderer: headings, bold, lists, paragraphs. */
function FormattedText({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((line, i) => {
        const key = `${i}-${line.slice(0, 8)}`
        
        const pdfMatch = line.match(/^\[PDF:\s*(.+?)\s*\|\s*(.+?)\]$/)
        if (pdfMatch) {
          return (
            <div key={key} className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm max-w-fit">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{pdfMatch[1]}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{pdfMatch[2]}</span>
            </div>
          )
        }
        
        const heading = line.match(/^(#{1,4})\s+(.*)$/)
        if (heading) {
          return (
            <p key={key} className="font-heading text-sm font-semibold">
              {renderInline(heading[2])}
            </p>
          )
        }
        const bullet = line.match(/^\s*[-*]\s+(.*)$/)
        if (bullet) {
          return (
            <div key={key} className="flex gap-2 pl-1">
              <span className="text-muted-foreground">•</span>
              <span>{renderInline(bullet[1])}</span>
            </div>
          )
        }
        const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/)
        if (numbered) {
          return (
            <div key={key} className="flex gap-2 pl-1">
              <span className="tabular-nums text-muted-foreground">{numbered[1]}.</span>
              <span>{renderInline(numbered[2])}</span>
            </div>
          )
        }
        if (line.trim() === '') return <div key={key} className="h-1" />
        return <p key={key}>{renderInline(line)}</p>
      })}
    </div>
  )
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      )
    }
    return <span key={i}>{part}</span>
  })
}
