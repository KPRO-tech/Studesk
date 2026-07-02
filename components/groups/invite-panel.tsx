'use client'

import { useState } from 'react'
import { Mail, ChevronRight } from 'lucide-react'
import type { GroupInvite } from '@/lib/db'
import { getMarketAuthor } from '@/lib/marketplace'
import { CommunityAvatar } from '@/components/community/community-avatar'
import { InvitePreviewDialog } from '@/components/groups/invite-preview-dialog'
import { DEFAULT_AVATAR_ICON } from '@/lib/avatar-icons'
import { DEFAULT_ACCENT } from '@/lib/accents'

export function InvitePanel({ invites }: { invites: GroupInvite[] }) {
    const [selected, setSelected] = useState<GroupInvite | null>(null)

    if (invites.length === 0) return null

    return (
        <section className="mb-6">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Mail className="size-4" />
                Invitations en attente
            </h2>
            <div className="flex flex-col gap-2">
                {invites.map((invite) => {
                    const author = getMarketAuthor(invite.fromSlug)
                    return (
                        <button
                            key={invite.id}
                            type="button"
                            onClick={() => setSelected(invite)}
                            className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10"
                        >
                            <CommunityAvatar
                                icon={author?.avatarIcon ?? DEFAULT_AVATAR_ICON}
                                accent={author?.accent ?? DEFAULT_ACCENT}
                                className="size-10 shrink-0"
                                iconClassName="size-5"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-pretty">
                                    <span className="font-medium">{invite.fromName}</span> vous invite à rejoindre{' '}
                                    <span className="font-medium">« {invite.groupName} »</span>
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {invite.memberCount} membre{invite.memberCount > 1 ? 's' : ''}
                                </p>
                            </div>
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </button>
                    )
                })}
            </div>

            {selected && (
                <InvitePreviewDialog invite={selected} onClose={() => setSelected(null)} />
            )}
        </section>
    )
}