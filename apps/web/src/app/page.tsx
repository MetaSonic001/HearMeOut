import { CheckIcon } from "lucide-react"

import { IntakeCard } from "@/components/intake/intake-card"
import { FaqSection } from "@/components/marketing/faq-section"
import { CtaBand, HowItWorks, LanguagesStrip, ModesGrid, PricingTeaser, UseCasesGrid } from "@/components/marketing/sections"
import { FAQ } from "@/lib/content/core"
import { JsonLd, faqLd } from "@/lib/seo/json-ld"
import { pageMetadata } from "@/lib/seo/metadata"

export const metadata = pageMetadata({
  title: "HearMeOut: turn any PDF or notes into audio you can learn from",
  description:
    "Free text to audiobook converter with no 30-minute limit. Turn PDFs, notes and articles into natural audio, get a study version, revision or quiz, in English, Hindi, Hinglish and more.",
  path: "/",
})

export default function HomePage() {
  const featured = FAQ.slice(0, 7)
  return (
    <>
      <section id="top" className="border-b bg-gradient-to-b from-accent/60 via-background to-background">
        <div className="container-page grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <p className="mb-4 inline-flex rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground">
              Free to start · No sign-up needed
            </p>
            <h1 className="text-4xl font-semibold leading-[1.1] sm:text-5xl lg:text-6xl">
              Listen to anything.
              <br />
              <span className="text-primary">Learn faster.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Turn any PDF, notes or article into audio you can learn from. Hear every word, get a study version or
              quick revision, or be quizzed, in English, Hindi, Hinglish and more.
            </p>
            <ul className="mt-6 space-y-2 text-base">
              {[
                "Starts playing in seconds, even for a whole book",
                "No 30-minute wall. Pay once per book, or go Pro",
                "See the source page for anything you hear",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <CheckIcon className="mt-1 size-4 shrink-0 text-success" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <IntakeCard />
        </div>
      </section>
      <HowItWorks />
      <ModesGrid />
      <UseCasesGrid />
      <LanguagesStrip />
      <PricingTeaser />
      <FaqSection items={featured} />
      <CtaBand />
      <JsonLd data={faqLd(featured)} />
    </>
  )
}
