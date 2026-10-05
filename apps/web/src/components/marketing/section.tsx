import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface SectionProps {
  id?: string
  eyebrow?: string
  title: string
  description?: string
  children: ReactNode
  className?: string
  align?: "left" | "center"
}

export function Section({ id, eyebrow, title, description, children, className, align = "center" }: SectionProps) {
  return (
    <section id={id} className={cn("section-y", className)} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="container-page">
        <div className={cn("mb-10 max-w-2xl", align === "center" && "mx-auto text-center")}>
          {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>}
          <h2 id={id ? `${id}-title` : undefined} className="text-3xl font-semibold sm:text-4xl">
            {title}
          </h2>
          {description && <p className="mt-3 text-lg text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
    </section>
  )
}
