'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function ResetMdpPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim()) {
            toast.error('Veuillez entrer votre email.')
            return
        }
        setLoading(true)
        try {
            const { sendResetEmail } = await import('@/lib/auth')
            await sendResetEmail(email)
            toast.success('Lien de réinitialisation envoyé ! Vérifiez vos emails.')
            router.push('/login')
        } catch (err: any) {
            console.error(err)
            toast.error(err.message || 'Erreur lors de l\'envoi du lien.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <div className="mb-8 flex flex-col items-center text-center">
                <span className="mb-12 font-heading text-5xl font-semibold rounded-md bg-primary text-black p-1 hover:text-primary hover:bg-background transition-all duration-500">
                    Studesk
                </span>
                <h1 className="font-heading text-2xl font-semibold">Réinitialiser le mot de passe</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Entrez votre email pour recevoir un lien de réinitialisation.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">Email </Label>
                    <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vous@exemple.com"
                    />
                </div>
                <Button type="submit" disabled={loading} size="lg" className="mt-2">
                    {loading ? 'Envoi…' : 'Réinitialiser le mot de passe'}
                </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
                <Link href="/login" className="font-medium text-primary hover:underline">Retour à la page de connexion</Link>
            </p>
        </div>
    )
}
