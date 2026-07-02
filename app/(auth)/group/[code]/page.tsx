'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { GraduationCap, Users, LinkIcon, Loader2, SearchX } from 'lucide-react'
import { db, type Group } from '@/lib/db'
import { useApp } from '@/components/providers'
import { findGroupByCode, joinByCode } from '@/lib/groups'
import { GroupIcon } from '@/components/groups/group-icon'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function JoinGroupPage({
    params,
}: {
    params: Promise<{ code: string }>
}) {
    const { code } = use(params)
    const normalized = code.toUpperCase()
    const { userId } = useApp()
    const router = useRouter()
    const [joining, setJoining] = useState(false)

    const group = useLiveQuery(
        async (): Promise<Group | undefined | null> => {
            const g = await findGroupByCode(normalized)
            return g ?? null
        },
        [normalized],
    )

    const memberCount = useLiveQuery(
        async () => {
            if (!group) return 0
            return db.groupMembers.where('groupId').equals(group.id).count()
        },
        [group?.id],
    )

    const alreadyMember = useLiveQuery(
        async () => {
            if (!group) return false
            const self = await db.groupMembers
                .where('groupId')
                .equals(group.id)
                .filter((m) => m.isSelf)
                .first()
            return Boolean(self)
        },
        [group?.id],
    )

    const resolving = group === undefined

    const handleJoin = async () => {
        if (!group || !userId) return
        setJoining(true)
        try {
            const id = await joinByCode(userId, normalized)
            if (id) {
                toast.success(`Vous avez rejoint « ${group.name} ».`)
                router.push(`/groupes/${id}`)
            } else {
                toast.error('Ce groupe est introuvable.')
            }
        } catch {
            toast.error("Impossible de rejoindre le groupe.")
            setJoining(false)
        }
    }

    const body = useMemo(() => {
        if (resolving) {
            return (
                <div className="flex items-center justify-center py-10">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
            )
        }

        if (!group || !group.linkEnabled) {
            return (
                <div className="flex flex-col items-center gap-4 py-6 text-center">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <SearchX className="size-7" />
                    </div>
                    <div>
                        <h1 className="font-heading text-xl font-semibold">Invitation invalide</h1>
                        <p className="mt-1 text-sm text-muted-foreground text-pretty">
                            {group && !group.linkEnabled
                                ? "Le partage par lien est désactivé pour ce groupe. Demandez à un administrateur de vous inviter directement."
                                : 'Aucun groupe ne correspond à ce lien d’invitation.'}
                        </p>
                    </div>
                    <Link href="/groupes" className="text-sm font-medium text-primary hover:underline">
                        Voir mes groupes
                    </Link>
                </div>
            )
        }

        return (
            <div className="flex flex-col items-center gap-5 text-center">
                <GroupIcon icon={group.icon} className="size-16 rounded-2xl" iconClassName="size-8" />
                <div>
                    <p className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
                        <LinkIcon className="size-3.5" /> Invitation à rejoindre
                    </p>
                    <h1 className="mt-1 font-heading text-2xl font-semibold text-balance">{group.name}</h1>
                    {group.description && (
                        <p className="mt-2 text-sm text-muted-foreground text-pretty">{group.description}</p>
                    )}
                </div>

                <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                    <Users className="size-4" />
                    {memberCount} membre{(memberCount ?? 0) > 1 ? 's' : ''}
                </span>

                {alreadyMember ? (
                    <div className="flex w-full flex-col gap-2">
                        <p className="text-sm text-muted-foreground">Vous faites déjà partie de ce groupe.</p>
                        <Button onClick={() => router.push(`/groupes/${group.id}`)} className="w-full">
                            Ouvrir le groupe
                        </Button>
                    </div>
                ) : !userId ? (
                    <div className="flex w-full flex-col gap-2">
                        <p className="text-sm text-muted-foreground">
                            Connectez-vous pour rejoindre ce groupe.
                        </p>
                        <Button onClick={() => router.push('/login')} className="w-full">
                            Se connecter
                        </Button>
                    </div>
                ) : (
                    <Button onClick={handleJoin} disabled={joining} className="w-full">
                        {joining && <Loader2 className="size-4 animate-spin" />}
                        Rejoindre le groupe
                    </Button>
                )}
            </div>
        )
    }, [resolving, group, memberCount, alreadyMember, userId, joining])

    return (
        <div className="min-h-screen bg-muted/30">
            <header className="border-b border-border bg-background">
                <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
                    <Link href="/" className="flex items-center gap-2 font-heading font-semibold">
                        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                            <GraduationCap className="size-4" />
                        </span>
                        Studesk
                    </Link>
                    <Link
                        href="/communaute"
                        className="text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                        Explorer la communauté
                    </Link>
                </div>
            </header>

            <main className="mx-auto flex max-w-md flex-col px-4 py-16">
                <div className="rounded-xl border border-border bg-background p-8">{body}</div>
            </main>
        </div>
    )
}