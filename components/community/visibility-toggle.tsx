'use client'

import { Globe, Lock } from 'lucide-react'
import type { Visibility } from '@/lib/db'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Compact public/private switch for shareable resources (notes, decks, quizzes).
 * Undefined visibility is treated as private.
 */
export function VisibilityToggle({
    value,
    onChange,
    size = 'sm',
    className,
    disabled,
}: {
    value: Visibility | undefined
    onChange: (next: Visibility) => void
    size?: 'sm' | 'icon'
    className?: string
    disabled?: boolean
}) {
    const isPublic = value === 'public'
    const Icon = isPublic ? Globe : Lock

    if (size === 'icon') {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger
                    disabled={disabled}
                    render={
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn('size-8', isPublic && 'text-primary', className)}
                            aria-label={isPublic ? 'Ressource publique' : 'Ressource privée'}
                        />
                    }
                >
                    <Icon className="size-4" />
                </DropdownMenuTrigger>
                <VisibilityMenu value={value} onChange={onChange} />
            </DropdownMenu>
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                disabled={disabled}
                render={
                    <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                            'h-8 gap-1.5',
                            isPublic && 'border-primary/40 bg-primary/10 text-foreground',
                            className,
                        )}
                    />
                }
            >
                <Icon className={cn('size-3.5', isPublic && 'text-primary')} />
                {isPublic ? 'Public' : 'Privé'}
            </DropdownMenuTrigger>
            <VisibilityMenu value={value} onChange={onChange} />
        </DropdownMenu>
    )
}

function VisibilityMenu({
    value,
    onChange,
}: {
    value: Visibility | undefined
    onChange: (next: Visibility) => void
}) {
    return (
        <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Visibilité</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
                onClick={() => onChange('private')}
                className="flex-col items-start gap-0.5"
            >
                <span className="flex items-center gap-2 font-medium">
                    <Lock className="size-4" /> Privé
                    {value !== 'public' && <span className="ml-auto text-xs text-primary">Actuel</span>}
                </span>
                <span className="pl-6 text-xs text-muted-foreground">
                    Visible uniquement par vous.
                </span>
            </DropdownMenuItem>
            <DropdownMenuItem
                onClick={() => onChange('public')}
                className="flex-col items-start gap-0.5"
            >
                <span className="flex items-center gap-2 font-medium">
                    <Globe className="size-4" /> Public
                    {value === 'public' && <span className="ml-auto text-xs text-primary">Actuel</span>}
                </span>
                <span className="pl-6 text-xs text-muted-foreground">
                    Partagé sur votre profil et la communauté.
                </span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    )
}