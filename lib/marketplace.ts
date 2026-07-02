import { db, uid, type ImportedFrom } from './db'
import { newCardScheduling } from './sm2'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ResourceKind = 'note' | 'deck' | 'quiz'

export interface MarketAuthor {
    slug: string
    firstName: string
    lastName: string
    country: string // country code
    avatarIcon: string
    accent: string // accent key
    bio: string
}

interface BaseResource {
    id: string
    authorSlug: string
    subject: string
    downloads: number
    createdAt: number
}

export interface MarketNote extends BaseResource {
    kind: 'note'
    title: string
    html: string
}

export interface MarketDeck extends BaseResource {
    kind: 'deck'
    title: string
    description: string
    cards: { front: string; back: string }[]
}

export interface MarketQuiz extends BaseResource {
    kind: 'quiz'
    title: string
    questions: { question: string; options: string[]; correct: number[] }[]
}

export type MarketResource = MarketNote | MarketDeck | MarketQuiz

/**
 * Normalized shape used by every card / modal in the community UI so that both
 * simulated resources and the current user's own public resources render the
 * same way.
 */
export interface FeedResource {
    id: string
    kind: ResourceKind
    title: string
    subject: string
    downloads: number
    authorSlug: string
    authorName: string
    own: boolean
    note?: { html: string }
    deck?: { description: string; cards: { front: string; back: string }[] }
    quiz?: { questions: { question: string; options: string[] }[] }
}

/* ------------------------------------------------------------------ */
/* Reserved handles                                                    */
/* ------------------------------------------------------------------ */

export const RESERVED_SLUGS = [
    'admin',
    'api',
    'app',
    'u',
    'login',
    'signup',
    'settings',
    'community',
    'communaute',
    'group',
    'groups',
    'groupes',
    'about',
    'help',
    'support',
]

/* ------------------------------------------------------------------ */
/* Simulated authors                                                   */
/* ------------------------------------------------------------------ */

export const MARKET_AUTHORS: MarketAuthor[] = []

export const MARKET_AUTHOR_SLUGS = MARKET_AUTHORS.map((a) => a.slug)

export function getMarketAuthor(slug: string): MarketAuthor | undefined {
    return MARKET_AUTHORS.find((a) => a.slug === slug)
}

export function authorName(a: Pick<MarketAuthor, 'firstName' | 'lastName'>): string {
    return `${a.firstName} ${a.lastName}`
}

/* ------------------------------------------------------------------ */
/* Simulated resources                                                 */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000
const daysAgo = (n: number) => Date.now() - n * DAY

export const MARKET_RESOURCES: MarketResource[] = []

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

export const KIND_LABEL: Record<ResourceKind, string> = {
    note: 'Note de fiche',
    deck: 'Flashcards',
    quiz: 'Quiz',
}

export function formatDownloads(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`
    return String(n)
}

export function getMarketResourceById(id: string): MarketResource | undefined {
    return MARKET_RESOURCES.find((r) => r.id === id)
}

/**
 * Build normalized feed items from the current user's own PUBLIC resources.
 * Used both in the community library (merged with simulated content) and on
 * the user's own public profile page.
 */
export async function getOwnPublicFeed(userId: string): Promise<FeedResource[]> {
    const user = await db.users.get(userId)
    if (!user) return []
    const name = `${user.firstName} ${user.lastName}`.trim()
    const slug = user.slug ?? ''

    const [notes, decks, quizzes, subjects] = await Promise.all([
        db.notes.where('userId').equals(userId).toArray(),
        db.decks.where('userId').equals(userId).toArray(),
        db.quizzes.where('userId').equals(userId).toArray(),
        db.subjects.where('userId').equals(userId).toArray(),
    ])
    const subjectName = (id?: string) =>
        subjects.find((s) => s.id === id)?.name ?? 'Général'

    const cardsByDeck = new Map<string, { front: string; back: string }[]>()
    const publicDecks = decks.filter((d) => d.visibility === 'public')
    if (publicDecks.length > 0) {
        const allCards = await db.cards.where('userId').equals(userId).toArray()
        for (const c of allCards) {
            if (!cardsByDeck.has(c.deckId)) cardsByDeck.set(c.deckId, [])
            cardsByDeck.get(c.deckId)!.push({ front: c.front, back: c.back })
        }
    }

    const feed: FeedResource[] = []

    for (const n of notes.filter((x) => x.visibility === 'public')) {
        feed.push({
            id: n.id,
            kind: 'note',
            title: n.title || 'Sans titre',
            subject: subjectName(n.subjectId),
            downloads: 0,
            authorSlug: slug,
            authorName: name,
            own: true,
            note: { html: n.content },
        })
    }
    for (const d of publicDecks) {
        feed.push({
            id: d.id,
            kind: 'deck',
            title: d.name,
            subject: subjectName(d.subjectId),
            downloads: 0,
            authorSlug: slug,
            authorName: name,
            own: true,
            deck: { description: d.description, cards: cardsByDeck.get(d.id) ?? [] },
        })
    }
    for (const q of quizzes.filter((x) => x.visibility === 'public')) {
        feed.push({
            id: q.id,
            kind: 'quiz',
            title: q.title,
            subject: subjectName(q.subjectId),
            downloads: 0,
            authorSlug: slug,
            authorName: name,
            own: true,
            quiz: { questions: q.questions.map((qq) => ({ question: qq.question, options: qq.options })) },
        })
    }

    return feed
}

/** Convert a simulated resource to the normalized feed shape. */
export function marketToFeed(r: MarketResource): FeedResource {
    const author = getMarketAuthor(r.authorSlug)
    const base = {
        id: r.id,
        kind: r.kind,
        title: r.title,
        subject: r.subject,
        downloads: r.downloads,
        authorSlug: r.authorSlug,
        authorName: author ? authorName(author) : r.authorSlug,
        own: false,
    }
    if (r.kind === 'note') return { ...base, note: { html: r.html } }
    if (r.kind === 'deck')
        return { ...base, deck: { description: r.description, cards: r.cards } }
    return { ...base, quiz: { questions: r.questions.map((q) => ({ question: q.question, options: q.options })) } }
}

/* ------------------------------------------------------------------ */
/* Import into the current user's collections                          */
/* ------------------------------------------------------------------ */

async function ensureSubject(userId: string, name: string): Promise<string | undefined> {
    if (!name) return undefined
    const existing = await db.subjects
        .where('userId')
        .equals(userId)
        .filter((s) => s.name.toLowerCase() === name.toLowerCase())
        .first()
    if (existing) return existing.id
    const id = uid()
    await db.subjects.add({
        id,
        userId,
        name,
        color: 'oklch(0.6 0.13 250)',
        createdAt: Date.now(),
    })
    return id
}

/**
 * Import a simulated community resource into the user's own space, tagging it
 * with an `importedFrom` marker so the UI can show its origin.
 */
export async function importMarketResource(userId: string, r: MarketResource) {
    const now = Date.now()
    const author = getMarketAuthor(r.authorSlug)
    const importedFrom: ImportedFrom = {
        authorSlug: r.authorSlug,
        authorName: author ? authorName(author) : r.authorSlug,
    }
    const subjectId = await ensureSubject(userId, r.subject)

    if (r.kind === 'note') {
        await db.notes.add({
            id: uid(),
            userId,
            title: r.title,
            content: r.html,
            subjectId,
            pinned: false,
            visibility: 'private',
            importedFrom,
            createdAt: now,
            updatedAt: now,
            sync: 'pending',
        })
        return
    }

    if (r.kind === 'deck') {
        const deckId = uid()
        await db.decks.add({
            id: deckId,
            userId,
            name: r.title,
            description: r.description,
            subjectId,
            visibility: 'private',
            importedFrom,
            createdAt: now,
            updatedAt: now,
            sync: 'pending',
        })
        await db.cards.bulkAdd(
            r.cards.map((c) => ({
                id: uid(),
                deckId,
                userId,
                front: c.front,
                back: c.back,
                ...newCardScheduling(now),
                createdAt: now,
                updatedAt: now,
                sync: 'pending' as const,
            })),
        )
        return
    }

    // quiz
    const subjectForQuiz = subjectId
    await db.quizzes.add({
        id: uid(),
        userId,
        title: r.title,
        subjectId: subjectForQuiz,
        questions: r.questions.map((q) => ({
            id: uid(),
            question: q.question,
            options: q.options,
            correct: q.correct,
        })),
        visibility: 'private',
        importedFrom,
        createdAt: now,
        updatedAt: now,
        sync: 'pending',
    })
}