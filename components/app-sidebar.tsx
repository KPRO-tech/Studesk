'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  ListChecks,
  ClipboardList,
  CalendarDays,
  Wallet,
  Sparkles,
  Settings,
  Compass,
  Users
} from 'lucide-react'
import { useApp } from '@/components/providers'
import { getAvatarIcon, DEFAULT_AVATAR_ICON } from '@/lib/avatar-icons'
import { cn } from '@/lib/utils'

const NAV_GROUPS = [
  {
    label: 'Étudier',
    items: [
      { href: '/', label: 'Tableau de bord', icon: LayoutDashboard },
      { href: '/notes', label: 'Fiches & Cours', icon: BookOpen },
      { href: '/flashcards', label: 'Flashcards', icon: Layers },
      { href: '/quiz', label: 'Quiz', icon: ListChecks },
    ],
  },
  {
    label: 'Organiser',
    items: [
      { href: '/calendar', label: 'Planning', icon: CalendarDays },
      { href: '/tasks', label: 'To-Do', icon: ClipboardList },
      { href: '/budget', label: 'Portefeuille', icon: Wallet },
    ],
  },

  {
    label: 'Studesk Hub',
    items: [
      { href: '/communaute', label: 'Communauté', icon: Compass },
      { href: '/groupes', label: 'Workspace', icon: Users },
    ],
  },

] as const

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { user, settings } = useApp()
  const AvatarIcon = getAvatarIcon(settings?.avatarIcon ?? DEFAULT_AVATAR_ICON)
  const workspace = settings?.workspaceName || 'Mon Studesk'

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Workspace header */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <AvatarIcon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-semibold leading-tight">
            {workspace}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {user?.firstName ?? 'Invité'} {user?.lastName ?? ''}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-col gap-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                        )}
                      >
                        <item.icon
                          className={cn('size-[18px]', active && 'text-primary')}
                        />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="flex flex-col gap-0.5 border-t border-sidebar-border px-3 py-3">
        <FooterLink href="/ai" label="Skarlet" icon={Sparkles} pathname={pathname} onNavigate={onNavigate} />
        <FooterLink href="/settings" label="Paramètres" icon={Settings} pathname={pathname} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

function FooterLink({
  href,
  label,
  icon: Icon,
  pathname,
  onNavigate,
}: {
  href: string
  label: string
  icon: typeof Settings
  pathname: string
  onNavigate?: () => void
}) {
  const active = pathname.startsWith(href)
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
      )}
    >
      <Icon className={cn('size-[18px]', active && 'text-primary')} />
      {label}
    </Link>
  )
}
