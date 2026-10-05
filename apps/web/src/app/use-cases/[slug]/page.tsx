import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { IntakeCard } from "@/components/intake/intake-card"
import { FaqSection } from "@/components/marketing/faq-section"
import { BenefitsSection, Breadcrumbs, PageHero, RelatedLinks, StepsSection } from "@/components/marketing/page-parts"
import { CtaBand } from "@/components/marketing/sections"
import { MODE_BY_ID } from "@/lib/content/core"
import { USE_CASES, USE_CASE_BY_SLUG } from "@/lib/content/use-cases"
import { JsonLd, breadcrumbLd, faqLd, howToLd, webPageLd } from "@/lib/seo/json-ld"
import { pageMetadata } from "@/lib/seo/metadata"

export function generateStaticParams() {
  return USE_CASES.map((u) => ({ slug: u.slug }))
}

export async function generateMetadata({ params }: PageProps<"/use-cases/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const u = USE_CASE_BY_SLUG[slug]
  if (!u) return {}
  return pageMetadata({ title: u.metaTitle, description: u.description, path: `/use-cases/${u.slug}`, keywords: [u.keyword] })
}

export default async function UseCasePage({ params }: PageProps<"/use-cases/[slug]">) {
  const { slug } = await params
  const u = USE_CASE_BY_SLUG[slug]
  if (!u) notFound()
  const path = `/use-cases/${u.slug}`
  const mode = MODE_BY_ID[u.mode]
  return (
    <>
      <PageHero aside={<IntakeCard />}>
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Use cases", href: "/use-cases" }, { name: u.title }]} />
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">{u.title}</h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">{u.intro}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Best with <strong className="text-foreground">{mode.label}</strong>: {mode.description}
        </p>
      </PageHero>
      <StepsSection steps={u.steps} />
      <BenefitsSection benefits={u.benefits} />
      <FaqSection items={u.faqs} title={`${u.keyword.charAt(0).toUpperCase()}${u.keyword.slice(1)}: common questions`} />
      <RelatedLinks
        title="More ways to listen"
        links={u.related.flatMap((r) => (USE_CASE_BY_SLUG[r] ? [{ href: `/use-cases/${r}`, label: USE_CASE_BY_SLUG[r].title }] : []))}
      />
      <CtaBand />
      <JsonLd
        data={[
          webPageLd(u.title, u.description, path),
          faqLd(u.faqs),
          howToLd(u.title, u.steps),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Use cases", path: "/use-cases" },
            { name: u.title, path },
          ]),
        ]}
      />
    </>
  )
}
