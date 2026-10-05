import Link from "next/link"

import { Breadcrumbs, PageHero } from "@/components/marketing/page-parts"
import { Section } from "@/components/marketing/section"
import { COMPARE_PAGES } from "@/lib/content/compare"
import { pageMetadata } from "@/lib/seo/metadata"

export const metadata = pageMetadata({
  title: "HearMeOut compared: Speechify, NaturalReader, ElevenReader, NotebookLM",
  description: "An honest look at how HearMeOut differs from other text-to-speech and audio-learning tools, and who each one suits best.",
  path: "/compare",
})

export default function CompareIndex() {
  return (
    <>
      <PageHero>
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Compare" }]} />
        <h1 className="text-3xl font-semibold sm:text-5xl">How HearMeOut compares</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">Every tool has strengths. Here is where each one fits, so you can pick what suits you.</p>
      </PageHero>
      <Section id="list" title="Choose a comparison">
        <ul className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
          {COMPARE_PAGES.map((c) => (
            <li key={c.slug}>
              <Link href={`/compare/${c.slug}`} className="block h-full rounded-2xl border bg-card p-6 hover:border-primary/50">
                <h2 className="font-semibold">HearMeOut vs {c.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{c.tagline}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}
