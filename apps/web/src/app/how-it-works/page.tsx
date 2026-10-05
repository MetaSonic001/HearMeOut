import Link from "next/link"

import { FaqSection } from "@/components/marketing/faq-section"
import { Breadcrumbs, PageHero } from "@/components/marketing/page-parts"
import { Section } from "@/components/marketing/section"
import { CtaBand } from "@/components/marketing/sections"
import { buttonVariants } from "@/components/ui/button"
import { FAQ, MODES } from "@/lib/content/core"
import { JsonLd, breadcrumbLd, faqLd, howToLd } from "@/lib/seo/json-ld"
import { pageMetadata } from "@/lib/seo/metadata"

export const metadata = pageMetadata({
  title: "How HearMeOut works: from PDF to audio you can learn from",
  description:
    "See how HearMeOut cleans your document, detects chapters, prepares audio in small pieces so it starts instantly, and offers study, revision, explain and quiz modes.",
  path: "/how-it-works",
})

const STEPS = [
  { name: "Add your content", text: "Paste text, upload a PDF, Word, EPUB, TXT or HTML file, or paste a web link. A guest can do this without an account." },
  { name: "We clean it for listening", text: "Running headers, page numbers, footnote markers, citations, web addresses and reference lists are removed. Chapters are detected from bookmarks, headings or the table of contents." },
  { name: "Choose how to listen", text: "Pick full narration, a study version, quick revision, a plain-language explanation or a quiz. Choose a voice, preview it, and pick the sections you want." },
  { name: "Listen, navigate and check the source", text: "Audio starts within seconds. Jump between chapters, change speed, set a sleep timer and see the source page for anything you hear." },
]

export default function HowItWorksPage() {
  return (
    <>
      <PageHero>
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "How it works" }]} />
        <h1 className="text-3xl font-semibold sm:text-5xl">How HearMeOut turns reading into listening</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          HearMeOut is a web app that converts PDFs, documents, ebooks, articles and pasted text into audio. It reads your document properly, then lets you choose how deep to go, and it starts playing within seconds, even for a whole book.
        </p>
        <Link href="/#top" className={buttonVariants({ size: "lg", className: "mt-6" })}>
          Try it now
        </Link>
      </PageHero>

      <Section id="steps" title="Four steps, no jargon">
        <ol className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.name} className="rounded-2xl border bg-card p-6">
              <span className="mb-3 flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
              <h3 className="font-semibold">{s.name}</h3>
              <p className="mt-1 text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="modes" title="Five listening modes" className="bg-muted/40">
        <dl className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
          {MODES.map((m) => (
            <div key={m.id} className="rounded-2xl border bg-card p-6">
              <dt className="font-semibold">{m.label}</dt>
              <dd className="mt-1 text-muted-foreground">{m.description}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="why-fast" title="Why it starts so fast">
        <div className="mx-auto max-w-3xl space-y-4 text-lg text-muted-foreground">
          <p>
            Instead of converting the whole document before you can hear anything, HearMeOut prepares audio in short pieces, starting with a very short first piece, and keeps a few pieces ahead of where you are listening. A 500-page book therefore starts as quickly as a single page.
          </p>
          <p>
            Identical passages are only prepared once, so popular texts load even faster. Your documents themselves stay private to you.
          </p>
          <p>
            Smart modes (study, revision, explain and quiz) work chapter by chapter in the background, so the first chapter is ready in a few seconds while later chapters are still being prepared.
          </p>
        </div>
      </Section>

      <Section id="accuracy" title="How accurate are smart modes?" className="bg-muted/40">
        <div className="mx-auto max-w-3xl space-y-4 text-lg text-muted-foreground">
          <p>
            Study, revision, explain and quiz modes use an AI model that works only from your document and is instructed not to invent facts. Even so, AI can make mistakes. That is why every section shows the page it came from, and why Read it to me is always available for exact wording.
          </p>
          <p>Use smart modes to learn faster, and check the original for anything critical, such as exam definitions, legal text or medical information.</p>
        </div>
      </Section>

      <FaqSection items={FAQ.slice(0, 6)} />
      <CtaBand />
      <JsonLd
        data={[
          howToLd("Turn a PDF into audio with HearMeOut", STEPS),
          faqLd(FAQ.slice(0, 6)),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "How it works", path: "/how-it-works" },
          ]),
        ]}
      />
    </>
  )
}
