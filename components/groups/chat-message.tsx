'use client'

import type { GroupMessage } from '@/lib/db'
import { CommunityAvatar } from '@/components/community/community-avatar'
import { AttachmentCard } from '@/components/groups/attachment-card'
import { formatTime } from '@/lib/dates'
import { cn } from '@/lib/utils'

export interface ResolvedAuthor {
    name: string
    slug: string
    avatarIcon: string
    accent: string
    isSelf: boolean
}

export function ChatMessage({
    message,
    author,
    importing,
    imported,
    onPreview,
    onImport,
}: {
    message: GroupMessage
    author: ResolvedAuthor
    importing?: boolean
    imported?: boolean
    onPreview: () => void
    onImport: () => void
}) {
    const own = author.isSelf

    return (
        <div className={cn('flex gap-3', own && 'flex-row-reverse')}>
            <CommunityAvatar
                icon={author.avatarIcon}
                accent={author.accent}
                className="mt-0.5 size-8 shrink-0"
                iconClassName="size-4"
            />
            <div className={cn('flex min-w-0 max-w-[85%] flex-col gap-1', own && 'items-end')}>
                <div className={cn('flex items-baseline gap-2', own && 'flex-row-reverse')}>
                    <span className="text-sm font-medium">{own ? 'Vous' : author.name}</span>
                    <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
                </div>

                {message.text && (
                    <div
                        className={cn(
                            'rounded-2xl px-3.5 py-2 text-sm leading-relaxed text-pretty',
                            own
                                ? 'rounded-tr-sm bg-primary text-primary-foreground'
                                : 'rounded-tl-sm bg-muted text-foreground',
                        )}
                    >
                        {message.text}
                    </div>
                )}

                {message.attachment && (
                    <div className="w-72 max-w-full">
                        <AttachmentCard
                            attachment={message.attachment}
                            own={own}
                            importing={importing}
                            imported={imported}
                            onPreview={onPreview}
                            onImport={onImport}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}