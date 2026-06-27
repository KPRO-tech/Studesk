'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GraduationCap } from 'lucide-react'
import { signIn } from '@/lib/auth'
import { useApp } from '@/components/providers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { refreshSession } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn(email, password)
      refreshSession()
      router.replace('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connexion impossible.')
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-12 font-heading text-5xl font-semibold rounded-md bg-primary text-black p-1 hover:text-primary hover:bg-background transition-all duration-500">
          Studesk
        </span>
        <h1 className="font-heading text-2xl font-semibold">Bon retour</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connectez-vous à votre espace.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Mot de passe</Label>

          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
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
        <p className="text-sm text-muted-foreground flex justify-end"><Link href="/reset-mdp" className="font-medium text-primary hover:underline">
          Mot de passe oublié ?
        </Link></p>
        <Button type="submit" disabled={loading} size="lg" className="mt-2">
          {loading ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  )
}
