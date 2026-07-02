'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Link2, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createGroup, getInviteUrl } from '@/lib/groups'
import type { Group } from '@/lib/db'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CopyField } from '@/components/groups/copy-field'
import { cn } from '@/lib/utils'

const VISIBILITY = [
    { key: false, label: 'Privé', desc: 'Sur invitation uniquement.', icon: Lock },
    { key: true, label: 'Par lien', desc: 'Rejoignable via un lien d’invitation.', icon: Link2 },
] as const

export function CreateGroupDialog({
    open,
    onOpenChange,
    userId,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    userId: string
}) {
    const router = useRouter()
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [linkEnabled, setLinkEnabled] = useState(false)
    const [saving, setSaving] = useState(false)
    const [created, setCreated] = useState<Group | null>(null)

    const reset = () => {
        setName('')
        setDescription('')
        setLinkEnabled(false)
        setSaving(false)
        setCreated(null)
    }

    const handleOpenChange = (next: boolean) => {
        if (!next) reset()
        onOpenChange(next)
    }

    const submit = async () => {
        if (!name.trim()) {
            toast.error('Donnez un nom à votre groupe.')
            return
        }
        setSaving(true)
        try {
            const group = await createGroup(userId, { name, description, linkEnabled })
            setCreated(group)
        } catch {
            toast.error('La création a échoué.')
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                {created ? (
                    <>
                        <DialogHeader>
                            <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Check className="size-5" />
                            </div>
                            <DialogTitle className="text-center">Groupe créé</DialogTitle>
                            <DialogDescription className="text-center">
                                « {created.name} » est prêt. Partagez le lien pour inviter des membres.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-2">
                            <Label>Lien d&apos;invitation</Label>
                            <CopyField value={getInviteUrl(created)} />
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)}>
                                Fermer
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={() => {
                                    const id = created.id
                                    handleOpenChange(false)
                                    router.push(`/groupes/${id}`)
                                }}
                            >
                                Ouvrir le groupe
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Nouveau groupe</DialogTitle>
                            <DialogDescription>
                                Créez un espace pour partager vos ressources avec d&apos;autres étudiants.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="group-name">Nom du groupe</Label>
                            <Input
                                id="group-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex. Révisions Bio L2"
                                autoFocus
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="group-desc">Description (optionnel)</Label>
                            <Textarea
                                id="group-desc"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="À quoi sert ce groupe ?"
                                rows={2}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label>Visibilité</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {VISIBILITY.map((v) => {
                                    const active = linkEnabled === v.key
                                    return (
                                        <button
                                            key={v.label}
                                            type="button"
                                            onClick={() => setLinkEnabled(v.key)}
                                            className={cn(
                                                'flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors',
                                                active ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
                                            )}
                                        >
                                            <span className="flex items-center gap-1.5 text-sm font-medium">
                                                <v.icon className={cn('size-4', active && 'text-primary')} />
                                                {v.label}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{v.desc}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <Button onClick={submit} disabled={saving} className="w-full gap-2">
                            {saving && <Loader2 className="size-4 animate-spin" />}
                            Créer le groupe
                        </Button>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}