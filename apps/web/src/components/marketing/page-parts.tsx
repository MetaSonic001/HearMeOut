import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { Section } from "@/components/marketing/section"

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={item.name} className="flex items-center gap-1">
            {item.href ? (
              <Link href={item.href} className="hover:text-foreground">
                {item.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
                {item.name}
              </span>
            )}
            {i < items.length - 1 && <ChevronRightIcon className="size-3.5" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function PageHero({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-b bg-gradient-to-b from-accent/50 via-background to-background">
      <div className={aside ? "container-page grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1.05fr_1fr]" : "container-page max-w-4xl py-10 sm:py-14"}>
        <div>{children}</div>
        {aside}
      </div>
    </section>
  )
}

export function StepsSection({ steps, title = "How it works" }: { steps: { name: string; text: string }[]; title?: string }) {
  return (
    <Section id="steps" title={title}>
      <ol className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.name} className="rounded-2xl border bg-card p-6">
            <span className="mb-3 flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
            <h3 className="font-semibold">{step.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

export function BenefitsSection({ benefits, title = "Why people use it" }: { benefits: { title: string; text: string }[]; title?: string }) {
  return (
    <Section id="benefits" title={title} className="bg-muted/40">
      <ul className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
        {benefits.map((b) => (
          <li key={b.title} className="rounded-2xl border bg-card p-6">
            <h3 className="font-semibold">{b.title}</h3>
            <p className="mt-1 text-muted-foreground">{b.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function RelatedLinks({ title = "Related", links }: { title?: string; links: { href: string; label: string }[] }) {
  return (
    <Section id="related" title={title}>
      <ul className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="inline-flex rounded-full border bg-card px-4 py-2 text-sm hover:border-primary/50">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}
