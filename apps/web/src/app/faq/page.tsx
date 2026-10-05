import { FaqList } from "@/components/marketing/faq-section"
import { Breadcrumbs, PageHero } from "@/components/marketing/page-parts"
import { Section } from "@/components/marketing/section"
import { FAQ } from "@/lib/content/core"
import { JsonLd, breadcrumbLd, faqLd } from "@/lib/seo/json-ld"
import { pageMetadata } from "@/lib/seo/metadata"

export const metadata = pageMetadata({
  title: "FAQ: free limits, file types, languages, privacy and pricing",
  description:
    "Answers about HearMeOut: how much you can listen for free, which files and languages work, how privacy works, and what the ₹99 per-book unlock and Pro plan include.",
  path: "/faq",
})

export default function FaqPage() {
  return (
    <>
      <PageHero>
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "FAQ" }]} />
        <h1 className="text-3xl font-semibold sm:text-5xl">Frequently asked questions</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">Quick answers about using HearMeOut.</p>
      </PageHero>
      <Section id="faq" title="Everything you might want to know">
        <FaqList items={FAQ} />
      </Section>
      <JsonLd
        data={[
          faqLd(FAQ),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "FAQ", path: "/faq" },
          ]),
        ]}
      />
    </>
  )
}
