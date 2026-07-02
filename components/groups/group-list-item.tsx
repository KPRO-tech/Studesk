'use client'

import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { Users, Paperclip } from 'lucide-react'
import { db, type Group } from '@/lib/db'
import { GroupIcon } from '@/components/groups/group-icon'
import { formatRelativeTime } from '@/lib/dates'

export function GroupListItem({ group }: { group: Group }) {
    const members = useLiveQuery(
        () => db.groupMembers.where('groupId').equals(group.id).toArray(),
        [group.id],
    )
    const lastMessage = useLiveQuery(
        () => db.groupMessages.where('groupId').equals(group.id).reverse().sortBy('createdAt').then((m) => m[0]),
        [group.id],
    )

    const memberCount = members?.length ?? 0

    const authorName = (() => {
        if (!lastMessage || !members) return null
        if (lastMessage.authorSlug === '@me') return 'Vous'
        return members.find((m) => m.slug === lastMessage.authorSlug)?.name ?? 'Membre'
    })()

    return (
        <Link
            href={`/groupes/${group.id}`}
            className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
        >
            <GroupIcon icon={group.icon} className="size-12 shrink-0 rounded-xl" iconClassName="size-6" />
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{group.name}</p>
                    {lastMessage && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                            {formatRelativeTime(lastMessage.createdAt)}
                        </span>
                    )}
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                    {lastMessage ? (
                        <>
                            <span className="shrink-0 font-medium text-foreground/70">{authorName} :</span>
                            {lastMessage.text ? (
                                <span className="truncate">{lastMessage.text}</span>
                            ) : (
                                <span className="flex items-center gap-1 truncate">
                                    <Paperclip className="size-3.5" />
                                    {lastMessage.attachment?.title ?? 'Pièce jointe'}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="flex items-center gap-1.5">
                            <Users className="size-3.5" />
                            {memberCount} membre{memberCount > 1 ? 's' : ''}
                        </span>
                    )}
                </p>
            </div>
        </Link>
    )
}