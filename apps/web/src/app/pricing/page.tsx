import { FaqSection } from "@/components/marketing/faq-section"
import { Breadcrumbs, PageHero } from "@/components/marketing/page-parts"
import { PricingClient } from "@/components/marketing/pricing-client"
import { Section } from "@/components/marketing/section"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FAQ } from "@/lib/content/core"
import { JsonLd, breadcrumbLd, faqLd } from "@/lib/seo/json-ld"
import { pageMetadata } from "@/lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Pricing in rupees: free daily listening, ₹99 per book, Pro ₹149/month",
  description:
    "Listen free every day. Unlock one book for a one-time ₹99 with no daily limit, or go Pro for ₹149 a month or ₹999 a year. No 30-minute wall, no hidden fees.",
  path: "/pricing",
})

const ROWS: [string, string, string, string, string][] = [
  ["Daily new audio", "~20 min", "~60 min", "No limit on that book", "Unlimited (fair use)"],
  ["Smart listens per day (study, revision, explain, quiz)", "1", "3", "Unlimited on that book", "60"],
  ["Largest document", "~150,000 characters", "~600,000 characters", "~3 million characters", "~3 million characters"],
  ["Largest file", "10 MB", "25 MB", "50 MB", "50 MB"],
  ["MP3 download", "No", "Yes", "Yes", "Yes"],
  ["Private podcast feed", "No", "No", "No", "Yes"],
  ["Documents kept for", "24 hours", "7 days", "90 days", "90 days"],
]

export default function PricingPage() {
  return (
    <>
      <PageHero>
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Pricing" }]} />
        <h1 className="text-3xl font-semibold sm:text-5xl">Free to start. Fair when you need more.</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">Priced in rupees, with no 30-minute wall and no surprise subscription. Pay once for a book, or go Pro.</p>
      </PageHero>
      <div className="container-page section-y">
        <PricingClient />
      </div>

      <Section id="compare" title="Compare plans" className="bg-muted/40 pt-0 sm:pt-0">
        <div className="mx-auto max-w-5xl overflow-x-auto rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">Feature</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Free account</TableHead>
                <TableHead>Per book (₹99)</TableHead>
                <TableHead>Pro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map(([feature, ...cells]) => (
                <TableRow key={feature}>
                  <TableCell className="font-medium">{feature}</TableCell>
                  {cells.map((c, i) => (
                    <TableCell key={i}>{c}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Payments are handled securely by Dodo Payments. Prices include applicable taxes where required. Cancel Pro any time from your account.
        </p>
      </Section>

      <FaqSection items={FAQ} title="Pricing questions" />
      <JsonLd
        data={[
          faqLd(FAQ),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
        ]}
      />
    </>
  )
}
