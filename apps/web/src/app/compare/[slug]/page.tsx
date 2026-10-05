import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { IntakeCard } from "@/components/intake/intake-card"
import { FaqSection } from "@/components/marketing/faq-section"
import { Breadcrumbs, PageHero } from "@/components/marketing/page-parts"
import { Section } from "@/components/marketing/section"
import { CtaBand } from "@/components/marketing/sections"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { COMPARE_BY_SLUG, COMPARE_CHECKED, COMPARE_PAGES } from "@/lib/content/compare"
import { JsonLd, breadcrumbLd, faqLd, webPageLd } from "@/lib/seo/json-ld"
import { pageMetadata } from "@/lib/seo/metadata"

export function generateStaticParams() {
  return COMPARE_PAGES.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: PageProps<"/compare/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const c = COMPARE_BY_SLUG[slug]
  if (!c) return {}
  return pageMetadata({
    title: `HearMeOut vs ${c.name}: which is better for studying?`,
    description: `${c.summary.slice(0, 150).replace(/\s+\S*$/, "")}…`,
    path: `/compare/${c.slug}`,
    keywords: [`${c.name.toLowerCase()} alternative`, `hearmeout vs ${c.name.toLowerCase()}`],
  })
}

export default async function ComparePage({ params }: PageProps<"/compare/[slug]">) {
  const { slug } = await params
  const c = COMPARE_BY_SLUG[slug]
  if (!c) notFound()
  const path = `/compare/${c.slug}`
  return (
    <>
      <PageHero aside={<IntakeCard />}>
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Compare", href: "/compare" }, { name: c.name }]} />
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">{c.tagline}</h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">{c.summary}</p>
      </PageHero>

      <Section id="table" title="At a glance">
        <div className="mx-auto max-w-4xl overflow-x-auto rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Feature</TableHead>
                <TableHead>{c.name}</TableHead>
                <TableHead>HearMeOut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.rows.map((r) => (
                <TableRow key={r.feature}>
                  <TableCell className="font-medium">{r.feature}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{r.them}</TableCell>
                  <TableCell className="whitespace-normal">{r.us}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mx-auto mt-3 max-w-4xl text-xs text-muted-foreground">
          Information about {c.name} is based on public sources as of {COMPARE_CHECKED} and may change. Please check their website for current details. {c.name} is a trademark of its owner; HearMeOut is not affiliated with it.
        </p>
      </Section>

      <Section id="choose" title="Which should you choose?" className="bg-muted/40">
        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="font-semibold">Choose {c.name} if…</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              {c.chooseThemIf.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-primary/40 bg-card p-6">
            <h3 className="font-semibold">Choose HearMeOut if…</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              {c.chooseUsIf.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <FaqSection items={c.faqs} title="Common questions" />
      <CtaBand />
      <JsonLd
        data={[
          webPageLd(c.tagline, c.summary, path),
          faqLd(c.faqs),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Compare", path: "/compare" },
            { name: c.name, path },
          ]),
        ]}
      />
    </>
  )
}
