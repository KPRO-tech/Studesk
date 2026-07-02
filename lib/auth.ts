import { db, uid, type User } from './db'
import { firebaseAuth } from './firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword as firebaseUpdatePassword,
  verifyBeforeUpdateEmail as firebaseVerifyBeforeUpdateEmail
} from 'firebase/auth'

import { defaultSlug, isSlugAvailable } from './slug'

const SESSION_KEY = 'studesk.session'

/** Generate a unique public handle derived from the user's name. */
async function generateUniqueSlug(firstName: string, lastName: string): Promise<string> {
  const base = defaultSlug(firstName, lastName)
  let candidate = base
  let i = 1
  // Guard against reserved words, simulated authors, and existing accounts.
  while (!(await isSlugAvailable(candidate))) {
    candidate = `${base}-${i++}`
  }
  return candidate
}

/**
 * Lightweight local auth for Phase 1 (offline-first).
 * Passwords are hashed with SubtleCrypto and stored only in IndexedDB.
 * Phase 2 will layer Firebase Auth on top of this.
 */

async function hash(password: string): Promise<string> {
  const data = new TextEncoder().encode(`studesk:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function getSessionUserId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(SESSION_KEY)
}

export function setSession(userId: string) {
  localStorage.setItem(SESSION_KEY, userId)
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export interface SignUpInput {
  firstName: string
  lastName: string
  email: string
  password: string
  country: string
}

export async function signUp(input: SignUpInput): Promise<User> {
  const email = input.email.trim().toLowerCase()
  const existing = await db.users.where('email').equals(email).first()
  if (existing) throw new Error('Un compte existe déjà avec cet email.')

  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()

  const user: User = {
    id: uid(),
    firstName,
    lastName,
    email,
    passwordHash: await hash(input.password),
    country: input.country,
    slug: await generateUniqueSlug(firstName, lastName),
    createdAt: Date.now(),
    sync: 'pending',
  }

  // Attempt Firebase creation if online
  if (typeof window !== 'undefined' && navigator.onLine && firebaseAuth) {
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email, input.password)
      user.firebaseUid = cred.user.uid
    } catch (e) {
      console.error('Firebase signUp failed, proceeding offline:', e)
    }
  }

  await db.users.add(user)
  setSession(user.id)
  return user
}

export async function signIn(email: string, password: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase()
  let user = await db.users.where('email').equals(normalizedEmail).first()
  let fbUid: string | null = null

  // Attempt Firebase signIn if online
  if (typeof window !== 'undefined' && navigator.onLine && firebaseAuth) {
    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth, normalizedEmail, password)
      fbUid = cred.user.uid
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        // If Firebase says not found, but we have it locally, auto-create it on Firebase
        if (user) {
          const ph = await hash(password)
          if (ph === user.passwordHash) {
            try {
              const cred = await createUserWithEmailAndPassword(firebaseAuth, normalizedEmail, password)
              fbUid = cred.user.uid
            } catch (createErr) {
              console.error('Firebase auto-create failed:', createErr)
            }
          } else {
            throw new Error('Mot de passe incorrect.')
          }
        } else {
          throw new Error('Aucun compte trouvé avec cet email.')
        }
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        throw new Error('Email ou mot de passe incorrect.')
      } else {
        console.error('Firebase signIn failed, proceeding offline:', e)
        if (!user) throw new Error("Connexion impossible (vérifiez votre réseau).")
      }
    }
  }

  if (!user) {
    if (!fbUid) throw new Error('Aucun compte local trouvé et connexion Firebase impossible.')

    // We are on a new device, we need to create the local user!
    let id = uid()
    let firstName = 'Utilisateur'
    let lastName = ''
    let country = 'FR'
    let createdAt = Date.now()

    try {
      const { getFirestore, doc, getDoc } = await import('firebase/firestore')
      const { getApp } = await import('firebase/app')
      const firestore = getFirestore(getApp())
      const userDoc = await getDoc(doc(firestore, `users/${fbUid}`))
      if (userDoc.exists()) {
        const data = userDoc.data()
        if (data.id) id = data.id
        if (data.firstName) firstName = data.firstName
        if (data.lastName) lastName = data.lastName
        if (data.country) country = data.country
        if (data.createdAt) createdAt = data.createdAt
      }
    } catch (e) {
      console.error("Failed to fetch user profile from Firestore", e)
    }

    user = {
      id,
      firstName,
      lastName,
      email: normalizedEmail,
      passwordHash: await hash(password),
      firebaseUid: fbUid,
      country,
      createdAt,
      sync: 'synced',
    }
    await db.users.add(user)
  } else {
    // Local user exists
    const ph = await hash(password)
    // Only verify local password if we didn't just authenticate successfully with Firebase
    if (!fbUid && ph !== user.passwordHash) throw new Error('Mot de passe incorrect.')

    // If Firebase succeeded and local hash differs, update it (e.g. after password reset)
    if (fbUid && ph !== user.passwordHash) {
      await db.users.update(user.id, { passwordHash: ph })
    }

    if (fbUid && user.firebaseUid !== fbUid) {
      user.firebaseUid = fbUid
      await db.users.update(user.id, { firebaseUid: fbUid })
    }
  }

  setSession(user.id)
  return user
}

export async function updatePassword(userId: string, current: string, next: string) {
  const user = await db.users.get(userId)
  if (!user) throw new Error('Utilisateur introuvable.')
  if ((await hash(current)) !== user.passwordHash) throw new Error('Mot de passe actuel incorrect.')

  if (typeof window !== 'undefined' && navigator.onLine && firebaseAuth && firebaseAuth.currentUser) {
    try {
      await firebaseUpdatePassword(firebaseAuth.currentUser, next)
    } catch (e: any) {
      if (e.code === 'auth/requires-recent-login') {
        throw new Error("Veuillez vous déconnecter et vous reconnecter avant de changer le mot de passe.")
      }
      throw e
    }
  }

  await db.users.update(userId, { passwordHash: await hash(next) })
}

export async function updateUserEmail(newEmail: string) {
  if (typeof window !== 'undefined' && navigator.onLine && firebaseAuth && firebaseAuth.currentUser) {
    try {
      await firebaseVerifyBeforeUpdateEmail(firebaseAuth.currentUser, newEmail)
    } catch (e: any) {
      if (e.code === 'auth/requires-recent-login') {
        throw new Error("Veuillez vous déconnecter et vous reconnecter avant de changer l'email.")
      }
      throw e
    }
  }
}

export async function sendResetEmail(email: string) {
  if (!firebaseAuth) throw new Error('Firebase non initialisé.')
  await sendPasswordResetEmail(firebaseAuth, email)
}
