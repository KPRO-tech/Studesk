import { db } from './db'

/**
 * JSON backup of all user data (audio blobs excluded — they are binary and
 * stored separately). Designed to be restored on the same or another device.
 */

const EXPORT_VERSION = 1

export interface BackupFile {
  app: 'deskia'
  version: number
  exportedAt: number
  userId: string
  data: Record<string, unknown[]>
}

/** Tables that hold serializable, per-user records. */
const TABLES = [
  'notes',
  'decks',
  'cards',
  'reviews',
  'tasks',
  'tags',
  'events',
  'subjects',
  'categories',
  'quizzes',
  'quizAttempts',
  'transactions',
  'goals',
] as const

export async function exportData(userId: string): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {}
  for (const name of TABLES) {
    const table = (db as unknown as Record<string, { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<unknown[]> } } }>)[name]
    data[name] = await table.where('userId').equals(userId).toArray()
  }
  return {
    app: 'deskia',
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    userId,
    data,
  }
}

export function downloadBackup(backup: BackupFile) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `deskia-backup-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importData(userId: string, raw: string): Promise<number> {
  const parsed = JSON.parse(raw) as BackupFile
  if (parsed.app !== 'deskia' || !parsed.data) {
    throw new Error('Fichier de sauvegarde invalide.')
  }
  let count = 0
  await db.transaction('rw', db.tables, async () => {
    for (const name of TABLES) {
      const rows = parsed.data[name]
      if (!Array.isArray(rows)) continue
      // Re-scope every record to the current user so imports never leak across accounts.
      const scoped = rows.map((r) => ({ ...(r as object), userId }))
      const table = (db as unknown as Record<string, { bulkPut: (v: unknown[]) => Promise<unknown> }>)[name]
      await table.bulkPut(scoped)
      count += scoped.length
    }
  })
  return count
}
