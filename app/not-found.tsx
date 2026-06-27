import Link from 'next/link'
import { Compass, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
        <Compass className="size-8" />
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="font-heading text-6xl font-semibold tracking-tight text-primary">404</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">
          Page introuvable
        </h1>
        <p className="max-w-md text-pretty text-muted-foreground leading-relaxed">
          La page que vous cherchez n&apos;existe pas ou a été déplacée. Vérifiez l&apos;adresse ou
          revenez à votre espace de travail.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button render={<Link href="/" />}>
          <ArrowLeft className="size-4" /> Retournez en lieu sûr
        </Button>
      </div>
    </main>
  )
}
