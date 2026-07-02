import Dexie, { type EntityTable } from 'dexie'

export type ProfileType = 'student' | 'personal' | 'business'
export type SyncState = 'synced' | 'pending'
export type GoalKind = 'spending' | 'saving'
export type ReviewResult = 'again' | 'hard' | 'good' | 'easy'
export type QuizMode = 'practice' | 'timed' | 'exam'
export type CategoryKind = 'task' | 'income' | 'expense' | 'event'
export type EventType = 'school' | 'personal'

export interface DeletedSync {
    id: string
    collection: string
    deletedAt: number
}

export interface User {
    id: string
    firstName: string
    lastName: string
    email: string
    passwordHash: string
    firebaseUid?: string
    country: string
    slug?: string
    description?: string
    createdAt: number
    sync?: SyncState
}

/** Public visibility of a shareable resource. Undefined is treated as 'private'. */
export type Visibility = 'public' | 'private'

/** Marker left on a resource that was imported from the community library. */
export interface ImportedFrom {
    authorSlug: string
    authorName: string
}

export interface AppSettings {
    id: string
    userId: string
    workspaceName: string
    avatarIcon: string
    accent: string
    theme: 'light' | 'dark' | 'system'
    profiles: ProfileType[]
    onboarded: boolean
    openrouterApiKey: string
    openrouterModel: string
    locale: string
    currency: string
    updatedAt: number
    lastSyncedAt?: number
    syncApiKey?: boolean
    sync?: SyncState
}

export interface Note {
    id: string
    userId: string
    title: string
    content: string
    subjectId?: string
    pinned: boolean
    visibility?: Visibility
    importedFrom?: ImportedFrom
    createdAt: number
    updatedAt: number
    sync?: SyncState
    aiGenerated?: boolean
}

export interface Deck {
    id: string
    userId: string
    name: string
    description?: string
    subjectId?: string
    visibility?: Visibility
    importedFrom?: ImportedFrom
    createdAt: number
    updatedAt: number
    sync?: SyncState
    aiGenerated?: boolean
}

export interface Card {
    id: string
    userId: string
    deckId: string
    front: string
    back: string
    dueDate: number
    interval: number
    repetitions: number
    easeFactor: number
    lastReviewedAt?: number
    lastResult?: ReviewResult
    createdAt: number
    updatedAt: number
    sync?: SyncState
    aiGenerated?: boolean
}

export interface ReviewLog {
    id: string
    userId: string
    cardId: string
    deckId: string
    result: ReviewResult
    reviewedAt: number
    sync?: SyncState
}

export interface Task {
    id: string
    userId: string
    title: string
    notes?: string
    status: 'todo' | 'doing' | 'done'
    category?: string
    dueDate?: number
    completedAt?: number
    tagIds: string[]
    createdAt: number
    updatedAt?: number
    sync?: SyncState
    aiGenerated?: boolean
}

export interface Tag {
    id: string
    userId: string
    name: string
    color: string
    createdAt: number
    sync?: SyncState
}

export interface Subject {
    id: string
    userId: string
    name: string
    color: string
    createdAt: number
    sync?: SyncState
}

export interface QuizQuestion {
    question: string
    options: string[]
    correct: number[]
    explanation?: string
}

export interface Quiz {
    id: string
    userId: string
    title: string
    subjectId?: string
    questions: QuizQuestion[]
    timeLimit?: number
    visibility?: Visibility
    importedFrom?: ImportedFrom
    createdAt: number
    updatedAt: number
    sync?: SyncState
    aiGenerated?: boolean
}

export interface QuizAttempt {
    id: string
    quizId: string
    userId: string
    mode: QuizMode
    score: number
    total: number
    answers: number[][] | string
    completedAt: number
    sync?: SyncState
}

export interface RoutineEvent {
    id: string
    userId: string
    day: number
    startMin: number
    endMin: number
    type: EventType
    title?: string
    subjectId?: string
    notes?: string
    sync?: SyncState
    aiGenerated?: boolean
}

export interface CalendarEvent {
    id: string
    userId: string
    title: string
    start: number
    end?: number
    allDay: boolean
    color?: string
    notes?: string
    sync?: SyncState
    aiGenerated?: boolean
}

export interface AiAction {
    type: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ'
    collection: string
    data?: any
    docId?: string
    filters?: any[]
    limit?: number
}

export interface AiMessage {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    actionsProposed?: AiAction[]
    actionsApproved?: boolean
    actionsExecuted?: number
}

export interface AiConversation {
    id: string
    userId: string
    title: string
    messages: AiMessage[]
    createdAt: number
    updatedAt: number
    sync?: SyncState
}

export interface Transaction {
    id: string
    userId: string
    type: 'income' | 'expense'
    amount: number
    label: string
    category: string
    goalId?: string
    date: number
    createdAt: number
    sync?: SyncState
}

export interface Goal {
    id: string
    userId: string
    title: string
    kind: GoalKind
    target: number
    current: number
    period: 'week' | 'month' | 'year'
    createdAt: number
    sync?: SyncState
}

export interface Category {
    id: string
    userId: string
    name: string
    color: string
    kind: CategoryKind
    createdAt: number
    sync?: SyncState
}

export interface AudioRecording {
    id: string
    userId: string
    noteId?: string
    blob: Blob
    duration: number
    createdAt: number
    transcription?: string
    sync?: SyncState
}

/* ------------------------------------------------------------------ */
/* Study groups (local simulation)                                     */
/* ------------------------------------------------------------------ */

export interface Group {
    id: string
    /** local owner (the current user) */
    userId: string
    name: string
    description: string
    /** lucide icon name, editable in the group settings */
    icon: string
    /** short code used for the invite link, e.g. "4XJ82A" */
    joinCode: string
    /** "Par lien" (true) vs "Privé" (false) */
    linkEnabled: boolean
    createdAt: number
    updatedAt: number
}

export type GroupRole = 'admin' | 'member'

export interface GroupMember {
    id: string
    groupId: string
    /** '@me' for the current user, otherwise a simulated author slug */
    slug: string
    name: string
    avatarIcon: string
    accent: string
    role: GroupRole
    isSelf: boolean
    joinedAt: number
}

/** Snapshot of a shared resource, embedded in a message so it survives even if
 *  the original resource is private or deleted. */
export interface GroupAttachment {
    kind: 'note' | 'deck' | 'quiz'
    title: string
    subject: string
    note?: { html: string }
    deck?: { description: string; cards: { front: string; back: string }[] }
    quiz?: { questions: { question: string; options: string[]; correct: number[] }[] }
}

export interface GroupMessage {
    id: string
    groupId: string
    /** '@me' or a simulated author slug */
    authorSlug: string
    text: string
    attachment?: GroupAttachment
    createdAt: number
}

export type InviteDirection = 'incoming' | 'outgoing'
export type InviteStatus = 'pending' | 'accepted' | 'declined'

export interface GroupInvite {
    id: string
    userId: string
    direction: InviteDirection
    /** set for outgoing invites (an existing local group) */
    groupId?: string
    fromSlug: string
    fromName: string
    /** for incoming simulated invites: snapshot of the group to join */
    groupName: string
    groupDescription: string
    memberCount: number
    status: InviteStatus
    createdAt: number
}

class DeskiaDB extends Dexie {
    users!: EntityTable<User, 'id'>
    settings!: EntityTable<AppSettings, 'id'>
    notes!: EntityTable<Note, 'id'>
    decks!: EntityTable<Deck, 'id'>
    cards!: EntityTable<Card, 'id'>
    reviews!: EntityTable<ReviewLog, 'id'>
    tasks!: EntityTable<Task, 'id'>
    tags!: EntityTable<Tag, 'id'>
    subjects!: EntityTable<Subject, 'id'>
    categories!: EntityTable<Category, 'id'>
    audio!: EntityTable<AudioRecording, 'id'>
    quizzes!: EntityTable<Quiz, 'id'>
    quizAttempts!: EntityTable<QuizAttempt, 'id'>
    conversations!: EntityTable<AiConversation, 'id'>
    transactions!: EntityTable<Transaction, 'id'>
    goals!: EntityTable<Goal, 'id'>
    routines!: EntityTable<RoutineEvent, 'id'>
    events!: EntityTable<CalendarEvent, 'id'>
    deletedSyncs!: EntityTable<DeletedSync, 'id'>
    groups!: EntityTable<Group, 'id'>
    groupMembers!: EntityTable<GroupMember, 'id'>
    groupMessages!: EntityTable<GroupMessage, 'id'>
    groupInvites!: EntityTable<GroupInvite, 'id'>

    constructor() {
        super('deskia')
        this.version(1).stores({
            users: 'id, email, firebaseUid',
            settings: 'id, userId',
            notes: 'id, userId, updatedAt, subjectId, pinned',
            decks: 'id, userId, subjectId',
            cards: 'id, userId, deckId, dueDate',
            reviews: 'id, cardId, deckId, reviewedAt',
            tasks: 'id, userId, dueDate, status',
            tags: 'id, userId',
            subjects: 'id, userId',
            categories: 'id, userId, kind',
            audio: 'id, userId, noteId',
            events: 'id, userId, start',
        })
        this.version(2).stores({
            quizzes: 'id, userId, updatedAt, subjectId',
            quizAttempts: 'id, quizId, userId, completedAt',
        })
        this.version(3).stores({
            conversations: 'id, userId, updatedAt',
        })
        this.version(4).stores({
            routines: 'id, userId, day',
        })
        this.version(5).stores({
            users: 'id, email, firebaseUid, slug',
            notes: 'id, userId, updatedAt, subjectId, pinned, visibility',
            decks: 'id, userId, updatedAt, visibility',
            quizzes: 'id, userId, updatedAt, subjectId, visibility',
            transactions: 'id, userId, date, category',
            goals: 'id, userId',
        })
        this.version(6).stores({
            deletedSyncs: 'id, collection',
            groups: 'id, userId, joinCode',
            groupMembers: 'id, groupId, slug',
            groupMessages: 'id, groupId, createdAt',
            groupInvites: 'id, userId, status',
        })
        this.version(7).stores({
            // Add userId index to reviews (was missing from v1)
            reviews: 'id, userId, cardId, deckId, reviewedAt',
        })

        // Auto-mark entities as 'pending' for Firebase sync
        this.tables.forEach((table) => {
            if (table.name === 'audio') return

            table.hook('creating', (primKey, obj: any) => {
                if (obj && obj.sync === undefined) {
                    obj.sync = 'pending'
                }
            })

            table.hook('updating', (mods: any) => {
                if (!isSyncing && mods && !('sync' in mods)) {
                    return { sync: 'pending' }
                }
            })

            table.hook('deleting', (primKey, _obj: any) => {
                // Skip tables that should not be tracked for sync
                if (table.name === 'deletedSyncs' || table.name === 'audio') return
                if (!isSyncing && primKey) {
                    // Cannot write to deletedSyncs from within the current transaction
                    // (scope only includes the table being deleted from).
                    // Schedule as a microtask so it runs after the transaction commits.
                    Promise.resolve().then(() => {
                        db.deletedSyncs.put({
                            id: primKey as string,
                            collection: table.name,
                            deletedAt: Date.now(),
                        }).catch(() => {/* ignore */ })
                    })
                }
            })
        })
    }
}

export const db = new DeskiaDB()

export let isSyncing = false
export const setSyncing = (v: boolean) => { isSyncing = v }

export const uid = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
