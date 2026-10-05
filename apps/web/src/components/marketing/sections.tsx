import { ArrowRightIcon, CheckIcon, FileUpIcon, HeadphonesIcon, SlidersHorizontalIcon } from "lucide-react"
import Link from "next/link"

import { ModeIcon } from "@/components/marketing/mode-icon"
import { Section } from "@/components/marketing/section"
import { buttonVariants } from "@/components/ui/button"
import { MODES, PRICES } from "@/lib/content/core"
import { LANGUAGE_PAGES } from "@/lib/content/languages"
import { USE_CASES } from "@/lib/content/use-cases"
import { cn } from "@/lib/utils"

export function HowItWorks() {
  const steps = [
    { icon: FileUpIcon, title: "Add anything", text: "Paste text, drop a PDF, Word or EPUB file, or paste a link. No account needed." },
    { icon: SlidersHorizontalIcon, title: "Choose how to listen", text: "Full reading, a study version, quick revision, a simple explanation or a quiz. Pick a voice and language." },
    { icon: HeadphonesIcon, title: "Press play", text: "Audio starts in seconds. Skip chapters, set a timer, and see the source page for anything you hear." },
  ]
  return (
    <Section id="how" eyebrow="How it works" title="From document to listening in three steps">
      <ol className="grid gap-6 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="rounded-2xl border bg-card p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <step.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-muted-foreground">Step {i + 1}</span>
            </div>
            <h3 className="text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

export function ModesGrid() {
  return (
    <Section
      id="modes"
      eyebrow="Five ways to listen"
      title="Listening that fits what you need to do"
      description="Reading every word is just the start. Compress, explain or test yourself, all by ear."
      className="bg-muted/40"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODES.map((mode) => (
          <div key={mode.id} className="rounded-2xl border bg-card p-6">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <ModeIcon icon={mode.icon} className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">{mode.label}</h3>
                <p className="text-xs text-muted-foreground">{mode.short}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{mode.description}</p>
          </div>
        ))}
        <div className="flex flex-col justify-between rounded-2xl border border-dashed bg-card/50 p-6">
          <p className="text-sm text-muted-foreground">
            Every section links to the page it came from, so you can always check the original.
          </p>
          <Link href="/how-it-works" className={cn(buttonVariants({ variant: "link" }), "mt-3 w-fit px-0")}>
            See how it works <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </Section>
  )
}

export function UseCasesGrid({ limit = 6, heading = true }: { limit?: number; heading?: boolean }) {
  const items = USE_CASES.slice(0, limit)
  const grid = (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((u) => (
        <li key={u.slug}>
          <Link href={`/use-cases/${u.slug}`} className="group flex h-full flex-col rounded-2xl border bg-card p-6 transition-colors hover:border-primary/50">
            <h3 className="font-semibold group-hover:text-primary">{u.title}</h3>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{u.audience}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Learn more <ArrowRightIcon className="size-4" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
  if (!heading) return grid
  return (
    <Section id="use-cases" eyebrow="Made for real life" title="Students, professionals and curious readers" description="Turn the reading you keep postponing into time you already have.">
      {grid}
      <div className="mt-8 text-center">
        <Link href="/use-cases" className={buttonVariants({ variant: "outline" })}>
          All use cases
        </Link>
      </div>
    </Section>
  )
}

export function LanguagesStrip() {
  return (
    <Section
      id="languages"
      eyebrow="Languages and voices"
      title="Natural voices in your language"
      description="English, Hindi, Hinglish, six more Indian languages and a dozen global ones. Preview any voice before you start."
      className="bg-muted/40"
    >
      <ul className="flex flex-wrap justify-center gap-2">
        {LANGUAGE_PAGES.map((l) => (
          <li key={l.slug}>
            <Link href={`/voices/${l.slug}`} className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm transition-colors hover:border-primary/50">
              <span lang={l.code === "hinglish" ? "en" : l.code} className="font-medium">{l.native}</span>
              {l.native !== l.label && <span className="text-muted-foreground">{l.label}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function PricingTeaser() {
  const tiers = [
    { name: "Free", price: "₹0", note: "forever", points: ["About 20 min a day as a guest", "About 60 min a day with a free account", "All five listening modes"], cta: "Start listening", href: "/#top" },
    { name: "Per book", price: `₹${PRICES.book}`, note: "one-time", points: ["One document, any length", "No daily limit on that book", "MP3 download, kept 90 days"], cta: "See details", href: "/pricing" },
    { name: "Pro", price: `₹${PRICES.proMonthly}`, note: `per month · ₹${PRICES.proYearly}/year`, points: ["Unlimited standard voices", "Study, explain and quiz modes", "Private podcast feed"], cta: "Go Pro", href: "/pricing", featured: true },
  ]
  return (
    <Section id="pricing" eyebrow="Pricing in rupees" title="Free to start. Fair when you need more." description="No 30-minute wall, no surprise subscription. Pay for one book or go Pro.">
      <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
        {tiers.map((t) => (
          <div key={t.name} className={cn("flex flex-col rounded-2xl border bg-card p-6", t.featured && "border-primary ring-1 ring-primary")}>
            <h3 className="font-semibold">{t.name}</h3>
            <p className="mt-2 text-3xl font-semibold">{t.price}</p>
            <p className="text-sm text-muted-foreground">{t.note}</p>
            <ul className="my-5 flex-1 space-y-2 text-sm">
              {t.points.map((p) => (
                <li key={p} className="flex gap-2">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
            <Link href={t.href} className={buttonVariants({ variant: t.featured ? "default" : "outline", size: "lg" })}>
              {t.cta}
            </Link>
          </div>
        ))}
      </div>
    </Section>
  )
}

export function CtaBand() {
  return (
    <section className="section-y">
      <div className="container-page">
        <div className="rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12">
          <h2 className="text-3xl font-semibold sm:text-4xl">Have something you don&apos;t want to read?</h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">Drop it in and listen in seconds. No sign-up, no 30-minute wall.</p>
          <Link href="/#top" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "mt-6 h-11 px-6 text-base")}>
            Start listening
          </Link>
        </div>
      </div>
    </section>
  )
}
