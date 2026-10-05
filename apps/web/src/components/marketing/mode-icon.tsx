import { BookOpenIcon, CircleHelpIcon, GraduationCapIcon, LanguagesIcon, LightbulbIcon, ZapIcon } from "lucide-react"

import type { ModeCopy } from "@/lib/content/core"

const ICONS = {
  book: BookOpenIcon,
  languages: LanguagesIcon,
  graduation: GraduationCapIcon,
  zap: ZapIcon,
  lightbulb: LightbulbIcon,
  help: CircleHelpIcon,
} as const

export function ModeIcon({ icon, className }: { icon: ModeCopy["icon"]; className?: string }) {
  const Icon = ICONS[icon]
  return <Icon className={className} aria-hidden="true" />
}
