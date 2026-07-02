'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import {
    GraduationCap,
    Mail,
    MapPin,
    Download,
    Layers,
    ListChecks,
    FileText,
    UserX,
} from 'lucide-react'
import { db, type User } from '@/lib/db'
import { useApp } from '@/components/providers'
import { getCountry } from '@/lib/countries'
import { DEFAULT_AVATAR_ICON } from '@/lib/avatar-icons'
import { DEFAULT_ACCENT } from '@/lib/accents'
import { CommunityAvatar } from '@/components/community/community-avatar'
import { ResourcePreviewDialog } from '@/components/community/resource-preview-dialog'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
    MARKET_RESOURCES,
    getMarketAuthor,
    getMarketResourceById,
    getOwnPublicFeed,
    importMarketResource,
    marketToFeed,
    authorName,
    formatDownloads,
    KIND_LABEL,
    type FeedResource,
    type ResourceKind,
} from '@/lib/marketplace'

interface Profile {
    slug: string
    name: string
    firstName: string
    email: string
    country: string
    avatarIcon: string
    accent: string
    bio?: string
    feed: FeedResource[]
}

export default function PublicProfilePage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = use(params)
    const { userId } = useApp()

    const marketAuthor = getMarketAuthor(slug)

    // Resolve a local account with this slug (used for the viewer's own profile).
    const localUser = useLiveQuery(
        async (): Promise<User | undefined> => {
            if (marketAuthor) return undefined
            return db.users.where('slug').equals(slug).first()
        },
        [slug, marketAuthor],
    )
    const localSettings = useLiveQuery(
        async (): Promise<AppSettings | undefined> => {
            if (!localUser) return undefined
            return db.settings.get(localUser.id)
        },
        [localUser?.id],
    )
    const localFeed = useLiveQuery(
        async (): Promise<FeedResource[]> => {
            if (!localUser) return []
            return getOwnPublicFeed(localUser.id)
        },
        [localUser?.id],
    )

    const profile: Profile | null = useMemo(() => {
        if (marketAuthor) {
            return {
                slug: marketAuthor.slug,
                name: authorName(marketAuthor),
                firstName: marketAuthor.firstName,
                email: `${marketAuthor.slug}@studesk.app`,
                country: marketAuthor.country,
                avatarIcon: marketAuthor.avatarIcon,
                accent: marketAuthor.accent,
                bio: marketAuthor.bio,
                feed: MARKET_RESOURCES.filter((r) => r.authorSlug === marketAuthor.slug).map(marketToFeed),
            }
        }
        if (localUser) {
            return {
                slug: localUser.slug ?? slug,
                name: `${localUser.firstName} ${localUser.lastName}`.trim(),
                firstName: localUser.firstName,
                email: localUser.email,
                country: localUser.country,
                avatarIcon: localSettings?.avatarIcon ?? DEFAULT_AVATAR_ICON,
                accent: localSettings?.accent ?? DEFAULT_ACCENT,
                feed: localFeed ?? [],
            }
        }
        return null
    }, [marketAuthor, localUser, localSettings, localFeed, slug])

    // Loading state while Dexie resolves the local account lookup.
    const resolving = !marketAuthor && localUser === undefined

    if (resolving) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
        )
    }

    if (!profile) return <ProfileNotFound slug={slug} />

    return <ProfileView profile={profile} viewerId={userId} />
}

function ProfileView({ profile, viewerId }: { profile: Profile; viewerId: string | null }) {
    const [preview, setPreview] = useState<FeedResource | null>(null)
    const [importing, setImporting] = useState(false)
    const [importedIds, setImportedIds] = useState<Set<string>>(new Set())

    const country = getCountry(profile.country)
    const totalDownloads = profile.feed.reduce((sum, r) => sum + r.downloads, 0)

    const byKind = (kind: ResourceKind) => profile.feed.filter((r) => r.kind === kind)
    const notes = byKind('note')
    const decks = byKind('deck')
    const quizzes = byKind('quiz')

    const handleImport = async () => {
        if (!preview) return
        if (!viewerId) {
            toast.error('Connectez-vous pour importer cette ressource.')
            return
        }
        const raw = getMarketResourceById(preview.id)
        if (!raw) return
        setImporting(true)
        try {
            await importMarketResource(viewerId, raw)
            setImportedIds((prev) => new Set(prev).add(preview.id))
            toast.success('Ressource importée dans votre espace.')
        } catch {
            toast.error("L'import a échoué.")
        } finally {
            setImporting(false)
        }
    }

    return (
        <div className="min-h-screen bg-muted/30">
            {/* Top bar */}
            <header className="border-b border-border bg-background">
                <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
                    <Link href="/" className="flex items-center gap-2 font-heading font-semibold">
                        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                            <GraduationCap className="size-4" />
                        </span>
                        Deskia
                    </Link>
                    <Link
                        href="/communaute"
                        className="text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                        Explorer la communauté
                    </Link>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 py-8">
                {/* Profile header */}
                <div className="flex flex-col gap-5 rounded-xl border border-border bg-background p-6 sm:flex-row sm:items-center">
                    <CommunityAvatar
                        icon={profile.avatarIcon}
                        accent={profile.accent}
                        className="size-20 shrink-0 rounded-2xl"
                        iconClassName="size-9"
                    />
                    <div className="min-w-0 flex-1">
                        <h1 className="font-heading text-2xl font-semibold text-balance">{profile.name}</h1>
                        <p className="text-sm font-medium text-primary">@{profile.slug}</p>
                        {profile.bio && (
                            <p className="mt-2 text-sm text-muted-foreground text-pretty">{profile.bio}</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <MapPin className="size-4" /> {country.name}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Mail className="size-4" /> {profile.email}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="mt-4 grid grid-cols-2 gap-4">
                    <StatCard value={String(profile.feed.length)} label="Ressources publiées" icon={FileText} />
                    <StatCard
                        value={formatDownloads(totalDownloads)}
                        label="Téléchargements"
                        icon={Download}
                    />
                </div>

                {/* Resources */}
                <div className="mt-8">
                    {profile.feed.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
                            <FileText className="size-8 text-muted-foreground/60" />
                            <p className="text-sm text-muted-foreground">
                                {profile.firstName} n&apos;a encore rien publié.
                            </p>
                        </div>
                    ) : (
                        <Tabs defaultValue={decks.length ? 'deck' : quizzes.length ? 'quiz' : 'note'}>
                            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
                                <ProfileTab value="deck" icon={Layers} label="Flashcards" count={decks.length} />
                                <ProfileTab value="quiz" icon={ListChecks} label="Quiz" count={quizzes.length} />
                                <ProfileTab value="note" icon={FileText} label="Notes" count={notes.length} />
                            </TabsList>

                            <TabsContent value="deck" className="mt-4">
                                <ResourceGrid items={decks} onOpen={setPreview} />
                            </TabsContent>
                            <TabsContent value="quiz" className="mt-4">
                                <ResourceGrid items={quizzes} onOpen={setPreview} />
                            </TabsContent>
                            <TabsContent value="note" className="mt-4">
                                <ResourceGrid items={notes} onOpen={setPreview} />
                            </TabsContent>
                        </Tabs>
                    )}
                </div>
            </main>

            {preview && (
                <ResourcePreviewDialog
                    resource={preview}
                    authorIcon={profile.avatarIcon}
                    authorAccent={profile.accent}
                    importing={importing}
                    imported={importedIds.has(preview.id)}
                    onImport={handleImport}
                    onClose={() => setPreview(null)}
                />
            )}
        </div>
    )
}

const KIND_ICON: Record<ResourceKind, typeof Layers> = {
    note: FileText,
    deck: Layers,
    quiz: ListChecks,
}

function ResourceGrid({
    items,
    onOpen,
}: {
    items: FeedResource[]
    onOpen: (r: FeedResource) => void
}) {
    if (items.length === 0) {
        return (
            <p className="py-10 text-center text-sm text-muted-foreground">
                Aucune ressource dans cette catégorie.
            </p>
        )
    }
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((r) => {
                const Icon = KIND_ICON[r.kind]
                return (
                    <Card
                        key={r.id}
                        className="flex cursor-pointer flex-col gap-3 p-4 transition-colors hover:border-primary/50"
                        onClick={() => onOpen(r)}
                    >
                        <Badge variant="secondary" className="w-fit gap-1.5">
                            <Icon className="size-3.5" />
                            {KIND_LABEL[r.kind]}
                        </Badge>
                        <div className="min-w-0">
                            <p className="line-clamp-2 font-medium text-pretty">{r.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{r.subject}</p>
                        </div>
                        {!r.own && (
                            <span className="mt-auto flex items-center gap-1 pt-1 text-xs text-muted-foreground">
                                <Download className="size-3.5" />
                                {formatDownloads(r.downloads)}
                            </span>
                        )}
                    </Card>
                )
            })}
        </div>
    )
}

function StatCard({
    value,
    label,
    icon: Icon,
}: {
    value: string
    label: string
    icon: typeof FileText
}) {
    return (
        <Card className="flex items-center gap-4 p-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="size-5" />
            </div>
            <div>
                <p className="font-heading text-2xl font-semibold leading-none">{value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
        </Card>
    )
}

function ProfileTab({
    value,
    icon: Icon,
    label,
    count,
}: {
    value: string
    icon: typeof Layers
    label: string
    count: number
}) {
    return (
        <TabsTrigger
            value={value}
            className={cn(
                'gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-sm data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:shadow-none',
            )}
        >
            <Icon className="size-4" />
            {label}
            <span className="text-xs text-muted-foreground">({count})</span>
        </TabsTrigger>
    )
}

function ProfileNotFound({ slug }: { slug: string }) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <UserX className="size-7" />
            </div>
            <div>
                <h1 className="font-heading text-xl font-semibold">Profil introuvable</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Aucun utilisateur ne correspond à <span className="font-medium">@{slug}</span>.
                </p>
            </div>
            <Link
                href="/communaute"
                className="text-sm font-medium text-primary hover:underline"
            >
                Explorer la communauté
            </Link>
        </div>
    )
}