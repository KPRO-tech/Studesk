'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Read-only text with a copy-to-clipboard button. */
export function CopyField({ value, className }: { value: string; className?: string }) {
    const [copied, setCopied] = useState(false)

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            toast.success('Lien copié dans le presse-papiers.')
            setTimeout(() => setCopied(false), 1500)
        } catch {
            toast.error('Impossible de copier le lien.')
        }
    }

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <code className="flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-lg border border-border bg-muted/50 px-3 text-xs text-muted-foreground">
                <span className="truncate">{value}</span>
            </code>
            <Button variant="outline" size="icon" className="size-9 shrink-0" onClick={copy} aria-label="Copier le lien">
                {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
            </Button>
        </div>
    )
}