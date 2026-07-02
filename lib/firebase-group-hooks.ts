import { useEffect, useState } from 'react'
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    deleteDoc,
    getDocs
} from 'firebase/firestore'
import { firestore } from './firebase'
import type { GroupMessage, GroupInvite, GroupAttachment } from './db'

export function useGroupMessages(groupId: string): GroupMessage[] | undefined {
    const [messages, setMessages] = useState<GroupMessage[] | undefined>(undefined)

    useEffect(() => {
        if (!firestore) return
        const q = query(
            collection(firestore, 'groupMessages'),
            where('groupId', '==', groupId),
            orderBy('createdAt', 'asc')
        )
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as GroupMessage[]
            setMessages(msgs)
        }, (error) => {
            console.error('Error fetching group messages:', error)
            // fallback to empty or keep previous
        })

        return () => unsubscribe()
    }, [groupId])

    return messages
}

export function useGroupInvites(userId: string | null): GroupInvite[] | undefined {
    const [invites, setInvites] = useState<GroupInvite[] | undefined>(undefined)

    useEffect(() => {
        if (!firestore || !userId) {
            setInvites(undefined)
            return
        }
        // Query incoming pending invites for this user
        const q = query(
            collection(firestore, 'groupInvites'),
            where('targetUserId', '==', userId),
            where('status', '==', 'pending')
        )
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const invs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as GroupInvite[]
            setInvites(invs)
        }, (error) => {
            console.error('Error fetching group invites:', error)
        })

        return () => unsubscribe()
    }, [userId])

    return invites
}

export function useOutgoingInvites(groupId: string): GroupInvite[] | undefined {
    const [invites, setInvites] = useState<GroupInvite[] | undefined>(undefined)

    useEffect(() => {
        if (!firestore) return
        const q = query(
            collection(firestore, 'groupInvites'),
            where('groupId', '==', groupId),
            where('status', '==', 'pending')
        )
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const invs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as GroupInvite[]
            setInvites(invs)
        }, (error) => {
            console.error('Error fetching outgoing invites:', error)
        })

        return () => unsubscribe()
    }, [groupId])

    return invites
}
