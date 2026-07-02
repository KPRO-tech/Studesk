import { getGroupIcon } from '@/lib/group-icons'
import { cn } from '@/lib/utils'

/** Renders a group's icon in an accent-tinted rounded tile. */
export function GroupIcon({
    icon,
    className,
    iconClassName,
}: {
    icon: string
    className?: string
    iconClassName?: string
}) {
    const Icon = getGroupIcon(icon)
    return (
        <div
            className={cn(
                'flex items-center justify-center rounded-lg bg-primary/10 text-primary',
                className,
            )}
        >
            <Icon className={cn('size-5', iconClassName)} />
        </div>
    )
}