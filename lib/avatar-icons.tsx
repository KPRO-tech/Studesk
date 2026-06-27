import {
  GraduationCap,
  BookOpen,
  Brain,
  Rocket,
  Coffee,
  Cat,
  Dog,
  Bird,
  Leaf,
  Star,
  Heart,
  Music,
  Camera,
  Code,
  Palette,
  Briefcase,
  Globe,
  Sun,
  Moon,
  Zap,
  Flower2,
  Gamepad2,
  Mountain,
  type LucideIcon,
} from 'lucide-react'

export const AVATAR_ICONS: Record<string, LucideIcon> = {
  GraduationCap,
  BookOpen,
  Brain,
  Rocket,
  Coffee,
  Cat,
  Dog,
  Bird,
  Leaf,
  Star,
  Heart,
  Music,
  Camera,
  Code,
  Palette,
  Briefcase,
  Globe,
  Sun,
  Moon,
  Zap,
  Flower2,
  Gamepad2,
  Mountain,
}

export const AVATAR_ICON_KEYS = Object.keys(AVATAR_ICONS)
export const DEFAULT_AVATAR_ICON = 'GraduationCap'

export function getAvatarIcon(name: string | undefined): LucideIcon {
  return AVATAR_ICONS[name ?? ''] ?? AVATAR_ICONS[DEFAULT_AVATAR_ICON]
}
