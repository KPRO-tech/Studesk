export const DAY = 86_400_000

export function startOfDay(d: number | Date): number {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function endOfDay(d: number | Date): number {
  const date = new Date(d)
  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

export function isSameDay(a: number | Date, b: number | Date): boolean {
  return startOfDay(a) === startOfDay(b)
}

export function isToday(d: number | Date): boolean {
  return isSameDay(d, Date.now())
}

export function isPast(d: number | Date): boolean {
  const ts = typeof d === 'number' ? d : d.getTime()
  return ts < startOfDay(Date.now())
}

export function startOfMonth(d: number | Date = Date.now()): number {
  const date = new Date(d)
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function endOfMonth(d: number | Date = Date.now()): number {
  const date = new Date(d)
  date.setMonth(date.getMonth() + 1, 0)
  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

export function todayInputValue(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

/** Convert a datetime-local string to a timestamp. */
export function localToTs(value: string): number {
  return new Date(value).getTime()
}

/** Convert a timestamp to a datetime-local input value. */
export function tsToLocal(ts: number): string {
  const d = new Date(ts)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function formatDate(ts: number, locale = 'fr-FR'): string {
  return new Date(ts).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatTime(ts: number, locale = 'fr-FR'): string {
  return new Date(ts).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Weekday labels, Monday-first to match the weekly routine grid. */
export const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/** Current day-of-week as a Monday-first index (0 = Monday … 6 = Sunday). */
export function weekdayIndex(d: number | Date = Date.now()): number {
  return (new Date(d).getDay() + 6) % 7
}

/** Convert a "HH:MM" string to minutes from midnight. */
export function timeToMin(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Convert minutes from midnight to a "HH:MM" label. */
export function minToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/** Compact "time ago" label: "à l'instant", "il y a 5 min", "il y a 2 h", "hier", then a date. */
export function formatRelativeTime(ts: number, locale = 'fr-FR'): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY)
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} j`
  return formatDate(ts, locale)
}


export function formatRelativeDay(ts: number, locale = 'fr-FR'): string {
  const diff = startOfDay(ts) - startOfDay(Date.now())
  const days = Math.round(diff / DAY)
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Demain'
  if (days === -1) return 'Hier'
  if (days < 0) return `Il y a ${Math.abs(days)} j`
  if (days < 7) return `Dans ${days} j`
  return formatDate(ts, locale)
}
