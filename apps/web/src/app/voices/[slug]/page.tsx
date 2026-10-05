import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { IntakeCard } from "@/components/intake/intake-card"
import { FaqSection } from "@/components/marketing/faq-section"
import { Breadcrumbs, PageHero, RelatedLinks, StepsSection } from "@/components/marketing/page-parts"
import { Section } from "@/components/marketing/section"
import { CtaBand } from "@/components/marketing/sections"
import type { FaqItem } from "@/lib/content/core"
import { LANGUAGE_BY_SLUG, LANGUAGE_PAGES } from "@/lib/content/languages"
import { JsonLd, breadcrumbLd, faqLd, howToLd, webPageLd } from "@/lib/seo/json-ld"
import { pageMetadata } from "@/lib/seo/metadata"

export function generateStaticParams() {
  return LANGUAGE_PAGES.map((l) => ({ slug: l.slug }))
}

function seoTitle(label: string, indian: boolean): string {
  return indian ? `${label} Text to Speech: Natural Voices, Free to Try` : `${label} Text to Speech: Natural Voices for PDFs and Notes`
}

export async function generateMetadata({ params }: PageProps<"/voices/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const l = LANGUAGE_BY_SLUG[slug]
  if (!l) return {}
  return pageMetadata({
    title: seoTitle(l.label, l.indian),
    description: `Listen to PDFs, notes and articles in ${l.label} with natural voices. ${l.angle} Free to start, no sign-up needed.`,
    path: `/voices/${l.slug}`,
    keywords: [`${l.label.toLowerCase()} text to speech`, `${l.label.toLowerCase()} audiobook`],
  })
}

export default async function VoicePage({ params }: PageProps<"/voices/[slug]">) {
  const { slug } = await params
  const l = LANGUAGE_BY_SLUG[slug]
  if (!l) notFound()
  const path = `/voices/${l.slug}`
  const names = l.voices.map((v) => v.name).join(", ")
  const faqs: FaqItem[] = [
    {
      q: `Is there a free ${l.label} text to speech tool?`,
      a: `Yes. HearMeOut lets you listen to ${l.label} content for free every day, about 20 minutes as a guest and 60 minutes with a free account, with no sign-up needed to start.`,
    },
    {
      q: `How many ${l.label} voices can I choose from?`,
      a: `${l.voices.length} natural ${l.label} voice${l.voices.length === 1 ? "" : "s"}: ${names}. You can preview each voice before you create your audio.`,
    },
    {
      q: l.indian ? `Can I get English study material explained in ${l.label}?` : `Can I listen to long documents in ${l.label}?`,
      a: l.indian
        ? `Yes. Choose Explain it simply or Study version and pick ${l.label} as the language. HearMeOut explains your document in ${l.label}, keeping technical terms in English where that is natural.`
        : `Yes. Paste text or upload a PDF, Word or EPUB file and choose a ${l.label} voice. There is no 30-minute cap on documents.`,
    },
  ]
  const steps = [
    { name: "Add your content", text: `Paste ${l.label} text, upload a PDF, Word or EPUB file, or add a web link.` },
    { name: `Pick a ${l.label} voice`, text: `Choose from ${names} and preview before you start.` },
    { name: "Listen", text: "Audio begins in seconds with chapters, speed control, a sleep timer and a transcript that follows along." },
  ]
  const lang = l.code === "hinglish" ? "en" : l.code
  return (
    <>
      <PageHero aside={<IntakeCard />}>
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Voices", href: "/voices" }, { name: l.label }]} />
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">{l.label} text to speech</h1>
        <p className="mt-2 text-2xl text-muted-foreground" lang={lang}>
          {l.native}
        </p>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Turn {l.label} documents into natural audio. {l.angle}
        </p>
      </PageHero>

      <Section id="voices" title={`${l.label} voices`} description="Preview any voice on the create page before you start.">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border bg-card">
          <ul className="divide-y">
            {l.voices.map((v) => (
              <li key={`${v.name}${v.accent ?? ""}`} className="flex items-center justify-between px-5 py-4">
                <span className="font-medium">{v.name}</span>
                <span className="text-sm text-muted-foreground">
                  {v.gender}
                  {v.accent ? ` · ${v.accent}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t bg-muted/40 px-5 py-4">
            <p className="text-sm text-muted-foreground">Sample sentence</p>
            <p className="mt-1 text-lg" lang={lang}>
              {l.sample}
            </p>
          </div>
        </div>
      </Section>

      <StepsSection steps={steps} />
      <FaqSection items={faqs} title={`${l.label} text to speech: common questions`} />
      <RelatedLinks
        title="More languages"
        links={LANGUAGE_PAGES.filter((x) => x.slug !== l.slug && (x.indian === l.indian || x.slug === "english"))
          .slice(0, 8)
          .map((x) => ({ href: `/voices/${x.slug}`, label: x.label }))}
      />
      <CtaBand />
      <p className="container-page pb-10 text-center text-xs text-muted-foreground">
        Voices come from neural text-to-speech services and may change.{" "}
        <Link href="/voices" className="underline underline-offset-4">
          See all languages
        </Link>
      </p>
      <JsonLd
        data={[
          webPageLd(seoTitle(l.label, l.indian), `Listen to ${l.label} documents with natural voices.`, path),
          faqLd(faqs),
          howToLd(`Listen to ${l.label} text`, steps),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Voices", path: "/voices" },
            { name: l.label, path },
          ]),
        ]}
      />
    </>
  )
}
