'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import {
  User as UserIcon,
  Palette as PaletteIcon,
  SunMedium,
  Database,
  Tags,
  RefreshCw,
  Download,
  Upload,
  Check,
  Sun,
  Moon,
  Monitor,
  Cloud,
  CloudOff,
  LoaderCircle,
  Clock,
  Coins,
} from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from '@/components/providers'
import { PageHeader } from '@/components/page-header'
import { CategoryManager } from '@/components/settings/category-manager'
import { db } from '@/lib/db'
import { sendResetEmail, updateUserEmail } from '@/lib/auth'
import { ACCENTS } from '@/lib/accents'
import { AVATAR_ICONS, AVATAR_ICON_KEYS, getAvatarIcon, DEFAULT_AVATAR_ICON } from '@/lib/avatar-icons'
import { exportData, downloadBackup, importData } from '@/lib/backup'
import { useSyncStatus } from '@/lib/use-online'
import { formatDate, formatTime } from '@/lib/dates'
import { COUNTRIES, getCountry } from '@/lib/countries'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { SlugEditor, PUBLIC_PROFILE_BASE } from '@/components/settings/slug-editor'

const THEMES = [
  { key: 'light', label: 'Clair', icon: Sun },
  { key: 'dark', label: 'Sombre', icon: Moon },
  { key: 'system', label: 'Système', icon: Monitor },
] as const

export default function SettingsPage() {
  const { userId, user, settings } = useApp()

  if (!userId || !user || !settings) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Paramètres" description="Chargement…" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Paramètres" description="Gérez votre compte, votre espace et vos données." />

      <Tabs defaultValue="account" className="gap-6">
        <TabsList className="flex h-auto w-full overflow-x-auto justify-start gap-1 bg-transparent p-0 pb-1 scrollbar-hide">
          <TabTrigger value="account" icon={UserIcon} label="Compte" />
          <TabTrigger value="profile" icon={PaletteIcon} label="Profil" />
          <TabTrigger value="appearance" icon={SunMedium} label="Apparence" />
          <TabTrigger value="data" icon={Database} label="Données" />
          <TabTrigger value="categories" icon={Tags} label="Catégories" />
          <TabTrigger value="sync" icon={RefreshCw} label="Sync" />
        </TabsList>

        <TabsContent value="account">
          <AccountSection />
        </TabsContent>
        <TabsContent value="profile">
          <ProfileSection />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceSection />
        </TabsContent>
        <TabsContent value="data">
          <DataSection />
        </TabsContent>
        <TabsContent value="categories">
          <SectionShell title="Catégories" description="Matières, tags, dépenses et événements.">
            <CategoryManager userId={userId} />
          </SectionShell>
        </TabsContent>
        <TabsContent value="sync">
          <SyncSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TabTrigger({
  value,
  icon: Icon,
  label,
}: {
  value: string
  icon: typeof UserIcon
  label: string
}) {
  return (
    <TabsTrigger
      value={value}
      className="shrink-0 gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-sm whitespace-nowrap data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:shadow-none"
    >
      <Icon className="size-4 text-primary" />
      {label}
    </TabsTrigger>
  )
}

function SectionShell({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Compte                                                                     */
/* -------------------------------------------------------------------------- */

function AccountSection() {
  const { userId, user, settings, signOut } = useApp()
  const router = useRouter()

  // Profile form
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [saving, setSaving] = useState(false)
  const profileDirty =
    firstName !== (user?.firstName ?? '') ||
    lastName !== (user?.lastName ?? '') ||
    email !== (user?.email ?? '')

  // Preferences form
  const [country, setCountry] = useState(user?.country ?? '')
  const [currency, setCurrency] = useState(settings?.currency ?? 'EUR')
  const [locale, setLocale] = useState(settings?.locale ?? 'fr-FR')
  const [savingPrefs, setSavingPrefs] = useState(false)
  const prefsDirty = country !== (user?.country ?? '')

  const savePreferences = async () => {
    if (!userId || !settings) return
    setSavingPrefs(true)
    try {
      const selectedCountry = getCountry(country)
      await db.users.update(userId, { country: country.trim(), sync: 'pending' })
      await db.settings.update(settings.id, {
        currency: selectedCountry.currency,
        locale: selectedCountry.locale,
        updatedAt: Date.now(),
        sync: 'pending',
      })
      toast.success('Préférences mises à jour.')
    } catch (e) {
      toast.error('Erreur lors de la sauvegarde.')
    } finally {
      setSavingPrefs(false)
    }
  }

  const handleSignOut = () => {
    signOut()
    router.replace('/login')
  }

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [changing, setChanging] = useState(false)
  const passwordDirty = current.length > 0 || next.length > 0 || confirm.length > 0

  const saveProfile = async () => {
    if (!userId || !user) return
    if (!firstName.trim()) {
      toast.error('Le prénom est requis.')
      return
    }
    setSaving(true)
    try {
      await db.users.update(userId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        sync: 'pending',
      })
      toast.success('Profil mis à jour.')
    } finally {
      setSaving(false)
    }
  }

  const [newEmail, setNewEmail] = useState('')
  const [changingEmail, setChangingEmail] = useState(false)

  const changeEmail = async () => {
    if (!userId || !user) return
    if (!newEmail.trim()) {
      toast.error('Veuillez entrer une nouvelle adresse email.')
      return
    }
    const normalized = newEmail.trim().toLowerCase()
    if (normalized === user.email) {
      toast.info('C\'est déjà votre adresse actuelle.')
      return
    }

    setChangingEmail(true)
    try {
      const existing = await db.users.where('email').equals(normalized).first()
      if (existing && existing.id !== userId) {
        toast.error('Cet email est déjà utilisé.')
        return
      }

      await updateUserEmail(normalized)
      toast.success('Lien de vérification envoyé à ' + normalized + '. Veuillez le valider pour finaliser le changement.')
      setNewEmail('')
    } catch (authErr: any) {
      toast.error(authErr.message || 'Impossible de changer l\'email sur le serveur.')
    } finally {
      setChangingEmail(false)
    }
  }

  const changePassword = async () => {
    if (!userId || !user) return
    setChanging(true)
    try {
      await sendResetEmail(user.email)
      toast.success('Lien de réinitialisation envoyé à votre adresse actuelle.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur.')
    } finally {
      setChanging(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionShell title="Informations" description="Vos informations personnelles.">
        <Card className="flex flex-col gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" id="firstName" value={firstName} onChange={setFirstName} />
            <Field label="Nom" id="lastName" value={lastName} onChange={setLastName} />
          </div>
          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={saving || !profileDirty}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </Card>
      </SectionShell>

      <SectionShell title="Adresse email" description="Modifiez votre adresse de connexion.">
        <Card className="flex flex-col gap-4 p-5">
          <Field
            label="Nouvel email"
            id="newEmail"
            type="email"
            value={newEmail}
            onChange={setNewEmail}
            placeholder={user?.email || 'Nouvelle adresse'}
          />
          <div className="flex justify-end">
            <Button onClick={changeEmail} disabled={changingEmail || !newEmail.trim()} variant="outline">
              {changingEmail ? 'Envoi en cours…' : 'Changer d\'adresse email'}
            </Button>
          </div>
        </Card>
      </SectionShell>

      <SectionShell title="Mot de passe" description="Recevez un lien pour modifier votre mot de passe.">
        <Card className="flex flex-col gap-4 p-5">
          <p className="text-sm text-muted-foreground">
            Un email contenant un lien sécurisé sera envoyé à votre adresse actuelle <strong>{user?.email}</strong>.
          </p>
          <div className="flex justify-end">
            <Button onClick={changePassword} disabled={changing} variant="outline">
              {changing ? 'Envoi en cours…' : 'Envoyer le lien de réinitialisation'}
            </Button>
          </div>
        </Card>
      </SectionShell>

      <SectionShell title="Préférences régionales" description="Horaires et monnaie.">
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="country">Pays</Label>
            <Select value={country} onValueChange={(v) => {
              const safeV = v || 'FR'
              setCountry(safeV)
              const c = getCountry(safeV)
              setLocale(c.locale)
              setCurrency(c.currency)
            }}>
              <SelectTrigger id="country">
                <SelectValue>
                  {(value) => getCountry(value as string).name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CountryPreview code={country} />
          </div>
          <div className="flex justify-end">
            <Button onClick={savePreferences} disabled={savingPrefs || !prefsDirty} variant="outline">
              {savingPrefs ? 'Enregistrement…' : 'Enregistrer les préférences'}
            </Button>
          </div>
        </Card>
      </SectionShell>

      <SectionShell title="Déconnexion" description="Fermer votre session sur cet appareil.">
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Vous devrez vous reconnecter pour accéder à vos données.</p>
            <Button onClick={handleSignOut} variant="destructive">
              Se déconnecter
            </Button>
          </div>
        </Card>
      </SectionShell>
    </div>
  )
}

function Field({
  label,
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Profil                                                                     */
/* -------------------------------------------------------------------------- */

function ProfileSection() {
  const { userId, user, settings } = useApp()
  const [workspaceName, setWorkspaceName] = useState(settings?.workspaceName ?? '')
  const [description, setDescription] = useState(user?.description ?? '')
  const [savingDesc, setSavingDesc] = useState(false)

  if (!settings || !userId || !user) return null

  const workspaceDirty = workspaceName !== (settings.workspaceName ?? '')

  const update = (patch: Record<string, unknown>) =>
    db.settings.update(settings.id, { ...patch, updatedAt: Date.now(), sync: 'pending' })

  const saveName = async () => {
    await update({ workspaceName: workspaceName.trim() || 'Mon espace' })
    toast.success('Nom de l\u2019espace mis à jour.')
  }

  const saveDescription = async () => {
    setSavingDesc(true)
    try {
      await db.users.update(userId, { description: description.trim() })
      toast.success('Description mise à jour.')
    } catch (e) {
      toast.error('Erreur lors de la sauvegarde.')
    } finally {
      setSavingDesc(false)
    }
  }

  const ActiveAvatar = getAvatarIcon(settings.avatarIcon ?? DEFAULT_AVATAR_ICON)

  return (
    <div className="flex flex-col gap-6">

      <SectionShell
        title="Profil public"
        description="Votre identifiant public permet de partager vos ressources publiées."
      >
        <Card className="flex flex-col gap-4 p-5">
          <SlugEditor userId={userId} currentSlug={user?.slug} />
          {user?.slug ? (
            <Link
              href={`/u/${user.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <ExternalLink className="size-4" />
              Voir mon profil public
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground">
              Choisissez un identifiant pour activer votre page&nbsp;
              <span className="font-medium text-foreground">{PUBLIC_PROFILE_BASE}…</span>
            </p>
          )}

          <div className="mt-2 flex flex-col gap-3">
            <Label htmlFor="description">Bio / Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Étudiant en droit, j'aime partager mes fiches..."
              className="min-h-[100px]"
            />
            <Button 
              onClick={saveDescription} 
              disabled={savingDesc || description === (user?.description ?? '')}
              className="w-fit"
            >
              {savingDesc ? 'Enregistrement...' : 'Enregistrer la description'}
            </Button>
          </div>
        </Card>
      </SectionShell>


      <SectionShell title="Espace de travail" description="Le nom affiché dans la barre latérale.">
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ActiveAvatar className="size-6" />
            </div>
            <div className="flex flex-1 gap-2">
              <Input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Mon espace"
              />
              <Button onClick={saveName} disabled={!workspaceDirty} className="shrink-0">
                Enregistrer
              </Button>
            </div>
          </div>
        </Card>
      </SectionShell>

      <SectionShell title="Avatar" description="Choisissez une icône pour votre espace.">
        <Card className="p-5">
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {AVATAR_ICON_KEYS.map((key) => {
              const Icon = AVATAR_ICONS[key]
              const active = (settings.avatarIcon ?? DEFAULT_AVATAR_ICON) === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => update({ avatarIcon: key })}
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
        </Card>
      </SectionShell>

      <SectionShell title="Couleur principale" description="La couleur d'accent de l'interface.">
        <Card className="p-5">
          <div className="flex flex-wrap gap-3">
            {ACCENTS.map((accent) => {
              const active = (settings.accent ?? 'clay') === accent.key
              return (
                <button
                  key={accent.key}
                  type="button"
                  onClick={() => update({ accent: accent.key })}
                  className="flex flex-col items-center gap-1.5"
                  aria-label={accent.label}
                >
                  <span
                    className={cn(
                      'flex size-9 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-card transition-all',
                      active ? 'ring-foreground' : 'ring-transparent',
                    )}
                    style={{ backgroundColor: accent.swatch }}
                  >
                    {active && <Check className="size-4 text-white" />}
                  </span>
                  <span className="text-xs text-muted-foreground">{accent.label}</span>
                </button>
              )
            })}
          </div>
        </Card>
      </SectionShell>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Apparence                                                                  */
/* -------------------------------------------------------------------------- */

function AppearanceSection() {
  const { settings } = useApp()
  if (!settings) return null

  const setTheme = (theme: 'light' | 'dark' | 'system') =>
    db.settings.update(settings.id, { theme, updatedAt: Date.now(), sync: 'pending' })

  return (
    <SectionShell title="Apparence" description="Choisissez le thème de l'application.">
      <div className="grid gap-3 sm:grid-cols-3">
        {THEMES.map((t) => {
          const active = (settings.theme ?? 'system') === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTheme(t.key)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border p-5 transition-colors',
                active ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
              )}
            >
              <t.icon className={cn('size-6', active ? 'text-primary' : 'text-muted-foreground')} />
              <span className="text-sm font-medium">{t.label}</span>
            </button>
          )
        })}
      </div>
    </SectionShell>
  )
}

/* -------------------------------------------------------------------------- */
/* Données                                                                    */
/* -------------------------------------------------------------------------- */

function DataSection() {
  const { userId } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)

  const doExport = async () => {
    if (!userId) return
    setBusy('export')
    try {
      const backup = await exportData(userId)
      downloadBackup(backup)
      toast.success('Sauvegarde exportée.')
    } catch {
      toast.error('Échec de l\u2019export.')
    } finally {
      setBusy(null)
    }
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !userId) return
    setBusy('import')
    try {
      const text = await file.text()
      const count = await importData(userId, text)
      toast.success(`${count} éléments importés.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fichier invalide.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <SectionShell title="Données" description="Sauvegardez et restaurez vos données locales.">
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={doExport} disabled={busy !== null} variant="outline" className="flex-1 gap-2">
            {busy === 'export' ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Exporter (JSON)
          </Button>
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null}
            variant="outline"
            className="flex-1 gap-2"
          >
            {busy === 'import' ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Importer (JSON)
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onFile}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          La sauvegarde inclut notes, fiches, tâches, événements, quiz et budget. Les
          enregistrements audio ne sont pas inclus. L'import fusionne les données dans votre
          espace actuel.
        </p>
      </Card>
    </SectionShell>
  )
}

/* -------------------------------------------------------------------------- */
/* Synchronisation                                                            */
/* -------------------------------------------------------------------------- */

function SyncSection() {
  const { userId, settings, firebaseUser } = useApp()
  const status = useSyncStatus(userId)
  const locale = settings?.locale ?? 'fr-FR'
  const [syncing, setSyncing] = useState(false)

  // API Key settings
  const [apiKey, setApiKey] = useState(settings?.openrouterApiKey ?? '')
  const [syncApiKey, setSyncApiKey] = useState(settings?.syncApiKey ?? false)
  const [savingApi, setSavingApi] = useState(false)

  const apiDirty = apiKey !== (settings?.openrouterApiKey ?? '') || syncApiKey !== (settings?.syncApiKey ?? false)

  const saveApi = async () => {
    if (!userId || !settings) return
    setSavingApi(true)
    try {
      await db.settings.update(settings.id, {
        openrouterApiKey: apiKey.trim(),
        syncApiKey,
        updatedAt: Date.now(),
        sync: 'pending',
      })
      toast.success('Clé API enregistrée.')
    } catch (e) {
      toast.error('Erreur lors de la sauvegarde.')
    } finally {
      setSavingApi(false)
    }
  }

  const handleManualSync = async () => {
    if (!userId || !firebaseUser) return
    setSyncing(true)
    try {
      const { runSync } = await import('@/lib/firebase-sync')
      await runSync(userId, firebaseUser.uid)
      toast.success('Synchronisation terminée.')
    } catch (e) {
      toast.error('Échec de la synchronisation.')
    } finally {
      setSyncing(false)
    }
  }

  const state =
    status === 'offline'
      ? { icon: CloudOff, label: 'Hors ligne', tone: 'text-destructive', desc: 'Vos modifications sont enregistrées localement.' }
      : status === 'pending'
        ? { icon: RefreshCw, label: 'Modifications en attente', tone: 'text-amber-600 dark:text-amber-500', desc: 'Des données seront synchronisées dès que possible.' }
        : { icon: Cloud, label: 'Synchronisé', tone: 'text-primary', desc: 'Toutes vos données locales sont à jour.' }

  return (
    <div className="flex flex-col gap-6">
      <SectionShell title="État de la synchronisation">
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-11 items-center justify-center rounded-lg bg-muted">
              <state.icon className={cn('size-5', state.tone, syncing && 'animate-spin')} />
            </div>
            <div>
              <p className={cn('font-medium', state.tone)}>{state.label}</p>
              <p className="text-sm text-muted-foreground">{state.desc}</p>
            </div>
          </div>
          <Button onClick={handleManualSync} disabled={syncing || status === 'offline' || !firebaseUser} variant="outline">
            {syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}
          </Button>
        </Card>
      </SectionShell>

      <SectionShell title="Compte Cloud" description="Firebase Auth">
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm">Connecté en tant que</span>
            <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
              {firebaseUser ? firebaseUser.email : 'Non connecté'}
            </span>
          </div>
        </Card>
      </SectionShell>

      <SectionShell title="Clé API IA" description="Configuration de votre propre clé OpenRouter.">
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="apiKey">Clé API (optionnel)</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Si aucune clé n'est fournie, la clé par défaut de la plateforme sera utilisée.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex flex-col gap-1">
              <Label>Synchroniser la clé</Label>
              <p className="text-xs text-muted-foreground">Sauvegarder cette clé sur le cloud pour l'utiliser sur tous vos appareils.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={syncApiKey}
              onClick={() => setSyncApiKey(!syncApiKey)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
                syncApiKey ? "bg-primary" : "bg-input"
              )}
            >
              <span className={cn(
                "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                syncApiKey ? "translate-x-4" : "translate-x-0"
              )} />
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={saveApi} disabled={savingApi || !apiDirty} variant="outline">
              {savingApi ? 'Enregistrement…' : 'Enregistrer la configuration IA'}
            </Button>
          </div>
        </Card>
      </SectionShell>

      <SectionShell title="Historique">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">
            Dernière activité locale : {formatDate(Date.now(), locale)} à {formatTime(Date.now(), locale)}.
          </p>
          {settings?.lastSyncedAt && (
            <p className="text-sm text-muted-foreground mt-1">
              Dernière synchronisation cloud : {formatDate(settings.lastSyncedAt, locale)} à {formatTime(settings.lastSyncedAt, locale)}.
            </p>
          )}
        </Card>
      </SectionShell>
    </div>
  )
}
function CountryPreview({ code }: { code: string }) {
  const country = getCountry(code)
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  let timeLabel = '—'
  let offsetLabel = ''
  if (now) {
    const parts = new Intl.DateTimeFormat(country.locale, {
      timeZone: country.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'shortOffset',
    }).formatToParts(now)
    timeLabel = parts
      .filter((p) => ['hour', 'minute', 'second', 'literal'].includes(p.type))
      .map((p) => p.value)
      .join('')
      .trim()
    offsetLabel = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  }

  const currencyLabel = new Intl.NumberFormat(country.locale, {
    style: 'currency',
    currency: country.currency,
    maximumFractionDigits: 0,
  }).format(1234)

  return (
    <div className="mt-1 flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{country.name}</span>
        <span className="rounded-md bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {country.currency}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="size-4 shrink-0" aria-hidden />
        <span className="tabular-nums text-foreground">{timeLabel}</span>
        {offsetLabel && (
          <span className="font-medium text-foreground">{offsetLabel}</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Coins className="size-4 shrink-0" aria-hidden />
        <span>
          Devise : <span className="text-foreground">{currencyLabel}</span>
        </span>
      </div>
    </div>
  )
}
