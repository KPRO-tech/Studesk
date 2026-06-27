'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/components/providers'

export default function AuthLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { ready, userId } = useApp()

  useEffect(() => {
    if (ready && userId) router.replace('/')
  }, [ready, userId, router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
