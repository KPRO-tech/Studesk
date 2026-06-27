'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GraduationCap, Clock, Coins } from 'lucide-react'
import { signUp } from '@/lib/auth'
import { useApp } from '@/components/providers'
import { COUNTRIES, getCountry } from '@/lib/countries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Eye, EyeOff } from "lucide-react"
import { toast } from 'sonner'

export default function SignupPage() {
  const router = useRouter()
  const { refreshSession } = useApp()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    country: 'FR',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (k: keyof typeof form, v: string) =>
    setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    setLoading(true)
    try {
      await signUp(form)
      refreshSession()
      router.replace('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Inscription impossible.')
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-12 font-heading text-5xl font-semibold rounded-md bg-primary text-black p-1 hover:text-primary hover:bg-background transition-all duration-500">
          Studesk
        </span>
        <h1 className="font-heading text-2xl font-semibold">Rejoignez la communauté Studesk</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Découvrez la plateforme tout-en-un pour une meilleure organisation de vos études, de votre temps et de vos ressources.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firstName">Prénom</Label>
            <Input
              id="firstName"
              required
              value={form.firstName}
              onChange={(e) => set('firstName', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lastName">Nom</Label>
            <Input
              id="lastName"
              required
              value={form.lastName}
              onChange={(e) => set('lastName', e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="vous@exemple.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Mot de passe</Label>

          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="6 caractères minimum"
              className="pr-10"
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="country">Pays</Label>
          <Select value={form.country} onValueChange={(v) => set('country', v || 'FR')}>
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
          <CountryPreview code={form.country} />
        </div>
        <Button type="submit" disabled={loading} size="lg" className="mt-2">
          {loading ? 'Création…' : 'Créer mon compte'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Déjà un compte ?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  )
}

function CountryPreview({ code }: { code: string }) {
  const country = getCountry(code)
  const [now, setNow] = useState<Date | null>(null)

  // Live clock: tick every second, client-only to avoid hydration mismatch.
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
