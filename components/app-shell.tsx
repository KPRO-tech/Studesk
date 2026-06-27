'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { useApp } from '@/components/providers'
import { AppSidebar } from '@/components/app-sidebar'
import { AppTopbar } from '@/components/app-topbar'
import { OnboardingDialog } from '@/components/onboarding-dialog'
import { db, type AppSettings, type User } from '@/lib/db'
import { DEFAULT_ACCENT } from '@/lib/accents'
import { DEFAULT_AVATAR_ICON } from '@/lib/avatar-icons'
import { getCountry } from '@/lib/countries'
import { cn } from '@/lib/utils'

function bootstrapSettings(user: User): AppSettings {
  const country = getCountry(user.country)
  return {
    id: user.id,
    userId: user.id,
    workspaceName: `Espace de ${user.firstName}`,
    avatarIcon: DEFAULT_AVATAR_ICON,
    accent: DEFAULT_ACCENT,
    theme: 'system',
    profiles: [],
    onboarded: false,
    openrouterApiKey: '',
    openrouterModel: '',
    locale: country.locale,
    currency: country.currency,
    updatedAt: Date.now(),
    sync: 'synced',
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { ready, userId, user, settings, isInitialSync } = useApp()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Redirect unauthenticated users to login.
  useEffect(() => {
    if (ready && !userId) router.replace('/login')
  }, [ready, userId, router])

  // Bootstrap a settings record the first time we see this user.
  useEffect(() => {
    if (!isInitialSync && userId && user && settings === undefined) {
      db.settings.get(userId).then((existing) => {
        if (!existing) db.settings.add(bootstrapSettings(user))
      })
    }
  }, [userId, user, settings, isInitialSync])

  if (!ready || isInitialSync || (userId && (!user || !settings))) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="size-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="animate-pulse text-sm font-medium text-muted-foreground">
          {isInitialSync ? 'Synchronisation de vos données...' : 'Chargement...'}
        </p>
      </div>
    )
  }

  if (!userId) return null

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border lg:block">
        <div className="sticky top-0 h-screen">
          <AppSidebar />
        </div>
      </aside>

      {/* Mobile sidebar */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <div
          className={cn(
            'absolute inset-0 bg-foreground/30 transition-opacity',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={cn(
            'absolute left-0 top-0 h-full w-72 border-r border-border bg-sidebar transition-transform',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute right-3 top-4 z-10 text-muted-foreground"
            aria-label="Fermer le menu"
          >
            <X className="size-5" />
          </button>
          <AppSidebar onNavigate={() => setMobileOpen(false)} />
        </aside>
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>

      {settings && !settings.onboarded && <OnboardingDialog userId={userId} />}
    </div>
  )
}
