'use client'

import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Mic, Square, Trash2, Play, Pause, Plus } from 'lucide-react'
import { db, uid, type AudioRecording } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function formatDuration(ms: number) {
    const total = Math.round(ms / 1000)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}

export function AudioRecorder({ noteId, userId }: { noteId: string; userId: string }) {
    const recordings = useLiveQuery(
        () => db.audio.where('noteId').equals(noteId).toArray(),
        [noteId],
    )

    const [recording, setRecording] = useState(false)
    const [elapsed, setElapsed] = useState(0)
    const mediaRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const streamRef = useRef<MediaStream | null>(null)
    const startRef = useRef<number>(0)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
            streamRef.current?.getTracks().forEach((t) => t.stop())
        }
    }, [])

    const start = async () => {
        if (recording) return
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            toast.error("L'enregistrement audio n'est pas pris en charge sur cet appareil.")
            return
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream
            // Fresh recorder + chunks for every independent recording.
            chunksRef.current = []
            const recorder = new MediaRecorder(stream)
            mediaRef.current = recorder

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }
            recorder.onstop = async () => {
                const duration = Date.now() - startRef.current
                const blob = new Blob(chunksRef.current, {
                    type: recorder.mimeType || 'audio/webm',
                })
                chunksRef.current = []
                streamRef.current?.getTracks().forEach((t) => t.stop())
                streamRef.current = null
                if (blob.size > 0) {
                    await db.audio.add({
                        id: uid(),
                        noteId,
                        userId,
                        blob,
                        duration,
                        createdAt: Date.now(),
                    })
                    toast.success('Enregistrement ajouté.')
                }
            }

            startRef.current = Date.now()
            setElapsed(0)
            recorder.start()
            setRecording(true)
            timerRef.current = setInterval(
                () => setElapsed(Date.now() - startRef.current),
                200,
            )
        } catch {
            toast.error("Accès au micro refusé.")
        }
    }

    const stop = () => {
        if (!recording) return
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = null
        mediaRef.current?.stop()
        setRecording(false)
        setElapsed(0)
    }

    const remove = async (id: string) => {
        await db.audio.delete(id)
        toast.success('Enregistrement supprimé.')
    }

    return (
        <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <p className="text-sm font-medium">Enregistrements audio</p>
                {recording ? (
                    <Button size="sm" variant="destructive" onClick={stop} className="gap-2">
                        <Square className="size-3.5" />
                        {formatDuration(elapsed)}
                    </Button>
                ) : (
                    <Button size="sm" variant="outline" onClick={start} className="gap-2">
                        {recordings && recordings.length > 0 ? (
                            <Plus className="size-3.5" />
                        ) : (
                            <Mic className="size-3.5" />
                        )}
                        {recordings && recordings.length > 0 ? 'Ajouter' : 'Enregistrer'}
                    </Button>
                )}
            </div>

            {recording && (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-destructive">
                    <span className="size-2 animate-pulse rounded-full bg-destructive" />
                    Enregistrement en cours…
                </div>
            )}

            <ul className="divide-y divide-border">
                {recordings && recordings.length > 0
                    ? recordings.map((rec) => (
                        <AudioItem key={rec.id} recording={rec} onDelete={() => remove(rec.id)} />
                    ))
                    : !recording && (
                        <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                            Aucun enregistrement.
                        </li>
                    )}
            </ul>
        </div>
    )
}

function AudioItem({
    recording,
    onDelete,
}: {
    recording: AudioRecording
    onDelete: () => void
}) {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const [url, setUrl] = useState<string>('')
    const [playing, setPlaying] = useState(false)

    useEffect(() => {
        const objectUrl = URL.createObjectURL(recording.blob)
        setUrl(objectUrl)
        return () => URL.revokeObjectURL(objectUrl)
    }, [recording.blob])

    const toggle = () => {
        const el = audioRef.current
        if (!el) return
        if (playing) {
            el.pause()
        } else {
            void el.play()
        }
    }

    return (
        <li className="flex items-center gap-3 px-3 py-2">
            <Button
                size="icon"
                variant="ghost"
                className="size-8 shrink-0"
                onClick={toggle}
                aria-label={playing ? 'Pause' : 'Lecture'}
            >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <div className="min-w-0 flex-1">
                <p className="text-sm tabular-nums">{formatDuration(recording.duration)}</p>
                <p className="truncate text-xs text-muted-foreground">
                    {new Date(recording.createdAt).toLocaleString('fr-FR')}
                </p>
            </div>
            <audio
                ref={audioRef}
                src={url}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                className="hidden"
            />
            <Button
                size="icon"
                variant="ghost"
                className={cn('size-8 shrink-0 text-muted-foreground hover:text-destructive')}
                onClick={onDelete}
                aria-label="Supprimer l'enregistrement"
            >
                <Trash2 className="size-4" />
            </Button>
        </li>
    )
}
