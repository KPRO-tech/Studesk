'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    MoreVertical,
    Crown,
    UserPlus,
    ExternalLink,
    ShieldPlus,
    ShieldMinus,
    UserMinus,
    Clock,
    Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Group, GroupInvite, GroupMember } from '@/lib/db'
import { inviteBySlug, setMemberRole, removeMember, getInviteUrl } from '@/lib/groups'
import { CommunityAvatar } from '@/components/community/community-avatar'
import { CopyField } from '@/components/groups/copy-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function MembersTab({
    group,
    members,
    outgoingInvites,
    isAdmin,
    userId,
}: {
    group: Group
    members: GroupMember[]
    outgoingInvites: GroupInvite[]
    isAdmin: boolean
    userId: string
}) {
    const router = useRouter()
    const [slugInput, setSlugInput] = useState('')
    const [inviting, setInviting] = useState(false)

    const sorted = [...members].sort((a, b) => {
        if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
        return a.joinedAt - b.joinedAt
    })

    const invite = async () => {
        const slugs = slugInput.split(/[\s,]+/).filter(Boolean)
        if (slugs.length === 0) {
            toast.error('Saisissez au moins un identifiant (@slug).')
            return
        }
        setInviting(true)
        try {
            const { invited, notFound, already } = await inviteBySlug(group.id, userId, slugs)
            if (invited.length > 0) {
                toast.success(
                    `Invitation envoyée à ${invited.map((s) => '@' + s).join(', ')}. Réponse en cours…`,
                )
            }
            if (already.length > 0) {
                toast.info(`Déjà membre ou invité : ${already.map((s) => '@' + s).join(', ')}.`)
            }
            if (notFound.length > 0) {
                toast.error(`Introuvable : ${notFound.map((s) => '@' + s).join(', ')}.`)
            }
            setSlugInput('')
        } finally {
            setInviting(false)
        }
    }

    const pendingInvites = outgoingInvites.filter((i) => i.status === 'pending')

    return (
        <div className="flex flex-col gap-6">
            {/* Members list */}
            <ul className="flex flex-col gap-1.5">
                {sorted.map((m) => (
                    <li
                        key={m.id}
                        className="flex items-center gap-3 rounded-lg border border-border p-2.5"
                    >
                        <CommunityAvatar
                            icon={m.avatarIcon}
                            accent={m.accent}
                            className="size-9 shrink-0"
                            iconClassName="size-4"
                        />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                                {m.isSelf ? 'Vous' : m.name}
                                {!m.isSelf && (
                                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                        @{m.slug}
                                    </span>
                                )}
                            </p>
                        </div>
                        {m.role === 'admin' ? (
                            <Badge variant="secondary" className="gap-1">
                                <Crown className="size-3" /> Admin
                            </Badge>
                        ) : (
                            <Badge variant="outline">Membre</Badge>
                        )}

                        <MemberMenu
                            member={m}
                            isAdmin={isAdmin}
                            onProfile={m.isSelf ? undefined : () => router.push(`/u/${m.slug}`)}
                            onPromote={() => setMemberRole(m.id, 'admin')}
                            onDemote={() => setMemberRole(m.id, 'member')}
                            onRemove={async () => {
                                await removeMember(m.id)
                                toast.success(`${m.name} a été retiré du groupe.`)
                            }}
                        />
                    </li>
                ))}
            </ul>

            {/* Add members (admins only) */}
            {isAdmin && (
                <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
                    <div className="flex flex-col gap-2">
                        <Label className="flex items-center gap-1.5">
                            <UserPlus className="size-4" /> Ajouter des membres
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                value={slugInput}
                                onChange={(e) => setSlugInput(e.target.value)}
                                placeholder="@lea-martin @yanis-benali"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) invite()
                                }}
                            />
                            <Button onClick={invite} disabled={inviting} className="shrink-0 gap-1.5">
                                {inviting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                                Inviter
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Saisissez un ou plusieurs identifiants publics, séparés par un espace.
                        </p>
                    </div>

                    {pendingInvites.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                            <p className="text-xs font-medium text-muted-foreground">Invitations envoyées</p>
                            {pendingInvites.map((i) => (
                                <div
                                    key={i.id}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"
                                >
                                    <span className="truncate">{i.fromName}</span>
                                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="size-3.5" /> En attente
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <Label>Lien d&apos;invitation</Label>
                        <CopyField value={getInviteUrl(group)} />
                    </div>
                </div>
            )}
        </div>
    )
}

function MemberMenu({
    member,
    isAdmin,
    onProfile,
    onPromote,
    onDemote,
    onRemove,
}: {
    member: GroupMember
    isAdmin: boolean
    onProfile?: () => void
    onPromote: () => void
    onDemote: () => void
    onRemove: () => void
}) {
    // Nothing to show: not admin and no profile to open.
    if (!onProfile && (!isAdmin || member.isSelf)) return <div className="size-8" />

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" className="size-8" aria-label="Actions" />}
            >
                <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                {onProfile && (
                    <DropdownMenuItem onClick={onProfile}>
                        <ExternalLink className="size-4" /> Voir le profil
                    </DropdownMenuItem>
                )}
                {isAdmin && !member.isSelf && (
                    <>
                        {onProfile && <DropdownMenuSeparator />}
                        {member.role === 'member' ? (
                            <DropdownMenuItem onClick={onPromote}>
                                <ShieldPlus className="size-4" /> Promouvoir admin
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem onClick={onDemote}>
                                <ShieldMinus className="size-4" /> Rétrograder
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem variant="destructive" onClick={onRemove}>
                            <UserMinus className="size-4" /> Retirer du groupe
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}