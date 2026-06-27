'use client'

import { useState } from 'react'
import { GraduationCap, User, Briefcase, Check } from 'lucide-react'
import { db, type ProfileType } from '@/lib/db'
import { seedDefaults } from '@/lib/defaults'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const OPTIONS: { key: ProfileType; label: string; desc: string; icon: typeof User }[] = [
  { key: 'student', label: 'Étudiant', desc: 'Matières, révisions, examens', icon: GraduationCap },
  { key: 'personal', label: 'Personnel', desc: 'Maison, santé, loisirs', icon: User },
  { key: 'business', label: 'Business', desc: 'Clients, finance, projets', icon: Briefcase },
]

export function OnboardingDialog({ userId }: { userId: string }) {
  const [selected, setSelected] = useState<ProfileType[]>(['student'])
  const [saving, setSaving] = useState(false)

  const toggle = (key: ProfileType) =>
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )

  const confirm = async () => {
    if (selected.length === 0) {
      toast.error('Sélectionnez au moins un usage.')
      return
    }
    setSaving(true)
    try {
      await seedDefaults(userId, selected)
      await db.settings.update(userId, {
        profiles: selected,
        onboarded: true,
        updatedAt: Date.now(),
        sync: 'pending',
      })
      toast.success('Votre espace est prêt !')
    } catch {
      toast.error('Une erreur est survenue.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <div className="text-center">
          <h2 className="font-heading text-xl font-semibold">
            Quel est votre usage principal ?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Nous préconfigurons vos catégories, matières et tags. Vous pourrez tout
            modifier plus tard. Plusieurs choix possibles.
          </p>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          {OPTIONS.map((opt) => {
            const active = selected.includes(opt.key)
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggle(opt.key)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                  active
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent',
                )}
              >
                <div
                  className={cn(
                    'flex size-10 items-center justify-center rounded-md',
                    active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <opt.icon className="size-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
                <div
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full border',
                    active ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                  )}
                >
                  {active && <Check className="size-3.5" />}
                </div>
              </button>
            )
          })}
        </div>

        <Button onClick={confirm} disabled={saving} className="mt-2 w-full" size="lg">
          {saving ? 'Configuration…' : 'Commencer'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
