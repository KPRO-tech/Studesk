'use client'

import { useRouter } from 'next/navigation'
import { Menu, Sun, Moon, LogOut, User as UserIcon, Settings, User, Mail } from 'lucide-react'
import { useApp } from '@/components/providers'
import { SyncIndicator } from '@/components/sync-indicator'
import { LiveClock } from '@/components/live-clock'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { getAvatarIcon } from '@/lib/avatar-icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'

export function AppTopbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter()
  const { user, settings, signOut } = useApp()
  const AvatarIcon = getAvatarIcon(settings?.avatarIcon)

  const toggleTheme = async () => {
    if (!settings) return
    const isDark = document.documentElement.classList.contains('dark')
    await db.settings.update(settings.id, {
      theme: isDark ? 'light' : 'dark',
      updatedAt: Date.now(),
      sync: 'pending',
    })
  }

  const handleSignOut = () => {
    signOut()
    router.replace('/login')
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-sm">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Ouvrir le menu"
      >
        <Menu className="size-5" />
      </Button>

      <LiveClock
        locale={settings?.locale ?? 'fr-FR'}
        className="hidden text-sm text-muted-foreground md:inline-flex"
      />

      <div className="ml-auto flex items-center gap-2">
        <SyncIndicator />
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Changer le thème"
        >
          <Sun className="size-[18px] dark:hidden" />
          <Moon className="hidden size-[18px] dark:block" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
            aria-label="Menu du compte"
          >
            <AvatarIcon className="size-[18px]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col">
                <span className="font-medium flex items-center gap-1">
                  <User className="size-3" />
                  {user ? `${user.firstName} ${user.lastName}` : 'Compte'}
                </span>
                <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                  <Mail className="size-3" />
                  {user?.email}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="size-4" />
              Paramètres
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} variant="destructive">
              <LogOut className="size-4" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
