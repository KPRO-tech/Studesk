'use client'

import { use, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import {
    ArrowLeft,
    MoreVertical,
    Link2,
    Settings,
    LogOut,
    Users,
    Send,
    Paperclip,
    X,
    MessageSquare,
    FolderOpen,
    Layers,
    ListChecks,
    FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { db, type GroupAttachment, type GroupInvite, type GroupMessage } from '@/lib/db'
import {
    SELF_SLUG,
    syncSelfMember,
    sendMessage,
    buildAttachment,
    importAttachment,
    attachmentToFeed,
    leaveGroup,
    getInviteUrl,
} from '@/lib/groups'
import { getMarketAuthor, authorName } from '@/lib/marketplace'
import { useOnline } from '@/lib/use-online'
import { useApp } from '@/components/providers'
import { GroupIcon } from '@/components/groups/group-icon'
import { ChatMessage, type ResolvedAuthor } from '@/components/groups/chat-message'
import { AttachmentCard } from '@/components/groups/attachment-card'
import { MembersTab } from '@/components/groups/members-tab'
import { GroupSettingsDialog } from '@/components/groups/group-settings-dialog'
import { ShareResourceDialog, type ShareKind } from '@/components/groups/share-resource-dialog'
import { ResourcePreviewDialog } from '@/components/community/resource-preview-dialog'
import { useGroupMessages, useOutgoingInvites } from '@/lib/firebase-group-hooks'
import { CommunityAvatar } from '@/components/community/community-avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { DEFAULT_AVATAR_ICON } from '@/lib/avatar-icons'
import { DEFAULT_ACCENT } from '@/lib/accents'
import { formatDate } from '@/lib/dates'

interface PreviewState {
    messageId: string
    attachment: GroupAttachment
    author: ResolvedAuthor
    own: boolean
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const { userId, user } = useApp()

    const group = useLiveQuery(() => db.groups.get(id), [id])
    const members = useLiveQuery(
        () => db.groupMembers.where('groupId').equals(id).toArray(),
        [id],
    )
    const messages = useGroupMessages(id)
    const outgoingInvites = useOutgoingInvites(id)

    // Keep the current user's member row in sync with their profile.
    useEffect(() => {
        if (group && userId) syncSelfMember(id, userId)
    }, [group?.id, userId, id])

    const [settingsOpen, setSettingsOpen] = useState(false)
    const [shareOpen, setShareOpen] = useState(false)
    const [leaveOpen, setLeaveOpen] = useState(false)
    const [leaving, setLeaving] = useState(false)
    const [text, setText] = useState('')
    const [pending, setPending] = useState<{ kind: ShareKind; id: string; title: string } | null>(null)
    const [preview, setPreview] = useState<PreviewState | null>(null)
    const [importingId, setImportingId] = useState<string | null>(null)
    const [importedIds, setImportedIds] = useState<Set<string>>(new Set())

    const online = useOnline()

    const scrollRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    }, [messages?.length])

    const selfMember = members?.find((m) => m.isSelf)
    const isAdmin = selfMember?.role === 'admin'

    const resolveAuthor = useMemo(() => {
        return (slug: string): ResolvedAuthor => {
            if (user?.slug && slug === user.slug) {
                return { 
                    name: `${user.firstName} ${user.lastName}`, 
                    slug: user.slug, 
                    avatarIcon: selfMember?.avatarIcon || DEFAULT_AVATAR_ICON, 
                    accent: selfMember?.accent || DEFAULT_ACCENT, 
                    isSelf: true 
                }
            }
            const m = members?.find((x) => x.slug === slug || (x.isSelf && slug === SELF_SLUG))
            if (m) {
                return { name: m.name, slug: m.slug, avatarIcon: m.avatarIcon, accent: m.accent, isSelf: m.isSelf }
            }
            const a = getMarketAuthor(slug)
            if (a) {
                return { name: authorName(a), slug, avatarIcon: a.avatarIcon, accent: a.accent, isSelf: false }
            }
            return {
                name: slug === SELF_SLUG ? 'Vous' : 'Membre',
                slug,
                avatarIcon: DEFAULT_AVATAR_ICON,
                accent: DEFAULT_ACCENT,
                isSelf: slug === SELF_SLUG,
            }
        }
    }, [members, user, selfMember])

    if (group === undefined || members === undefined) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
        )
    }

    if (!group) {
        return (
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Users className="size-6" />
                </div>
                <div>
                    <h1 className="font-heading text-xl font-semibold">Groupe introuvable</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Ce groupe n&apos;existe pas ou a été supprimé.
                    </p>
                </div>
                <Link href="/groupes" className="text-sm font-medium text-primary hover:underline">
                    Retour aux groupes
                </Link>
            </div>
        )
    }

    const memberCount = members.length

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(getInviteUrl(group))
            toast.success('Lien copié dans le presse-papiers.')
        } catch {
            toast.error('Impossible de copier le lien.')
        }
    }

    const handleLeave = async () => {
        setLeaving(true)
        try {
            await leaveGroup(id)
            toast.success('Vous avez quitté le groupe.')
            router.push('/groupes')
        } finally {
            setLeaving(false)
            setLeaveOpen(false)
        }
    }

    const handleSend = async () => {
        if (!userId) return
        let attachment: GroupAttachment | undefined
        if (pending) {
            const built = await buildAttachment(userId, pending.kind, pending.id)
            if (!built) {
                toast.error('Ressource introuvable.')
                return
            }
            attachment = built
        }
        if (!text.trim() && !attachment) return
        const authorSlug = user?.slug || SELF_SLUG
        await sendMessage(id, text, authorSlug, attachment)
        setText('')
        setPending(null)
    }

    const handleImport = async (state: PreviewState) => {
        if (!userId) return
        setImportingId(state.messageId)
        try {
            await importAttachment(userId, state.attachment, { name: state.author.name, slug: state.author.slug })
            setImportedIds((prev) => new Set(prev).add(state.messageId))
            toast.success('Ressource importée dans votre espace.')
        } catch {
            toast.error("L'import a échoué.")
        } finally {
            setImportingId(null)
        }
    }

    // All attachments shared in the group (for the Resources tab).
    const attachments = (messages ?? []).filter((m) => m.attachment)

    return (
        <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border pb-4">
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 lg:hidden"
                    onClick={() => router.push('/groupes')}
                    aria-label="Retour"
                >
                    <ArrowLeft className="size-4" />
                </Button>
                <GroupIcon icon={group.icon} className="size-11 shrink-0 rounded-xl" iconClassName="size-5" />
                <div className="min-w-0 flex-1">
                    <h1 className="truncate font-heading text-lg font-semibold">{group.name}</h1>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="size-3.5" />
                        {memberCount} membre{memberCount > 1 ? 's' : ''}
                    </p>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon" className="size-9" aria-label="Options du groupe" />}
                    >
                        <MoreVertical className="size-4.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={copyLink}>
                            <Link2 className="size-4" /> Copier le lien
                        </DropdownMenuItem>
                        {isAdmin && (
                            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                                <Settings className="size-4" /> Paramètres
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setLeaveOpen(true)}>
                            <LogOut className="size-4" /> Quitter le groupe
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="discussion" className="flex min-h-0 flex-1 flex-col pt-4">
                <TabsList className="w-full shrink-0">
                    <TabsTrigger value="discussion" className="flex-1 gap-1.5">
                        <MessageSquare className="size-4" /> Discussion
                    </TabsTrigger>
                    <TabsTrigger value="resources" className="flex-1 gap-1.5">
                        <FolderOpen className="size-4" /> Ressources
                    </TabsTrigger>
                    <TabsTrigger value="members" className="flex-1 gap-1.5">
                        <Users className="size-4" /> Membres
                    </TabsTrigger>
                </TabsList>

                {/* Discussion */}
                <TabsContent value="discussion" className="flex min-h-0 flex-1 flex-col">
                    <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto py-4">
                        {messages && messages.length > 0 ? (
                            messages.map((m) => {
                                const author = resolveAuthor(m.authorSlug)
                                return (
                                    <ChatMessage
                                        key={m.id}
                                        message={m}
                                        author={author}
                                        importing={importingId === m.id}
                                        imported={importedIds.has(m.id)}
                                        onPreview={() =>
                                            m.attachment &&
                                            setPreview({ messageId: m.id, attachment: m.attachment, author, own: author.isSelf })
                                        }
                                        onImport={() =>
                                            m.attachment &&
                                            handleImport({ messageId: m.id, attachment: m.attachment, author, own: author.isSelf })
                                        }
                                    />
                                )
                            })
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                                <MessageSquare className="size-8 opacity-60" />
                                <p className="text-sm">Aucun message. Lancez la discussion !</p>
                            </div>
                        )}
                    </div>

                    {/* Composer */}
                    <div className="shrink-0 border-t border-border pt-3">
                        {pending && (
                            <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
                                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                                <span className="min-w-0 flex-1 truncate text-sm">{pending.title}</span>
                                <button
                                    type="button"
                                    onClick={() => setPending(null)}
                                    className="text-muted-foreground hover:text-foreground"
                                    aria-label="Retirer la pièce jointe"
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                        )}
                        <div className="flex items-end gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="size-9 shrink-0"
                                onClick={() => setShareOpen(true)}
                                aria-label="Joindre une ressource"
                                disabled={!online}
                            >
                                <Paperclip className="size-4" />
                            </Button>
                            <Input
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder={!online ? 'Hors ligne - envoi désactivé' : pending ? 'Ajouter un message (optionnel)…' : 'Écrire un message…'}
                                disabled={!online}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.nativeEvent.isComposing && (e.nativeEvent as KeyboardEvent).keyCode !== 229) {
                                        e.preventDefault()
                                        handleSend()
                                    }
                                }}
                            />
                            <Button
                                size="icon"
                                className="size-9 shrink-0"
                                onClick={handleSend}
                                disabled={!online || (!text.trim() && !pending)}
                                aria-label="Envoyer"
                            >
                                <Send className="size-4" />
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                {/* Resources */}
                <TabsContent value="resources" className="min-h-0 flex-1 overflow-y-auto py-4">
                    {attachments.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {attachments.map((m) => {
                                const author = resolveAuthor(m.authorSlug)
                                return (
                                    <ResourceEntry
                                        key={m.id}
                                        message={m}
                                        author={author}
                                        importing={importingId === m.id}
                                        imported={importedIds.has(m.id)}
                                        onPreview={() =>
                                            m.attachment &&
                                            setPreview({ messageId: m.id, attachment: m.attachment, author, own: author.isSelf })
                                        }
                                        onImport={() =>
                                            m.attachment &&
                                            handleImport({ messageId: m.id, attachment: m.attachment, author, own: author.isSelf })
                                        }
                                    />
                                )
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
                            <FolderOpen className="size-8 opacity-60" />
                            <p className="text-sm">Aucune ressource partagée pour l&apos;instant.</p>
                        </div>
                    )}
                </TabsContent>

                {/* Members */}
                <TabsContent value="members" className="min-h-0 flex-1 overflow-y-auto py-4">
                    {userId && (
                        <MembersTab
                            group={group}
                            members={members}
                            outgoingInvites={outgoingInvites ?? []}
                            isAdmin={!!isAdmin}
                            userId={userId}
                        />
                    )}
                </TabsContent>
            </Tabs>

            {/* Leave confirmation */}
            <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
                <DialogContent showCloseButton={false} className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Quitter le groupe ?</DialogTitle>
                        <DialogDescription>
                            Vous ne pourrez plus accéder à la discussion ni aux ressources partagées de{' '}
                            <strong>{group.name}</strong>. Un admin devra vous réinviter.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setLeaveOpen(false)} disabled={leaving}>
                            Annuler
                        </Button>
                        <Button variant="destructive" onClick={handleLeave} disabled={leaving}>
                            {leaving ? 'Départ en cours…' : 'Quitter le groupe'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {settingsOpen && (
                <GroupSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} group={group} />
            )}

            {userId && (
                <ShareResourceDialog
                    open={shareOpen}
                    onOpenChange={setShareOpen}
                    userId={userId}
                    onSelect={(kind, resId, title) => setPending({ kind, id: resId, title })}
                />
            )}

            {preview && (
                <ResourcePreviewDialog
                    resource={attachmentToFeed(
                        preview.attachment,
                        preview.messageId,
                        { name: preview.author.name, slug: preview.author.slug },
                        preview.own,
                    )}
                    authorIcon={preview.author.avatarIcon}
                    authorAccent={preview.author.accent}
                    importing={importingId === preview.messageId}
                    imported={importedIds.has(preview.messageId)}
                    onImport={() => handleImport(preview)}
                    onClose={() => setPreview(null)}
                />
            )}
        </div>
    )
}

const KIND_ICON = { note: FileText, deck: Layers, quiz: ListChecks } as const

function ResourceEntry({
    message,
    author,
    importing,
    imported,
    onPreview,
    onImport,
}: {
    message: GroupMessage
    author: ResolvedAuthor
    importing: boolean
    imported: boolean
    onPreview: () => void
    onImport: () => void
}) {
    if (!message.attachment) return null
    return (
        <div className="flex flex-col gap-2">
            <AttachmentCard
                attachment={message.attachment}
                own={author.isSelf}
                importing={importing}
                imported={imported}
                onPreview={onPreview}
                onImport={onImport}
            />
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <CommunityAvatar
                    icon={author.avatarIcon}
                    accent={author.accent}
                    className="size-5 shrink-0 rounded-md"
                    iconClassName="size-3"
                />
                <span className="truncate">
                    {author.isSelf ? 'Vous' : author.name} · {formatDate(message.createdAt)}
                </span>
            </div>
        </div>
    )
}
