'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Settings2, MessageSquare, Trash2, Calendar, MoreVertical } from 'lucide-react'
import { db } from '@/lib/db'
import { useApp } from '@/components/providers'
import { PageHeader } from '@/components/page-header'
import { AiSettingsDialog } from '@/components/ai-settings-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatRelativeDay } from '@/lib/dates'
import { toast } from 'sonner'

export default function AiHistoryPage() {
  const { userId, settings } = useApp()
  const router = useRouter()
  const [configOpen, setConfigOpen] = useState(false)

  const conversations = useLiveQuery(
    () =>
      userId
        ? db.conversations.where('userId').equals(userId).reverse().sortBy('updatedAt')
        : [],
    [userId],
  )

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await db.conversations.delete(id)
    toast.success('Conversation supprimée.')
  }

  const list = conversations ?? []

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Assistant d'étude IA"
        description="Retrouvez vos conversations passées ou posez de nouvelles questions."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setConfigOpen(true)}>
              <Settings2 className="size-4" />
              <span className="sr-only sm:not-sr-only sm:ml-2">Réglages</span>
            </Button>
            <Button onClick={() => router.push('/ai/new')}>
              <Plus className="size-4" />
              <span className="sr-only sm:not-sr-only sm:ml-2">Nouvelle discussion</span>
            </Button>
          </div>
        }
      />

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquare className="size-6" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold">Aucune conversation</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Démarrez une nouvelle conversation avec l'IA pour générer des résumés, des flashcards ou vous faire interroger.
            </p>
          </div>
          <Button onClick={() => router.push('/ai/new')} className="mt-2 gap-2">
            <Plus className="size-4" /> Nouvelle discussion
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Card
              key={c.id}
              className="group relative flex cursor-pointer flex-col p-5 transition-colors hover:border-primary/50"
              onClick={() => router.push(`/ai/${c.id}`)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <MessageSquare className="size-5" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    onClick={(e) => e.stopPropagation()}
                    className="flex size-8 -mr-2 -mt-2 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-accent-foreground group-hover:opacity-100"
                  >
                    <MoreVertical className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => deleteConversation(c.id, e as any)}>
                      <Trash2 className="mr-2 size-4" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-4 flex flex-col gap-1">
                <h3 className="line-clamp-2 font-medium leading-snug">{c.title}</h3>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="size-3.5" />
                  {formatRelativeDay(c.updatedAt)}
                  <span className="mx-1">•</span>
                  {c.messages.length} message{c.messages.length > 1 ? 's' : ''}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {settings && (
        <AiSettingsDialog
          settings={settings}
          open={configOpen}
          onOpenChange={setConfigOpen}
        />
      )}
    </div>
  )
}
