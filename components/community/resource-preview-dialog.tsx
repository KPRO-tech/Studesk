'use client'

import Link from 'next/link'
import { Download, Layers, ListChecks, FileText, Check, Loader2 } from 'lucide-react'
import type { FeedResource, ResourceKind } from '@/lib/marketplace'
import { KIND_LABEL, formatDownloads } from '@/lib/marketplace'
import { CommunityAvatar } from '@/components/community/community-avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

const KIND_ICON: Record<ResourceKind, typeof Layers> = {
    note: FileText,
    deck: Layers,
    quiz: ListChecks,
}

export function ResourcePreviewDialog({
    resource,
    authorIcon,
    authorAccent,
    importing,
    imported,
    onImport,
    onClose,
}: {
    resource: FeedResource
    authorIcon: string
    authorAccent: string
    importing: boolean
    imported: boolean
    onImport: () => void
    onClose: () => void
}) {
    const KindIcon = KIND_ICON[resource.kind]

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="gap-1.5">
                            <KindIcon className="size-3.5" />
                            {KIND_LABEL[resource.kind]}
                        </Badge>
                        <Badge variant="outline">{resource.subject}</Badge>
                    </div>
                    <DialogTitle className="text-pretty pt-1">{resource.title}</DialogTitle>
                </DialogHeader>

                {/* Author + stats */}
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3">
                    <Link
                        href={resource.authorSlug ? `/u/${resource.authorSlug}` : '#'}
                        className="flex min-w-0 items-center gap-2.5"
                        onClick={onClose}
                    >
                        <CommunityAvatar icon={authorIcon} accent={authorAccent} className="size-9 shrink-0" iconClassName="size-4" />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{resource.authorName}</p>
                            {resource.authorSlug && (
                                <p className="truncate text-xs text-muted-foreground">@{resource.authorSlug}</p>
                            )}
                        </div>
                    </Link>
                    {!resource.own && (
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                            <Download className="size-3.5" />
                            {formatDownloads(resource.downloads)}
                        </span>
                    )}
                </div>

                {/* Body preview */}
                <div className="min-h-0">
                    {resource.kind === 'note' && resource.note && (
                        <div
                            className="rich-preview max-w-none text-sm leading-relaxed [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1"
                            dangerouslySetInnerHTML={{ __html: resource.note.html }}
                        />
                    )}

                    {resource.kind === 'deck' && resource.deck && (
                        <div className="flex flex-col gap-3">
                            {resource.deck.description && (
                                <p className="text-sm text-muted-foreground">{resource.deck.description}</p>
                            )}
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Layers className="size-4 text-muted-foreground" />
                                {resource.deck.cards.length} carte{resource.deck.cards.length > 1 ? 's' : ''}
                            </div>
                            <ul className="flex flex-col gap-1.5">
                                {resource.deck.cards.slice(0, 6).map((c, i) => (
                                    <li
                                        key={i}
                                        className="truncate rounded-md border border-border px-3 py-2 text-sm"
                                    >
                                        {c.front}
                                    </li>
                                ))}
                                {resource.deck.cards.length > 6 && (
                                    <li className="px-1 text-xs text-muted-foreground">
                                        + {resource.deck.cards.length - 6} autres cartes…
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}

                    {resource.kind === 'quiz' && resource.quiz && (
                        <div className="flex flex-col gap-3">
                            <p className="text-sm text-muted-foreground">
                                {resource.quiz.questions.length} question
                                {resource.quiz.questions.length > 1 ? 's' : ''} · les réponses sont masquées
                            </p>
                            <ol className="flex flex-col gap-3">
                                {resource.quiz.questions.map((q, i) => (
                                    <li key={i} className="rounded-lg border border-border p-3">
                                        <p className="text-sm font-medium">
                                            {i + 1}. {q.question}
                                        </p>
                                        <ul className="mt-2 flex flex-col gap-1">
                                            {q.options.map((opt, j) => (
                                                <li
                                                    key={j}
                                                    className="flex items-center gap-2 text-sm text-muted-foreground"
                                                >
                                                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px]">
                                                        {String.fromCharCode(65 + j)}
                                                    </span>
                                                    {opt}
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}
                </div>

                {/* Action */}
                <div className="sticky bottom-0 -mx-6 -mb-6 border-t border-border bg-background px-6 py-3">
                    {resource.own ? (
                        <p className="text-center text-sm text-muted-foreground">
                            Ceci est votre ressource publiée.
                        </p>
                    ) : imported ? (
                        <Button disabled className="w-full gap-2" variant="outline">
                            <Check className="size-4" /> Importé dans votre espace
                        </Button>
                    ) : (
                        <Button onClick={onImport} disabled={importing} className="w-full gap-2">
                            {importing ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Download className="size-4" />
                            )}
                            Importer
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}