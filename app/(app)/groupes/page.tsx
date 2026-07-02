'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Users } from 'lucide-react'
import { db, type Group, type GroupInvite } from '@/lib/db'
import { useApp } from '@/components/providers'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { InvitePanel } from '@/components/groups/invite-panel'
import { GroupListItem } from '@/components/groups/group-list-item'
import { CreateGroupDialog } from '@/components/groups/create-group-dialog'
import { useGroupInvites } from '@/lib/firebase-group-hooks'

export default function GroupesPage() {
    const { userId } = useApp()
    const [createOpen, setCreateOpen] = useState(false)

    const groups = useLiveQuery(
        () =>
            userId
                ? db.groups.where('userId').equals(userId).reverse().sortBy('updatedAt')
                : Promise.resolve([] as Group[]),
        [userId],
    )

    const invites = useGroupInvites(userId)

    return (
        <div className="mx-auto max-w-3xl">
            <PageHeader
                title="Groupes"
                description="Partagez fiches, flashcards et quiz avec d'autres étudiants."
                action={
                    userId ? (
                        <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
                            <Plus className="size-4" />
                            Nouveau groupe
                        </Button>
                    ) : undefined
                }
            />

            {invites && <InvitePanel invites={invites} />}

            {groups && groups.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                    {groups.map((g) => (
                        <GroupListItem key={g.id} group={g} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Users className="size-6" />
                    </div>
                    <div>
                        <p className="font-medium">Aucun groupe pour l&apos;instant</p>
                        <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground text-pretty">
                            Créez un groupe pour réviser à plusieurs, ou acceptez une invitation.
                        </p>
                    </div>
                    {userId && (
                        <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
                            <Plus className="size-4" />
                            Créer un groupe
                        </Button>
                    )}
                </div>
            )}

            {userId && (
                <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} userId={userId} />
            )}
        </div>
    )
}