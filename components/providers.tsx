'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type AppSettings, type User } from '@/lib/db'
import { applyAccent, DEFAULT_ACCENT } from '@/lib/accents'
import { getSessionUserId, clearSession as clearStoredSession } from '@/lib/auth'
import { runSync } from '@/lib/firebase-sync'
import { useFirebaseUser, useOnline } from '@/lib/use-online'

interface AppContextValue {
  userId: string | null
  user: User | undefined
  settings: AppSettings | undefined
  ready: boolean
  refreshSession: () => void
  signOut: () => void
  firebaseUser: import('firebase/auth').User | null
  isInitialSync: boolean
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within Providers')
  return ctx
}

function resolveDark(theme: AppSettings['theme'] | undefined): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function Providers({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const { user: fbUser, loading: fbLoading } = useFirebaseUser()
  const online = useOnline()
  const syncedUsers = useRef<Set<string>>(new Set())
  const [isInitialSync, setIsInitialSync] = useState(false)

  useEffect(() => {
    setUserId(getSessionUserId())
    setReady(true)
  }, [])

  // Sync logic
  useEffect(() => {
    if (!userId || !fbUser || !online) return

    let mounted = true
    const isFirstTime = !syncedUsers.current.has(userId)
    
    if (isFirstTime) {
      syncedUsers.current.add(userId)
      setIsInitialSync(true)
    }

    // Run sync on mount/online
    runSync(userId, fbUser.uid).finally(() => {
      if (mounted && isFirstTime) {
        setIsInitialSync(false)
      }
    })

    // Et toutes les 5 minutes
    const interval = setInterval(() => {
      runSync(userId, fbUser.uid)
    }, 5 * 60 * 1000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [userId, fbUser, online])

  const refreshSession = useCallback(() => setUserId(getSessionUserId()), [])
  const signOut = useCallback(() => {
    clearStoredSession()
    setUserId(null)
  }, [])

  const user = useLiveQuery(
    async () => (userId ? db.users.get(userId) : undefined),
    [userId],
  )
  const settings = useLiveQuery(
    async () => {
      if (!userId) return undefined
      // settings.id can be 'app' or userId depending on legacy data — query by userId field
      return db.settings.where('userId').equals(userId).first()
        ?? db.settings.get('app')
    },
    [userId],
  )

  const theme = settings?.theme ?? 'system'
  const accent = settings?.accent ?? DEFAULT_ACCENT

  // Apply theme + accent reactively, and follow system changes.
  useEffect(() => {
    const apply = () => {
      const dark = resolveDark(theme)
      document.documentElement.classList.toggle('dark', dark)
      applyAccent(accent, dark)
    }
    apply()
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [theme, accent])

  return (
    <AppContext.Provider
      value={{ 
        userId, 
        user, 
        settings, 
        ready, 
        refreshSession, 
        signOut, 
        firebaseUser: fbUser,
        isInitialSync: fbLoading || isInitialSync
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
