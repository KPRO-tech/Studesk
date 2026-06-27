'use client'

import { useSyncStatus } from '@/lib/use-online'
import { useApp } from '@/components/providers'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const CONFIG = {
  synced: { label: 'Synchronisé', dot: 'bg-[oklch(0.62_0.13_150)]' },
  pending: { label: 'Modifications en attente', dot: 'bg-[oklch(0.72_0.14_75)]' },
  offline: { label: 'Hors ligne', dot: 'bg-destructive' },
} as const

export function SyncIndicator() {
  const { userId } = useApp()
  const status = useSyncStatus(userId)
  const cfg = CONFIG[status]

  return (
    <Tooltip>
      <TooltipTrigger
        className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
        render={<span />}
      >
        <span className="relative flex size-2">
          {status !== 'offline' && (
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-60',
                cfg.dot,
                status === 'pending' && 'animate-ping',
              )}
            />
          )}
          <span className={cn('relative inline-flex size-2 rounded-full', cfg.dot)} />
        </span>
        <span className="sm:inline">{cfg.label}</span>
      </TooltipTrigger>
      <TooltipContent>{cfg.label}</TooltipContent>
    </Tooltip>
  )
}
