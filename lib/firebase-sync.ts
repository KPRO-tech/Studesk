import { db, isSyncing, setSyncing, type AppSettings } from './db'
import { firestore } from './firebase'
import { doc, getDoc, collection, getDocs, writeBatch, setDoc, deleteDoc } from 'firebase/firestore'

const TABLES_TO_SYNC = [
    'notes',
    'decks',
    'cards',
    'tasks',
    'tags',
    'subjects',
    'categories',
    'quizzes',
    'quizAttempts',
    'conversations',
    'routines',
    'transactions',
    'goals'
]

const MAX_BATCH_OPS = 500

/**
 * Deep-cleans an object by removing all undefined values at any nesting level.
 * Uses a JSON round-trip which strips undefined fields automatically.
 */
function clean(obj: any) {
    if (!obj) return obj
    return JSON.parse(JSON.stringify(obj))
}

export async function pushPending(userId: string, firebaseUid: string, settings?: AppSettings) {
    setSyncing(true)
    try {
        let batch = writeBatch(firestore)
        let opsCount = 0
        const localMarkSynced: (() => Promise<any>)[] = []

        const commit = async () => {
            if (opsCount > 0) {
                await batch.commit()
                for (const fn of localMarkSynced) await fn()
                batch = writeBatch(firestore)
                opsCount = 0
                localMarkSynced.length = 0
            }
        }

        const addOp = async (ref: any, data: object | null, markFn: () => Promise<any>, isDelete = false) => {
            if (isDelete) {
                batch.delete(ref)
            } else {
                batch.set(ref, clean(data!), { merge: true })
            }
            localMarkSynced.push(markFn)
            opsCount++
            if (opsCount >= MAX_BATCH_OPS) await commit()
        }

        const user = await db.users.get(userId)
        if (user && user.sync !== 'synced') {
            const { passwordHash, sync, ...safeUser } = user
            await addOp(doc(firestore, `users/${firebaseUid}`), safeUser, () => db.users.update(userId, { sync: 'synced' }))
        }

        if (settings && settings.sync !== 'synced') {
            const { openrouterApiKey, sync, ...safeSettings } = settings
            const settingsData = settings.syncApiKey ? safeSettings : { ...safeSettings, openrouterApiKey: '' }
            await addOp(doc(firestore, `users/${firebaseUid}/settings/app`), settingsData, () => db.settings.update(settings.id, { sync: 'synced' }))
        }

        for (const table of TABLES_TO_SYNC) {
            const allRecords = await (db as any)[table].where('userId').equals(userId).toArray()
            const pendingRecords = allRecords.filter((r: any) => r.sync !== 'synced')

            for (const record of pendingRecords) {
                const { sync, ...safeRecord } = record
                if (table === 'quizAttempts' && Array.isArray(safeRecord.answers)) {
                    safeRecord.answers = JSON.stringify(safeRecord.answers)
                }
                await addOp(
                    doc(firestore, `users/${firebaseUid}/${table}/${record.id}`),
                    safeRecord,
                    () => (db as any)[table].update(record.id, { sync: 'synced' })
                )
            }
        }

        const deletions = await db.deletedSyncs.toArray()
        for (const del of deletions) {
            if (del.collection === 'users' || del.collection === 'settings' || del.collection === 'audio' || del.collection === 'deletedSyncs') {
                await db.deletedSyncs.delete(del.id)
                continue
            }
            const docRef = doc(firestore, `users/${firebaseUid}/${del.collection}/${del.id}`)
            await addOp(docRef, null, () => db.deletedSyncs.delete(del.id), true)
        }

        await commit()
    } finally {
        setSyncing(false)
    }
}

export async function pullRemote(userId: string, firebaseUid: string, lastSyncedAt: number) {
    setSyncing(true)
    try {
        const userDoc = await getDoc(doc(firestore, `users/${firebaseUid}`))
        if (userDoc.exists()) {
            const data = userDoc.data()
            if (data.updatedAt && data.updatedAt > lastSyncedAt) {
                await db.users.update(userId, { ...data, sync: 'synced' })
            }
        }

        const settingsDoc = await getDoc(doc(firestore, `users/${firebaseUid}/settings/app`))
        if (settingsDoc.exists()) {
            const data = settingsDoc.data()
            if (data.updatedAt && data.updatedAt > lastSyncedAt) {
                const localSettings = await db.settings.get('app')
                const localKey = localSettings?.openrouterApiKey || ''
                const updated = {
                    ...data,
                    sync: 'synced',
                    openrouterApiKey: data.syncApiKey ? (data.openrouterApiKey ?? localKey) : localKey,
                }
                await db.settings.put({ ...updated, id: 'app', userId } as AppSettings)
            }
        }

        for (const table of TABLES_TO_SYNC) {
            const snap = await getDocs(collection(firestore, `users/${firebaseUid}/${table}`))
            for (const docSnap of snap.docs) {
                const data = docSnap.data()
                const ts = data.updatedAt || data.createdAt || 0
                if (ts > lastSyncedAt) {
                    if (table === 'quizAttempts' && typeof data.answers === 'string') {
                        try { data.answers = JSON.parse(data.answers) } catch (e) { }
                    }
                    await (db as any)[table].put({ ...data, id: docSnap.id, sync: 'synced' })
                }
            }
        }
    } finally {
        setSyncing(false)
    }
}

export async function runSync(userId: string, firebaseUid: string) {
    // Find settings by userId field (could be stored with id='app' or id=userId)
    const settings = await db.settings.where('userId').equals(userId).first()
        ?? await db.settings.get('app')
    const lastSyncedAt = settings?.lastSyncedAt || 0

    await pushPending(userId, firebaseUid, settings)
    await pullRemote(userId, firebaseUid, lastSyncedAt)

    if (settings) {
        setSyncing(true)
        await db.settings.update(settings.id, { lastSyncedAt: Date.now(), sync: 'synced' })
        setSyncing(false)
    }
}
