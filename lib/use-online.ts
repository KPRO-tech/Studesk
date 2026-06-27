'use client'

import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { firebaseAuth } from './firebase'
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'

export function useOnline() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    setOnline(navigator.onLine)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export type SyncStatus = 'synced' | 'pending' | 'offline'

export function useFirebaseUser() {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false)
      return
    }
    return onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  return { user, loading }
}

export function useSyncStatus(userId: string | null): SyncStatus {
  const online = useOnline()
  const { user: fbUser } = useFirebaseUser()

  const pending = useLiveQuery(async () => {
    if (!userId) return 0
    const tables = [
      'notes', 'tasks', 'events', 'decks', 'cards', 'routines',
      'subjects', 'categories', 'tags', 'quizzes', 'quizAttempts',
      'conversations', 'transactions', 'goals', 'reviews',
      'settings', 'users'
    ] as const

    const counts = await Promise.all(
      tables.map(table =>
        // Users table key is just `id`, not `userId`, but we only want the current user's document
        table === 'users' 
          ? db.users.where('id').equals(userId).filter((u: any) => u.sync === 'pending').count()
          : table === 'settings'
            ? db.settings.where('userId').equals(userId).filter((s: any) => s.sync === 'pending').count()
            : (db as any)[table].where('userId').equals(userId).filter((r: any) => r.sync === 'pending').count()
      )
    )
    // Also count pending deletions (these don't have a userId field)
    const deletionCount = await db.deletedSyncs.count()
    return counts.reduce((acc, count) => acc + count, 0) + deletionCount
  }, [userId]) ?? 0

  if (!online) return 'offline'
  if (!fbUser) return 'offline' // If not logged into Firebase, it's effectively offline for sync
  if (pending > 0) return 'pending'
  return 'synced'
}
