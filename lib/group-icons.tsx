import {
    Users,
    BookOpen,
    Brain,
    FlaskConical,
    Sigma,
    Calculator,
    Code,
    Globe,
    Music,
    Palette,
    Rocket,
    GraduationCap,
    Atom,
    Languages,
    PenTool,
    Landmark,
    HeartPulse,
    Microscope,
    type LucideIcon,
} from 'lucide-react'

export const GROUP_ICONS: Record<string, LucideIcon> = {
    Users,
    BookOpen,
    Brain,
    FlaskConical,
    Sigma,
    Calculator,
    Code,
    Globe,
    Music,
    Palette,
    Rocket,
    GraduationCap,
    Atom,
    Languages,
    PenTool,
    Landmark,
    HeartPulse,
    Microscope,
}

export const GROUP_ICON_KEYS = Object.keys(GROUP_ICONS)
export const DEFAULT_GROUP_ICON = 'Users'

export function getGroupIcon(name: string | undefined): LucideIcon {
    return GROUP_ICONS[name ?? ''] ?? GROUP_ICONS[DEFAULT_GROUP_ICON]
}