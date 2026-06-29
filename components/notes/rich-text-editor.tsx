'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Cmd = {
  icon: typeof Bold
  label: string
  /** execCommand name */
  command: string
  /** queryCommandState key for active styling (optional) */
  state?: string
  value?: string
}

const GROUPS: Cmd[][] = [
  [
    { icon: Bold, label: 'Gras', command: 'bold', state: 'bold' },
    { icon: Italic, label: 'Italique', command: 'italic', state: 'italic' },
    { icon: Underline, label: 'Souligné', command: 'underline', state: 'underline' },
    { icon: Strikethrough, label: 'Barré', command: 'strikeThrough', state: 'strikeThrough' },
  ],
  [
    { icon: List, label: 'Liste à puces', command: 'insertUnorderedList', state: 'insertUnorderedList' },
    { icon: ListOrdered, label: 'Liste numérotée', command: 'insertOrderedList', state: 'insertOrderedList' },
  ],
  [
    { icon: AlignLeft, label: 'Aligner à gauche', command: 'justifyLeft', state: 'justifyLeft' },
    { icon: AlignCenter, label: 'Centrer', command: 'justifyCenter', state: 'justifyCenter' },
    { icon: AlignRight, label: 'Aligner à droite', command: 'justifyRight', state: 'justifyRight' },
  ],
]

export function RichTextEditor({
  initialHtml,
  onChange,
  placeholder = 'Commencez à écrire…',
  sanitizeHtml,
  sanitizePlainText,
}: {
  initialHtml: string
  onChange: (html: string) => void
  placeholder?: string
  sanitizeHtml?: (html: string) => string
  sanitizePlainText?: (text: string) => string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<Record<string, boolean>>({})
  const [empty, setEmpty] = useState(!initialHtml)

  // Initialize content once.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== initialHtml) {
      ref.current.innerHTML = initialHtml
      setEmpty(!ref.current.textContent?.trim() && !initialHtml)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshState = useCallback(() => {
    const next: Record<string, boolean> = {}
    for (const group of GROUPS) {
      for (const cmd of group) {
        if (cmd.state) {
          try {
            next[cmd.state] = document.queryCommandState(cmd.state)
          } catch {
            next[cmd.state] = false
          }
        }
      }
    }
    try {
      next.h1 = document.queryCommandValue('formatBlock').toLowerCase() === 'h1'
      next.h2 = document.queryCommandValue('formatBlock').toLowerCase() === 'h2'
    } catch {
      next.h1 = false
      next.h2 = false
    }
    setActive(next)
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', refreshState)
    return () => document.removeEventListener('selectionchange', refreshState)
  }, [refreshState])

  const emit = () => {
    if (!ref.current) return
    if (sanitizeHtml) {
      const sanitized = sanitizeHtml(ref.current.innerHTML)
      if (sanitized !== ref.current.innerHTML) {
        ref.current.innerHTML = sanitized
        placeCaretAtEnd(ref.current)
      }
    }
    setEmpty(!ref.current.textContent?.trim() && !ref.current.querySelector('img,hr'))
    onChange(ref.current.innerHTML)
  }

  const exec = (command: string, value?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, value)
    refreshState()
    emit()
  }

  const toggleHeading1 = () => {
    const isH1 = active.h1
    exec('formatBlock', isH1 ? 'P' : 'H1')
  }

  const toggleHeading = () => {
    const isH2 = active.h2
    exec('formatBlock', isH2 ? 'P' : 'H2')
  }

  const insertLink = () => {
    const url = window.prompt('Adresse du lien (URL)')
    if (!url) return
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
    ref.current?.focus()
    const sel = window.getSelection()
    if (sel && sel.toString().trim()) {
      document.execCommand('createLink', false, href)
    } else {
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${href}">${href}</a>`,
      )
    }
    emit()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-border bg-card/80 px-1 py-1.5 backdrop-blur">
        <ToolbarButton label="Grand Titre" active={active.h1} onClick={toggleHeading1}>
          <Heading1 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Titre" active={active.h2} onClick={toggleHeading}>
          <Heading2 className="size-4" />
        </ToolbarButton>
        <Divider />
        {GROUPS[0].map((c) => (
          <ToolbarButton
            key={c.command}
            label={c.label}
            active={c.state ? active[c.state] : false}
            onClick={() => exec(c.command, c.value)}
          >
            <c.icon className="size-4" />
          </ToolbarButton>
        ))}
        <Divider />
        {GROUPS[1].map((c) => (
          <ToolbarButton
            key={c.command}
            label={c.label}
            active={c.state ? active[c.state] : false}
            onClick={() => exec(c.command, c.value)}
          >
            <c.icon className="size-4" />
          </ToolbarButton>
        ))}
        <Divider />
        {GROUPS[2].map((c) => (
          <ToolbarButton
            key={c.command}
            label={c.label}
            active={c.state ? active[c.state] : false}
            onClick={() => exec(c.command, c.value)}
          >
            <c.icon className="size-4" />
          </ToolbarButton>
        ))}
        <Divider />
        <ToolbarButton label="Insérer un lien" onClick={insertLink}>
          <Link2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Séparateur" onClick={() => exec('insertHorizontalRule')}>
          <Minus className="size-4" />
        </ToolbarButton>
      </div>

      {/* Editable area */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {empty && (
          <p className="pointer-events-none absolute left-0 top-3 text-base text-muted-foreground/50">
            {placeholder}
          </p>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Contenu de la note"
          onInput={emit}
          onPaste={(event) => {
            if (!sanitizePlainText) return
            event.preventDefault()
            const text = event.clipboardData.getData('text/plain')
            document.execCommand('insertText', false, sanitizePlainText(text))
            emit()
          }}
          onKeyUp={refreshState}
          onMouseUp={refreshState}
          onBlur={emit}
          className="rte-content min-h-[280px] py-3 text-base leading-relaxed outline-none"
        />
      </div>
    </div>
  )
}

function placeCaretAtEnd(element: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      // Prevent stealing focus / losing the selection before the command runs.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        active && 'bg-accent text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
}
