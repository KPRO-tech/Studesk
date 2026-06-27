'use client'

import { useEffect, useState } from 'react'
import { KeyRound, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { db, type AppSettings } from '@/lib/db'
import { FREE_MODELS, DEFAULT_MODEL } from '@/lib/ai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CUSTOM = '__custom__'

export function AiSettingsDialog({
  settings,
  open,
  onOpenChange,
}: {
  settings: AppSettings
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [customModel, setCustomModel] = useState('')

  // Hydrate fields when the dialog opens.
  useEffect(() => {
    if (!open) return
    setApiKey(settings.openrouterApiKey ?? '')
    const saved = settings.openrouterModel ?? ''
    if (!saved || FREE_MODELS.some((m) => m.id === saved)) {
      setModel(saved)
      setCustomModel('')
    } else {
      setModel(CUSTOM)
      setCustomModel(saved)
    }
  }, [open, settings])

  const hasKey = apiKey.trim().length > 0

  const save = async () => {
    const resolvedModel = model === CUSTOM ? customModel.trim() : model
    await db.settings.update(settings.id, {
      openrouterApiKey: apiKey.trim(),
      openrouterModel: resolvedModel,
      updatedAt: Date.now(),
      sync: 'pending',
    })
    toast.success('Réglages IA enregistrés')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            Réglages de l&apos;assistant
          </DialogTitle>
          <DialogDescription>
            Sans clé, l&apos;assistant utilise un modèle gratuit par défaut. Ajoute ta
            propre clé OpenRouter pour choisir n&apos;importe quel modèle.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-key">Clé API OpenRouter (optionnel)</Label>
            <Input
              id="ai-key"
              type="password"
              placeholder="sk-or-v1-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Obtenir une clé sur openrouter.ai
              <ExternalLink className="size-3" />
            </a>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-model">Modèle</Label>
            <Select value={model} onValueChange={(v) => setModel(v ?? '')}>
              <SelectTrigger id="ai-model">
                <SelectValue placeholder={`Par défaut (${DEFAULT_MODEL})`} />
              </SelectTrigger>
              <SelectContent>
                {FREE_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM} disabled={!hasKey}>
                  Modèle personnalisé{!hasKey ? ' (clé requise)' : ''}
                </SelectItem>
              </SelectContent>
            </Select>

            {model === CUSTOM && (
              <Input
                placeholder="ex. anthropic/claude-3.5-sonnet"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                autoComplete="off"
              />
            )}

            <p className="text-xs text-muted-foreground">
              {hasKey
                ? 'Avec ta clé, tu peux utiliser n\'importe quel modèle OpenRouter (gratuit ou payant).'
                : 'Les modèles gratuits sont disponibles sans clé personnelle.'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={save}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
