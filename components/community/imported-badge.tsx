import { Download } from 'lucide-react'
import type { ImportedFrom } from '@/lib/db'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function ImportedBadge({
    importedFrom,
    className,
}: {
    importedFrom?: ImportedFrom
    className?: string
}) {
    if (!importedFrom) return null

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        className={cn(
                            'flex shrink-0 items-center justify-center rounded-full bg-blue-500/10 p-1 text-blue-600 dark:text-blue-400',
                            className,
                        )}
                    >
                        <Download className="size-3" />
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Importé de @{importedFrom.authorSlug}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
