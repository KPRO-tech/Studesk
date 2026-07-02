'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Trash2, Link2, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import type { Group } from '@/lib/db'
import { updateGroup, regenerateJoinCode, deleteGroup, getInviteUrl } from '@/lib/groups'
import { GROUP_ICONS, GROUP_ICON_KEYS } from '@/lib/group-icons'
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
import { Switch } from '@/components/ui/switch'
import { CopyField } from '@/components/groups/copy-field'
import { cn } from '@/lib/utils'

export function GroupSettingsDialog({
    open,
    onOpenChange,
    group,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    group: Group
}) {
    const router = useRouter()
    const [name, setName] = useState(group.name)
    const [description, setDescription] = useState(group.description)
    const [saving, setSaving] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const saveInfo = async () => {
        if (!name.trim()) {
            toast.error('Le nom ne peut pas être vide.')
            return
        }
        setSaving(true)
        try {
            await updateGroup(group.id, { name: name.trim(), description: description.trim() })
            toast.success('Groupe mis à jour.')
        } finally {
            setSaving(false)
        }
    }

    const chooseIcon = (icon: string) => updateGroup(group.id, { icon })

    const toggleLink = (linkEnabled: boolean) => updateGroup(group.id, { linkEnabled })

    const regenerate = async () => {
        await regenerateJoinCode(group.id)
        toast.success('Nouveau lien généré.')
    }

    const doDelete = async () => {
        setDeleting(true)
        try {
            await deleteGroup(group.id)
            toast.success('Groupe supprimé.')
            onOpenChange(false)
            router.push('/groupes')
        } catch {
            toast.error('La suppression a échoué.')
            setDeleting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Paramètres du groupe</DialogTitle>
                    <DialogDescription>Modifiez les informations et le lien d&apos;invitation.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-2">
                    <Label htmlFor="settings-name">Nom</Label>
                    <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div className="flex flex-col gap-2">
                    <Label htmlFor="settings-desc">Description</Label>
                    <Textarea
                        id="settings-desc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                    />
                </div>

                <div className="flex justify-end">
                    <Button size="sm" onClick={saveInfo} disabled={saving} className="gap-1.5">
                        {saving && <Loader2 className="size-4 animate-spin" />}
                        Enregistrer
                    </Button>
                </div>

                <div className="flex flex-col gap-2">
                    <Label>Icône</Label>
                    <div className="grid grid-cols-6 gap-2">
                        {GROUP_ICON_KEYS.map((key) => {
                            const Icon = GROUP_ICONS[key]
                            const active = group.icon === key
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => chooseIcon(key)}
                                    aria-label={key}
                                    className={cn(
                                        'flex aspect-square items-center justify-center rounded-lg border transition-colors',
                                        active
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border text-muted-foreground hover:bg-accent',
                                    )}
                                >
                                    <Icon className="size-5" />
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Invite link */}
                <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-sm font-medium">
                                <Link2 className="size-4" /> Rejoindre par lien
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Autoriser quiconque possède le lien à rejoindre.
                            </p>
                        </div>
                        <Switch checked={group.linkEnabled} onCheckedChange={toggleLink} />
                    </div>
                    {group.linkEnabled && (
                        <>
                            <CopyField value={getInviteUrl(group)} />
                            <Button variant="outline" size="sm" onClick={regenerate} className="gap-1.5 self-start">
                                <RefreshCw className="size-3.5" /> Régénérer le lien
                            </Button>
                        </>
                    )}
                </div>

                {/* Danger zone */}
                <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                        <AlertTriangle className="size-4" /> Zone de danger
                    </p>
                    {confirmDelete ? (
                        <div className="flex flex-col gap-2">
                            <p className="text-xs text-muted-foreground">
                                Cette action est irréversible. Le groupe et son historique seront supprimés.
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => setConfirmDelete(false)}
                                    disabled={deleting}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="flex-1 gap-1.5"
                                    onClick={doDelete}
                                    disabled={deleting}
                                >
                                    {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                                    Supprimer
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button
                            variant="destructive"
                            size="sm"
                            className="gap-1.5 self-start"
                            onClick={() => setConfirmDelete(true)}
                        >
                            <Trash2 className="size-4" /> Supprimer le groupe
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}