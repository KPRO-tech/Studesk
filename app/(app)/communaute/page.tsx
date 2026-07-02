'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import {
    Search,
    Download,
    Layers,
    ListChecks,
    FileText,
    Users,
    TrendingUp,
    BookOpen,
    Compass,
    ArrowRight,
    WifiOff,
} from 'lucide-react'
import { useApp } from '@/components/providers'
import { CommunityAvatar } from '@/components/community/community-avatar'
import { ResourcePreviewDialog } from '@/components/community/resource-preview-dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useOnline } from '@/lib/use-online'
import { toast } from 'sonner'
import { DEFAULT_AVATAR_ICON } from '@/lib/avatar-icons'
import { DEFAULT_ACCENT } from '@/lib/accents'
import {
    MARKET_RESOURCES,
    MARKET_AUTHORS,
    marketToFeed,
    getMarketAuthor,
    getMarketResourceById,
    getOwnPublicFeed,
    importMarketResource,
    formatDownloads,
    authorName,
    KIND_LABEL,
    type FeedResource,
    type ResourceKind,
} from '@/lib/marketplace'

type Filter = 'all' | ResourceKind | 'authors'

const FILTERS: { key: Filter; label: string; icon?: React.ElementType }[] = [
    { key: 'all', label: 'Tout' },
    { key: 'deck', label: 'Flashcards', icon: Layers },
    { key: 'quiz', label: 'Quiz', icon: ListChecks },
    { key: 'note', label: 'Notes', icon: FileText },
    { key: 'authors', label: 'Créateurs', icon: Users },
]

const KIND_ICON: Record<ResourceKind, React.ElementType> = {
    note: FileText,
    deck: Layers,
    quiz: ListChecks,
}

const TOTAL_RESOURCES = MARKET_RESOURCES.length
const TOTAL_AUTHORS = MARKET_AUTHORS.length
const TOTAL_DOWNLOADS = MARKET_RESOURCES.reduce((s, r) => s + r.downloads, 0)

export default function CommunautePage() {
    const { userId, settings } = useApp()
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<Filter>('all')
    const [preview, setPreview] = useState<FeedResource | null>(null)
    const [importing, setImporting] = useState(false)
    const [importedIds, setImportedIds] = useState<Set<string>>(new Set())

    const online = useOnline()

    const ownFeed = useLiveQuery(
        () => (userId ? getOwnPublicFeed(userId) : Promise.resolve([] as FeedResource[])),
        [userId],
    )

    const feed = useMemo<FeedResource[]>(() => {
        const market = MARKET_RESOURCES.map(marketToFeed)
        return [...(ownFeed ?? []), ...market]
    }, [ownFeed])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        return feed.filter((r) => {
            if (filter !== 'all' && filter !== 'authors' && r.kind !== filter) return false
            if (!q) return true
            return (
                r.title.toLowerCase().includes(q) ||
                r.subject.toLowerCase().includes(q) ||
                r.authorName.toLowerCase().includes(q) ||
                r.authorSlug.toLowerCase().includes(q)
            )
        })
    }, [feed, filter, search])

    const featured = useMemo(
        () =>
            [...MARKET_RESOURCES]
                .sort((a, b) => b.downloads - a.downloads)
                .slice(0, 4)
                .map(marketToFeed),
        [],
    )

    const avatarFor = (slug: string, own: boolean) => {
        const a = getMarketAuthor(slug)
        if (a) return { icon: a.avatarIcon, accent: a.accent }
        if (own) {
            return {
                icon: settings?.avatarIcon ?? DEFAULT_AVATAR_ICON,
                accent: settings?.accent ?? DEFAULT_ACCENT,
            }
        }
        return { icon: DEFAULT_AVATAR_ICON, accent: DEFAULT_ACCENT }
    }

    const handleImport = async () => {
        if (!preview || !userId) return
        const raw = getMarketResourceById(preview.id)
        if (!raw) return
        setImporting(true)
        try {
            await importMarketResource(userId, raw)
            setImportedIds((prev) => new Set(prev).add(preview.id))
            toast.success('Ressource importée dans votre espace.')
        } catch {
            toast.error("L'import a échoué.")
        } finally {
            setImporting(false)
        }
    }

    const previewAvatar = preview ? avatarFor(preview.authorSlug, preview.own) : null
    const isSearching = search.trim().length > 0
    const showFeatured = online && filter === 'all' && !isSearching

    return (
        <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex flex-col gap-5 border-b border-border pb-8">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="mb-1.5 flex items-center gap-2">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                                <BookOpen className="size-4 text-primary" />
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Bibliothèque
                            </span>
                        </div>
                        <h1 className="font-heading text-3xl font-bold tracking-tight text-balance">
                            Communauté
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground text-pretty">
                            Fiches, flashcards et quiz partagés par des étudiants du monde entier.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Search + filters ──────────────────────────────────── */}
            {online && (
                <div className="mb-6 flex flex-col gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Rechercher par matière, mot-clé ou créateur…"
                            className="h-11 pl-9"
                        />
                    </div>

                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
                        {FILTERS.map((f) => {
                            const Icon = f.icon
                            const active = filter === f.key
                            return (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => setFilter(f.key)}
                                    className={cn(
                                        'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                                        active
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                                    )}
                                >
                                    {Icon && <Icon className="size-3.5" />}
                                    {f.label}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {!online ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <WifiOff className="size-6" />
                    </div>
                    <div>
                        <h2 className="font-heading text-lg font-semibold">Connexion requise</h2>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                            Vous devez être connecté à Internet pour explorer et télécharger des ressources depuis la communauté.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-10">
                    {/* ── Featured / Popular ───────────────────────────────── */}
                    {showFeatured && (
                        <section className="mb-8">
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
                                    <TrendingUp className="size-4 text-primary" />
                                    Populaires
                                </h2>
                            </div>

                            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                                {featured.map((r) => {
                                    const KindIcon = KIND_ICON[r.kind]
                                    const av = avatarFor(r.authorSlug, r.own)
                                    return (
                                        <button
                                            key={r.id}
                                            type="button"
                                            onClick={() => setPreview(r)}
                                            className="group flex w-56 shrink-0 flex-col gap-2.5 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                                                    <KindIcon className="size-4 text-primary" />
                                                </div>
                                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Download className="size-3" />
                                                    {formatDownloads(r.downloads)}
                                                </span>
                                            </div>
                                            <p className="line-clamp-2 text-sm font-medium leading-snug text-pretty">
                                                {r.title}
                                            </p>
                                            <div className="mt-auto flex items-center gap-1.5">
                                                <CommunityAvatar
                                                    icon={av.icon}
                                                    accent={av.accent}
                                                    className="size-5 shrink-0 rounded-md"
                                                    iconClassName="size-3"
                                                />
                                                <span className="truncate text-xs text-muted-foreground">
                                                    @{r.authorSlug}
                                                </span>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </section>
                    )}

                    {/* ── Authors grid ─────────────────────────────────────── */}
                    {filter === 'authors' ? (
                        <AuthorsGrid onPreviewAuthor={() => { }} />
                    ) : filtered.length > 0 ? (
                        <>
                            {!isSearching && (
                                <h2 className="mb-3 font-heading text-base font-semibold text-muted-foreground">
                                    {filter === 'all'
                                        ? 'Toutes les ressources'
                                        : KIND_LABEL[filter as ResourceKind]}
                                    <span className="ml-2 text-sm font-normal">({filtered.length})</span>
                                </h2>
                            )}
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {filtered.map((r) => (
                                    <ResourceCard
                                        key={r.id}
                                        resource={r}
                                        avatarFor={avatarFor}
                                        onClick={() => setPreview(r)}
                                    />
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
                            <Compass className="size-8 text-muted-foreground/50" />
                            <div>
                                <p className="font-medium">Aucun résultat</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Essayez un autre mot-clé ou un autre filtre.
                                </p>
                            </div>
                        </div>
                    )}

                </div>
            )}

            {preview && previewAvatar && (
                <ResourcePreviewDialog
                    resource={preview}
                    authorIcon={previewAvatar.icon}
                    authorAccent={previewAvatar.accent}
                    importing={importing}
                    imported={importedIds.has(preview.id)}
                    onImport={handleImport}
                    onClose={() => setPreview(null)}
                />
            )}
        </div>
    )
}

/* ── Sub-components ─────────────────────────────────────────────── */

function Stat({ value, label }: { value: string; label: string }) {
    return (
        <div className="flex items-baseline gap-1.5">
            <span className="font-heading text-2xl font-bold tabular-nums">{value}</span>
            <span className="text-sm text-muted-foreground">{label}</span>
        </div>
    )
}

const KIND_COLORS: Record<ResourceKind, string> = {
    note: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    deck: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    quiz: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

function ResourceCard({
    resource: r,
    avatarFor,
    onClick,
}: {
    resource: FeedResource
    avatarFor: (slug: string, own: boolean) => { icon: string; accent: string }
    onClick: () => void
}) {
    const KindIcon = KIND_ICON[r.kind]
    const av = avatarFor(r.authorSlug, r.own)
    return (
        <Card
            className="group flex cursor-pointer flex-col gap-3 p-4 transition-all hover:border-primary/40 hover:shadow-sm"
            onClick={onClick}
        >
            {/* Kind + subject */}
            <div className="flex items-center gap-2">
                <span
                    className={cn(
                        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
                        KIND_COLORS[r.kind],
                    )}
                >
                    <KindIcon className="size-3.5" />
                    {KIND_LABEL[r.kind]}
                </span>
                <span className="truncate text-xs text-muted-foreground">{r.subject}</span>
                {r.own && (
                    <Badge variant="outline" className="ml-auto shrink-0 text-xs">
                        Vous
                    </Badge>
                )}
            </div>

            {/* Title */}
            <p className="line-clamp-2 font-medium leading-snug text-pretty">{r.title}</p>

            {/* Footer */}
            <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <Link
                    href={`/u/${r.authorSlug}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex min-w-0 items-center gap-2 hover:underline"
                >
                    <CommunityAvatar
                        icon={av.icon}
                        accent={av.accent}
                        className="size-6 shrink-0 rounded-md"
                        iconClassName="size-3.5"
                    />
                    <span className="truncate text-xs text-muted-foreground">
                        {r.own ? 'Vous' : r.authorName}
                    </span>
                </Link>
                {!r.own && (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Download className="size-3.5" />
                        {formatDownloads(r.downloads)}
                    </span>
                )}
            </div>
        </Card>
    )
}

function AuthorsGrid({ onPreviewAuthor: _ }: { onPreviewAuthor: (slug: string) => void }) {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MARKET_AUTHORS.map((a) => {
                const resources = MARKET_RESOURCES.filter((r) => r.authorSlug === a.slug)
                const count = resources.length
                const downloads = resources.reduce((s, r) => s + r.downloads, 0)
                return (
                    <Link key={a.slug} href={`/u/${a.slug}`}>
                        <Card className="flex h-full cursor-pointer flex-col gap-4 p-5 transition-all hover:border-primary/40 hover:shadow-sm">
                            <div className="flex items-center gap-3">
                                <CommunityAvatar
                                    icon={a.avatarIcon}
                                    accent={a.accent}
                                    className="size-12 shrink-0 rounded-xl"
                                    iconClassName="size-5"
                                />
                                <div className="min-w-0">
                                    <p className="truncate font-semibold">{authorName(a)}</p>
                                    <p className="truncate text-xs text-muted-foreground">@{a.slug}</p>
                                </div>
                            </div>

                            <p className="line-clamp-2 text-sm text-muted-foreground">{a.bio}</p>

                            <div className="mt-auto flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                                <span>
                                    <strong className="font-semibold text-foreground">{count}</strong>{' '}
                                    ressource{count > 1 ? 's' : ''}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Download className="size-3.5" />
                                    <strong className="font-semibold text-foreground">
                                        {formatDownloads(downloads)}
                                    </strong>{' '}
                                    imports
                                </span>
                            </div>
                        </Card>
                    </Link>
                )
            })}
        </div>
    )
}
