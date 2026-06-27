'use client'

import { useEffect, useState } from 'react'

export function LiveClock({
  locale = 'fr-FR',
  className,
  withDate = true,
}: {
  locale?: string
  className?: string
  withDate?: boolean
}) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return <span className={className} />

  const time = now.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const date = now.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <span className={className}>
      {withDate && <span className="capitalize">{date}</span>}
      {withDate && <span className="mx-2 text-border">·</span>}
      <span className="tabular-nums">{time}</span>
    </span>
  )
}
