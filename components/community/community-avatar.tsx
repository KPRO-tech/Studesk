import { getAvatarIcon } from '@/lib/avatar-icons'
import { getAccent } from '@/lib/accents'
import { cn } from '@/lib/utils'

/**
 * Renders a user's chosen icon on their chosen accent color. Used across the
 * community library and public profile pages.
 */
export function CommunityAvatar({
    icon,
    accent,
    className,
    iconClassName,
}: {
    icon: string
    accent: string
    className?: string
    iconClassName?: string
}) {
    const Icon = getAvatarIcon(icon)
    const preset = getAccent(accent)
    return (
        <div
            className={cn('flex items-center justify-center rounded-lg', className)}
            style={{ backgroundColor: preset.swatch, color: preset.light.foreground }}
        >
            <Icon className={cn('size-5', iconClassName)} />
        </div>
    )
}