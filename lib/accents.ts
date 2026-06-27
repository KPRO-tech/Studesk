export interface AccentPreset {
  key: string
  label: string
  // swatch shown in UI (any valid css color)
  swatch: string
  light: { primary: string; foreground: string }
  dark: { primary: string; foreground: string }
}

export const ACCENTS: AccentPreset[] = [
  {
    key: 'clay',
    label: 'Argile',
    swatch: 'oklch(0.52 0.11 40)',
    light: { primary: 'oklch(0.52 0.11 40)', foreground: 'oklch(0.985 0 0)' },
    dark: { primary: 'oklch(0.62 0.12 40)', foreground: 'oklch(0.16 0 0)' },
  },
  {
    key: 'blue',
    label: 'Bleu',
    swatch: 'oklch(0.53 0.15 250)',
    light: { primary: 'oklch(0.53 0.15 250)', foreground: 'oklch(0.985 0 0)' },
    dark: { primary: 'oklch(0.64 0.15 250)', foreground: 'oklch(0.16 0 0)' },
  },
  {
    key: 'green',
    label: 'Vert',
    swatch: 'oklch(0.53 0.13 150)',
    light: { primary: 'oklch(0.53 0.13 150)', foreground: 'oklch(0.985 0 0)' },
    dark: { primary: 'oklch(0.65 0.13 150)', foreground: 'oklch(0.16 0 0)' },
  },
  {
    key: 'red',
    label: 'Rouge',
    swatch: 'oklch(0.54 0.2 25)',
    light: { primary: 'oklch(0.54 0.2 25)', foreground: 'oklch(0.985 0 0)' },
    dark: { primary: 'oklch(0.63 0.19 25)', foreground: 'oklch(0.16 0 0)' },
  },
  {
    key: 'pink',
    label: 'Rose',
    swatch: 'oklch(0.58 0.18 0)',
    light: { primary: 'oklch(0.58 0.18 0)', foreground: 'oklch(0.985 0 0)' },
    dark: { primary: 'oklch(0.66 0.17 0)', foreground: 'oklch(0.16 0 0)' },
  },
  {
    key: 'amber',
    label: 'Ambre',
    swatch: 'oklch(0.7 0.14 70)',
    light: { primary: 'oklch(0.66 0.14 70)', foreground: 'oklch(0.16 0 0)' },
    dark: { primary: 'oklch(0.75 0.13 70)', foreground: 'oklch(0.16 0 0)' },
  },
  {
    key: 'teal',
    label: 'Sarcelle',
    swatch: 'oklch(0.55 0.1 195)',
    light: { primary: 'oklch(0.53 0.1 195)', foreground: 'oklch(0.985 0 0)' },
    dark: { primary: 'oklch(0.66 0.1 195)', foreground: 'oklch(0.16 0 0)' },
  },
  {
    key: 'ink',
    label: 'Encre',
    swatch: 'oklch(0.32 0.01 260)',
    light: { primary: 'oklch(0.3 0.01 260)', foreground: 'oklch(0.985 0 0)' },
    dark: { primary: 'oklch(0.82 0.02 260)', foreground: 'oklch(0.16 0 0)' },
  },
]

export const DEFAULT_ACCENT = 'clay'

export function getAccent(key: string): AccentPreset {
  return ACCENTS.find((a) => a.key === key) ?? ACCENTS[0]
}

/** Apply an accent preset to the document root for the given mode. */
export function applyAccent(key: string, isDark: boolean) {
  if (typeof document === 'undefined') return
  const accent = getAccent(key)
  const tone = isDark ? accent.dark : accent.light
  const root = document.documentElement
  root.style.setProperty('--primary', tone.primary)
  root.style.setProperty('--primary-foreground', tone.foreground)
  root.style.setProperty('--ring', tone.primary)
  root.style.setProperty('--sidebar-primary', tone.primary)
  root.style.setProperty('--sidebar-primary-foreground', tone.foreground)
  root.style.setProperty('--sidebar-ring', tone.primary)
  root.style.setProperty('--chart-1', tone.primary)
}
