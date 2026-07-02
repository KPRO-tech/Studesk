'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import { db } from '@/lib/db'
import { slugify, isValidSlug, isSlugAvailable } from '@/lib/slug'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export const PUBLIC_PROFILE_BASE = 'studesk.vercel.app/u/'

type Status = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

export function SlugEditor({
    userId,
    currentSlug,
    autoFocus,
    saveLabel = 'Enregistrer',
    onSaved,
}: {
    userId: string
    currentSlug?: string
    autoFocus?: boolean
    saveLabel?: string
    onSaved?: (slug: string) => void
}) {
    const [value, setValue] = useState(currentSlug ?? '')
    const [status, setStatus] = useState<Status>('idle')
    const [saving, setSaving] = useState(false)
    const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Debounced availability check whenever the (normalized) value changes.
    useEffect(() => {
        const slug = value.trim().toLowerCase()
        if (debounce.current) clearTimeout(debounce.current)

        if (!slug || slug === (currentSlug ?? '')) {
            setStatus('idle')
            return
        }
        if (!isValidSlug(slug)) {
            setStatus('invalid')
            return
        }
        setStatus('checking')
        debounce.current = setTimeout(async () => {
            const ok = await isSlugAvailable(slug, userId)
            setStatus(ok ? 'available' : 'taken')
        }, 400)
        return () => {
            if (debounce.current) clearTimeout(debounce.current)
        }
    }, [value, currentSlug, userId])

    const save = async () => {
        const slug = value.trim().toLowerCase()
        if (!isValidSlug(slug)) {
            toast.error('Identifiant invalide (3 à 24 lettres, chiffres ou tirets).')
            return
        }
        setSaving(true)
        try {
            const ok = await isSlugAvailable(slug, userId)
            if (!ok) {
                setStatus('taken')
                toast.error('Cet identifiant est déjà pris.')
                return
            }
            await db.users.update(userId, { slug })
            setStatus('idle')
            toast.success('Identifiant public enregistré.')
            onSaved?.(slug)
        } finally {
            setSaving(false)
        }
    }

    const canSave =
        !saving &&
        value.trim().length > 0 &&
        value.trim().toLowerCase() !== (currentSlug ?? '') &&
        (status === 'available' || status === 'idle')

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-stretch rounded-lg border border-border bg-background focus-within:border-primary">
                <span className="flex items-center whitespace-nowrap rounded-l-lg border-r border-border bg-muted px-3 text-sm text-muted-foreground">
                    {PUBLIC_PROFILE_BASE}
                </span>
                <Input
                    value={value}
                    autoFocus={autoFocus}
                    onChange={(e) => setValue(slugify(e.target.value))}
                    placeholder="yvann"
                    className="border-0 shadow-none focus-visible:ring-0"
                    aria-label="Identifiant public"
                />
            </div>

            <div className="flex min-h-5 items-center justify-between gap-2">
                <StatusHint status={status} />
                <Button size="sm" onClick={save} disabled={!canSave} className="shrink-0">
                    {saving ? 'Enregistrement…' : saveLabel}
                </Button>
            </div>
        </div>
    )
}

function StatusHint({ status }: { status: Status }) {
    if (status === 'checking')
        return (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Vérification…
            </span>
        )
    if (status === 'available')
        return (
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Check className="size-3.5" /> Disponible
            </span>
        )
    if (status === 'taken')
        return (
            <span className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <X className="size-3.5" /> Déjà pris
            </span>
        )
    if (status === 'invalid')
        return (
            <span className="text-xs text-muted-foreground">
                3 à 24 caractères : lettres, chiffres ou tirets.
            </span>
        )
    return <span className={cn('text-xs text-muted-foreground')}>&nbsp;</span>
}