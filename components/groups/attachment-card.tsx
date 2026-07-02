'use client'

import { Layers, ListChecks, FileText, Check, Loader2, Eye, Download } from 'lucide-react'
import type { GroupAttachment } from '@/lib/db'
import { KIND_LABEL } from '@/lib/marketplace'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const KIND_ICON = {
    note: FileText,
    deck: Layers,
    quiz: ListChecks,
} as const

function metaLabel(att: GroupAttachment): string {
    if (att.kind === 'deck') {
        const n = att.deck?.cards.length ?? 0
        return `${n} carte${n > 1 ? 's' : ''}`
    }
    if (att.kind === 'quiz') {
        const n = att.quiz?.questions.length ?? 0
        return `${n} question${n > 1 ? 's' : ''}`
    }
    return 'Fiche de cours'
}

export function AttachmentCard({
    attachment,
    own,
    importing,
    imported,
    onPreview,
    onImport,
    className,
}: {
    attachment: GroupAttachment
    /** true when the current user sent this attachment */
    own: boolean
    importing?: boolean
    imported?: boolean
    onPreview: () => void
    onImport: () => void
    className?: string
}) {
    const Icon = KIND_ICON[attachment.kind]

    return (
        <div
            className={cn(
                'flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3',
                className,
            )}
        >
            <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="size-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-pretty">{attachment.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="text-[11px]">
                            {KIND_LABEL[attachment.kind]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{metaLabel(attachment)}</span>
                        <span aria-hidden className="text-muted-foreground/50">
                            ·
                        </span>
                        <span className="text-xs text-muted-foreground">{attachment.subject}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onPreview}>
                    <Eye className="size-3.5" />
                    Prévisualiser
                </Button>
                {own ? (
                    <span className="text-xs text-muted-foreground">Envoyé par vous</span>
                ) : imported ? (
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" disabled>
                        <Check className="size-3.5" />
                        Importé
                    </Button>
                ) : (
                    <Button size="sm" className="flex-1 gap-1.5" onClick={onImport} disabled={importing}>
                        {importing ? (
                            <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                            <Download className="size-3.5" />
                        )}
                        Importer
                    </Button>
                )}
            </div>
        </div>
    )
}