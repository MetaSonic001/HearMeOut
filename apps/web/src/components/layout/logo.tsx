import Link from "next/link"

import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} role="img" aria-label="HearMeOut logo">
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <g className="fill-primary-foreground">
        <rect x="6" y="13" width="3" height="6" rx="1.5" />
        <rect x="11" y="9" width="3" height="14" rx="1.5" />
        <rect x="16" y="6" width="3" height="20" rx="1.5" />
        <rect x="21" y="10" width="3" height="12" rx="1.5" />
      </g>
    </svg>
  )
}

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-lg">HearMeOut</span>
    </Link>
  )
}
