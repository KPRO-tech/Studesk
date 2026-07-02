'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { GroupInvite } from '@/lib/db'
import { acceptIncomingInvite, declineInvite } from '@/lib/groups'
import { getMarketAuthor } from '@/lib/marketplace'
import { CommunityAvatar } from '@/components/community/community-avatar'
import { GroupIcon } from '@/components/groups/group-icon'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DEFAULT_AVATAR_ICON } from '@/lib/avatar-icons'
import { DEFAULT_ACCENT } from '@/lib/accents'
import { useApp } from '@/components/providers'

export function InvitePreviewDialog({
    invite,
    onClose,
}: {
    invite: GroupInvite
    onClose: () => void
}) {
    const router = useRouter()
    const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
    const author = getMarketAuthor(invite.fromSlug)

    const { userId } = useApp()
    
    const accept = async () => {
        if (!userId) return
        setBusy('accept')
        try {
            const groupId = await acceptIncomingInvite(invite, userId)
            toast.success(`Vous avez rejoint « ${invite.groupName} ».`)
            onClose()
            router.push(`/groupes/${groupId}`)
        } catch {
            toast.error("Impossible de rejoindre le groupe.")
            setBusy(null)
        }
    }

    const decline = async () => {
        setBusy('decline')
        try {
            await declineInvite(invite.id)
            toast.success('Invitation refusée.')
            onClose()
        } catch {
            setBusy(null)
        }
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <GroupIcon icon="Sigma" className="size-12 shrink-0 rounded-xl" iconClassName="size-6" />
                        <div className="min-w-0">
                            <DialogTitle className="text-pretty">{invite.groupName}</DialogTitle>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Users className="size-3.5" />
                                {invite.memberCount} membre{invite.memberCount > 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                {invite.groupDescription && (
                    <p className="text-sm text-muted-foreground text-pretty">{invite.groupDescription}</p>
                )}

                <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 p-3">
                    <CommunityAvatar
                        icon={author?.avatarIcon ?? DEFAULT_AVATAR_ICON}
                        accent={author?.accent ?? DEFAULT_ACCENT}
                        className="size-9 shrink-0"
                        iconClassName="size-4"
                    />
                    <p className="text-sm">
                        <span className="font-medium">{invite.fromName}</span>
                        <span className="text-muted-foreground"> vous a invité à rejoindre ce groupe.</span>
                    </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={decline}
                        disabled={busy !== null}
                    >
                        {busy === 'decline' && <Loader2 className="size-4 animate-spin" />}
                        Refuser
                    </Button>
                    <Button className="flex-1 gap-2" onClick={accept} disabled={busy !== null}>
                        {busy === 'accept' && <Loader2 className="size-4 animate-spin" />}
                        Rejoindre
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}