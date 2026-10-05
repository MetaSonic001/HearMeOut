import { Breadcrumbs, PageHero } from "@/components/marketing/page-parts"
import { UseCasesGrid } from "@/components/marketing/sections"
import { USE_CASES } from "@/lib/content/use-cases"
import { JsonLd, breadcrumbLd } from "@/lib/seo/json-ld"
import { pageMetadata } from "@/lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Use cases: PDF to audiobook, study notes to audio and more",
  description:
    "See how students, aspirants, researchers and busy professionals use HearMeOut to turn PDFs, notes, ebooks and articles into audio they can learn from.",
  path: "/use-cases",
})

export default function UseCasesPage() {
  return (
    <>
      <PageHero>
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Use cases" }]} />
        <h1 className="text-3xl font-semibold sm:text-5xl">Listen to what you need to learn</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          From UPSC notes to research papers, HearMeOut turns the reading you keep postponing into audio you can finish. Pick the one that sounds like you.
        </p>
      </PageHero>
      <div className="container-page section-y">
        <UseCasesGrid limit={USE_CASES.length} heading={false} />
      </div>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Use cases", path: "/use-cases" },
        ])}
      />
    </>
  )
}
