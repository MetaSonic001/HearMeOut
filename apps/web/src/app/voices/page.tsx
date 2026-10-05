import Link from "next/link"

import { Breadcrumbs, PageHero } from "@/components/marketing/page-parts"
import { Section } from "@/components/marketing/section"
import { LANGUAGE_PAGES } from "@/lib/content/languages"
import { JsonLd, breadcrumbLd } from "@/lib/seo/json-ld"
import { pageMetadata } from "@/lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Voices and languages: Hindi, Hinglish, English and 20+ more",
  description:
    "Natural text-to-speech voices in English, Hindi, Hinglish, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam, Urdu and a dozen global languages. Preview before you listen.",
  path: "/voices",
})

function Group({ title, items }: { title: string; items: typeof LANGUAGE_PAGES }) {
  return (
    <div className="mb-10">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((l) => (
          <li key={l.slug}>
            <Link href={`/voices/${l.slug}`} className="flex items-center justify-between rounded-xl border bg-card p-4 hover:border-primary/50">
              <span>
                <span className="block font-medium">{l.label}</span>
                <span className="text-sm text-muted-foreground" lang={l.code === "hinglish" ? "en" : l.code}>
                  {l.native}
                </span>
              </span>
              <span className="text-sm text-muted-foreground">
                {l.voices.length} voice{l.voices.length === 1 ? "" : "s"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function VoicesPage() {
  return (
    <>
      <PageHero>
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Voices" }]} />
        <h1 className="text-3xl font-semibold sm:text-5xl">Natural voices in your language</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Choose a language to see its voices. Smart modes can even explain your English notes in Hindi, Hinglish and other Indian languages.
        </p>
      </PageHero>
      <Section id="all" title="All languages" description="Every voice can be previewed before you create audio.">
        <div className="mx-auto max-w-5xl">
          <Group title="Indian languages" items={LANGUAGE_PAGES.filter((l) => l.indian)} />
          <Group title="Global languages" items={LANGUAGE_PAGES.filter((l) => !l.indian)} />
        </div>
      </Section>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Voices", path: "/voices" },
        ])}
      />
    </>
  )
}
