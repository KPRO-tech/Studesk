import {
    db,
    uid,
    type Group,
    type GroupAttachment,
    type GroupInvite,
    type GroupMember,
    type ImportedFrom,
} from './db'
import { newCardScheduling } from './sm2'
import {
    MARKET_AUTHORS,
    MARKET_AUTHOR_SLUGS,
    MARKET_RESOURCES,
    getMarketAuthor,
    getMarketResourceById,
    authorName,
    type FeedResource,
    type MarketResource,
} from './marketplace'
import { DEFAULT_AVATAR_ICON } from './avatar-icons'
import { DEFAULT_ACCENT } from './accents'
import { firestore } from './firebase'
import { collection, addDoc, query, where, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore'

export const SELF_SLUG = '@me'

const DAY = 86_400_000

/* ------------------------------------------------------------------ */
/* Join codes & links                                                  */
/* ------------------------------------------------------------------ */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function genJoinCode(len = 6): string {
    let out = ''
    for (let i = 0; i < len; i++) {
        out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    }
    return out
}

export function getInviteUrl(group: Pick<Group, 'joinCode'>): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/group/${group.joinCode}`
}

/* ------------------------------------------------------------------ */
/* Self identity helpers                                               */
/* ------------------------------------------------------------------ */

async function resolveSelf(userId: string): Promise<{
    name: string
    avatarIcon: string
    accent: string
}> {
    const [user, settings] = await Promise.all([
        db.users.get(userId),
        db.settings.get(userId),
    ])
    const name = user ? `${user.firstName} ${user.lastName}`.trim() : 'Moi'
    return {
        name: name || 'Moi',
        avatarIcon: settings?.avatarIcon ?? DEFAULT_AVATAR_ICON,
        accent: settings?.accent ?? DEFAULT_ACCENT,
    }
}

/** Refresh the current user's member row so their name/avatar stay in sync. */
export async function syncSelfMember(groupId: string, userId: string) {
    const self = await resolveSelf(userId)
    const row = await db.groupMembers
        .where('groupId')
        .equals(groupId)
        .filter((m) => m.isSelf)
        .first()
    if (row) {
        await db.groupMembers.update(row.id, {
            name: self.name,
            avatarIcon: self.avatarIcon,
            accent: self.accent,
        })
    }
}

/* ------------------------------------------------------------------ */
/* Group creation                                                      */
/* ------------------------------------------------------------------ */

export async function createGroup(
    userId: string,
    input: { name: string; description?: string; linkEnabled?: boolean; icon?: string },
): Promise<Group> {
    const now = Date.now()
    const self = await resolveSelf(userId)
    const group: Group = {
        id: uid(),
        userId,
        name: input.name.trim(),
        description: input.description?.trim() ?? '',
        icon: input.icon ?? 'Users',
        joinCode: genJoinCode(),
        linkEnabled: input.linkEnabled ?? false,
        createdAt: now,
        updatedAt: now,
    }
    await db.groups.add(group)
    await db.groupMembers.add({
        id: uid(),
        groupId: group.id,
        slug: SELF_SLUG,
        name: self.name,
        avatarIcon: self.avatarIcon,
        accent: self.accent,
        role: 'admin',
        isSelf: true,
        joinedAt: now,
    })
    return group
}

export async function updateGroup(
    groupId: string,
    patch: Partial<Pick<Group, 'name' | 'description' | 'icon' | 'linkEnabled' | 'joinCode'>>,
) {
    await db.groups.update(groupId, { ...patch, updatedAt: Date.now() })
}

export async function regenerateJoinCode(groupId: string): Promise<string> {
    const code = genJoinCode()
    await db.groups.update(groupId, { joinCode: code, updatedAt: Date.now() })
    return code
}

export async function deleteGroup(groupId: string) {
    await db.transaction('rw', db.groups, db.groupMembers, db.groupMessages, db.groupInvites, async () => {
        await db.groups.delete(groupId)
        await db.groupMembers.where('groupId').equals(groupId).delete()
        await db.groupMessages.where('groupId').equals(groupId).delete()
        const invites = await db.groupInvites.where('status').anyOf('pending', 'accepted', 'declined').toArray()
        await db.groupInvites.bulkDelete(invites.filter((i) => i.groupId === groupId).map((i) => i.id))
    })
}

export async function leaveGroup(groupId: string) {
    const self = await db.groupMembers
        .where('groupId')
        .equals(groupId)
        .filter((m) => m.isSelf)
        .first()
    if (self) await db.groupMembers.delete(self.id)
}

/* ------------------------------------------------------------------ */
/* Membership management                                               */
/* ------------------------------------------------------------------ */

export async function setMemberRole(memberId: string, role: GroupMember['role']) {
    await db.groupMembers.update(memberId, { role })
}

export async function removeMember(memberId: string) {
    await db.groupMembers.delete(memberId)
}

/* ------------------------------------------------------------------ */
/* Invitations                                                         */
/* ------------------------------------------------------------------ */

/**
 * Invite one or more users to an existing group by their @slug. Only simulated
 * community authors are recognised. Recognised slugs create an outgoing pending
 * invite that auto-accepts after a short delay (so the flow is testable).
 * Returns the list of slugs that could not be found.
 */
export async function inviteBySlug(
    groupId: string,
    userId: string,
    rawSlugs: string[],
): Promise<{ invited: string[]; notFound: string[]; already: string[] }> {
    const invited: string[] = []
    const notFound: string[] = []
    const already: string[] = []
    
    if (!firestore) return { invited, notFound: rawSlugs, already }

    const members = await db.groupMembers.where('groupId').equals(groupId).toArray()
    const memberSlugs = new Set(members.map((m) => m.slug))
    const group = await db.groups.get(groupId)
    if (!group) return { invited, notFound: rawSlugs, already }
    
    const sender = await db.users.get(userId)
    const selfUser = await resolveSelf(userId)
    const senderSlug = sender?.slug || SELF_SLUG

    for (const raw of rawSlugs) {
        const slug = raw.replace(/^@/, '').trim().toLowerCase()
        if (!slug) continue
        
        if (memberSlugs.has(slug)) {
            already.push(slug)
            continue
        }
        
        const q = query(collection(firestore, 'users'), where('slug', '==', slug))
        const snapshot = await getDocs(q)
        if (snapshot.empty) {
            notFound.push(slug)
            continue
        }
        
        const targetUserDoc = snapshot.docs[0]
        const targetUserId = targetUserDoc.id
        
        const inviteQ = query(
            collection(firestore, 'groupInvites'),
            where('groupId', '==', groupId),
            where('targetUserId', '==', targetUserId),
            where('status', '==', 'pending')
        )
        const pendingSnap = await getDocs(inviteQ)
        if (!pendingSnap.empty) {
            already.push(slug)
            continue
        }

        await addDoc(collection(firestore, 'groupInvites'), {
            groupId,
            targetUserId,
            fromSlug: senderSlug,
            fromName: selfUser.name,
            groupName: group.name,
            groupDescription: group.description,
            memberCount: members.length,
            status: 'pending',
            createdAt: Date.now()
        })
        invited.push(slug)
    }

    return { invited, notFound, already }
}

export async function declineInvite(inviteId: string) {
    if (!firestore) return
    await updateDoc(doc(firestore, 'groupInvites', inviteId), { status: 'declined' })
}

export async function acceptIncomingInvite(invite: any, currentUserId: string): Promise<string> {
    const now = Date.now()
    const self = await resolveSelf(currentUserId)

    if (firestore && invite.id) {
        await updateDoc(doc(firestore, 'groupInvites', invite.id), { status: 'accepted' })
    }

    const groupId = invite.groupId || uid()

    const group: Group = {
        id: groupId,
        userId: currentUserId,
        name: invite.groupName || 'Groupe',
        description: invite.groupDescription || '',
        icon: 'Users',
        joinCode: genJoinCode(),
        linkEnabled: true,
        createdAt: now,
        updatedAt: now,
    }
    
    // Avoid duplicate
    const existing = await db.groups.get(groupId)
    if (!existing) {
        await db.groups.add(group)
    }

    // Add myself
    const me = await db.groupMembers.where('groupId').equals(groupId).filter(m => m.isSelf).first()
    if (!me) {
        await db.groupMembers.add({
            id: uid(),
            groupId,
            slug: SELF_SLUG,
            name: self.name,
            avatarIcon: self.avatarIcon,
            accent: self.accent,
            role: 'member',
            isSelf: true,
            joinedAt: now,
        })
    }

    return groupId
}

/* ------------------------------------------------------------------ */
/* Messages & sharing                                                  */
/* ------------------------------------------------------------------ */

export async function sendMessage(
    groupId: string,
    text: string,
    authorSlug: string,
    attachment?: GroupAttachment,
) {
    if (!firestore) return
    const trimmed = text.trim()
    if (!trimmed && !attachment) return
    
    await addDoc(collection(firestore, 'groupMessages'), {
        groupId,
        authorSlug,
        text: trimmed,
        attachment: attachment || null,
        createdAt: Date.now(),
    })
}

function marketToAttachment(r: MarketResource): GroupAttachment {
    if (r.kind === 'note') {
        return { kind: 'note', title: r.title, subject: r.subject, note: { html: r.html } }
    }
    if (r.kind === 'deck') {
        return {
            kind: 'deck',
            title: r.title,
            subject: r.subject,
            deck: { description: r.description, cards: r.cards },
        }
    }
    return { kind: 'quiz', title: r.title, subject: r.subject, quiz: { questions: r.questions } }
}

/** Build an attachment snapshot from one of the current user's own resources. */
export async function buildAttachment(
    userId: string,
    kind: 'note' | 'deck' | 'quiz',
    resourceId: string,
): Promise<GroupAttachment | null> {
    const [subjects] = await Promise.all([db.subjects.where('userId').equals(userId).toArray()])
    const subjectName = (id?: string) => subjects.find((s) => s.id === id)?.name ?? 'Général'

    if (kind === 'note') {
        const n = await db.notes.get(resourceId)
        if (!n) return null
        return {
            kind: 'note',
            title: n.title || 'Sans titre',
            subject: subjectName(n.subjectId),
            note: { html: n.content },
        }
    }
    if (kind === 'deck') {
        const d = await db.decks.get(resourceId)
        if (!d) return null
        const cards = await db.cards.where('deckId').equals(d.id).toArray()
        return {
            kind: 'deck',
            title: d.name,
            subject: subjectName(d.subjectId),
            deck: {
                description: d.description,
                cards: cards.map((c) => ({ front: c.front, back: c.back })),
            },
        }
    }
    const q = await db.quizzes.get(resourceId)
    if (!q) return null
    return {
        kind: 'quiz',
        title: q.title,
        subject: subjectName(q.subjectId),
        quiz: {
            questions: q.questions.map((qq) => ({
                question: qq.question,
                options: qq.options,
                correct: qq.correct,
            })),
        },
    }
}

/* ------------------------------------------------------------------ */
/* Importing a shared attachment into the user's own space             */
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

export async function importAttachment(
    userId: string,
    att: GroupAttachment,
    from: { name: string; slug: string },
) {
    const now = Date.now()
    const importedFrom: ImportedFrom = { authorSlug: from.slug, authorName: from.name }
    const subjectId = await ensureSubject(userId, att.subject)

    if (att.kind === 'note' && att.note) {
        await db.notes.add({
            id: uid(),
            userId,
            title: att.title,
            content: att.note.html,
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

    if (att.kind === 'deck' && att.deck) {
        const deckId = uid()
        await db.decks.add({
            id: deckId,
            userId,
            name: att.title,
            description: att.deck.description,
            subjectId,
            visibility: 'private',
            importedFrom,
            createdAt: now,
            updatedAt: now,
            sync: 'pending',
        })
        await db.cards.bulkAdd(
            att.deck.cards.map((c) => ({
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

    if (att.kind === 'quiz' && att.quiz) {
        await db.quizzes.add({
            id: uid(),
            userId,
            title: att.title,
            subjectId,
            questions: att.quiz.questions.map((q) => ({
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
}

/** Convert an attachment to the normalized feed shape used by the preview dialog. */
export function attachmentToFeed(
    att: GroupAttachment,
    id: string,
    author: { name: string; slug: string },
    own: boolean,
): FeedResource {
    const base = {
        id,
        kind: att.kind,
        title: att.title,
        subject: att.subject,
        downloads: 0,
        authorSlug: author.slug,
        authorName: author.name,
        own,
    }
    if (att.kind === 'note') return { ...base, note: att.note }
    if (att.kind === 'deck') return { ...base, deck: att.deck }
    return {
        ...base,
        quiz: att.quiz
            ? { questions: att.quiz.questions.map((q) => ({ question: q.question, options: q.options })) }
            : undefined,
    }
}

/* ------------------------------------------------------------------ */
/* Join by link                                                        */
/* ------------------------------------------------------------------ */

export async function findGroupByCode(code: string): Promise<Group | undefined> {
    return db.groups.where('joinCode').equals(code.toUpperCase()).first()
}

export async function joinByCode(userId: string, code: string): Promise<string | null> {
    const group = await findGroupByCode(code)
    if (!group) return null
    const existing = await db.groupMembers
        .where('groupId')
        .equals(group.id)
        .filter((m) => m.isSelf)
        .first()
    if (!existing) {
        const self = await resolveSelf(userId)
        await db.groupMembers.add({
            id: uid(),
            groupId: group.id,
            slug: SELF_SLUG,
            name: self.name,
            avatarIcon: self.avatarIcon,
            accent: self.accent,
            role: 'member',
            isSelf: true,
            joinedAt: Date.now(),
        })
    }
    return group.id
}



/* ------------------------------------------------------------------ */
/* Read helpers                                                        */
/* ------------------------------------------------------------------ */

export function displayName(member: Pick<GroupMember, 'name' | 'isSelf'>): string {
    return member.isSelf ? 'Vous' : member.name
}