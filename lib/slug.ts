import { db } from './db'
import { RESERVED_SLUGS, MARKET_AUTHOR_SLUGS } from './marketplace'

/** Normalize any text into a URL-safe public handle. */
export function slugify(input: string): string {
    return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip accents
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24)
}

/** Build a default handle from a first/last name, e.g. "Yvann Dubois" -> "yvann-dubois". */
export function defaultSlug(firstName: string, lastName: string): string {
    const base = slugify(`${firstName} ${lastName}`.trim()) || 'user'
    return base
}

export function isValidSlug(slug: string): boolean {
    return /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])?$/.test(slug)
}

/**
 * Check whether a slug can be claimed. Compares against reserved words, the
 * simulated community authors, and other local accounts.
 */
export async function isSlugAvailable(
    slug: string,
    currentUserId?: string,
): Promise<boolean> {
    const normalized = slug.toLowerCase()
    if (RESERVED_SLUGS.includes(normalized)) return false
    if (MARKET_AUTHOR_SLUGS.includes(normalized)) return false
    const existing = await db.users.where('slug').equals(normalized).first()
    if (existing && existing.id !== currentUserId) return false
    return true
}