import { SITE, absoluteUrl } from "@/lib/config"

type Json = Record<string, unknown>

export function JsonLd({ data }: { data: Json | Json[] }) {
  // "<" is escaped so structured data can never close the script tag
  const json = JSON.stringify(data).replace(/</g, "\\u003c")
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}

export const organizationLd = (): Json => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": absoluteUrl("/#organization"),
  name: SITE.name,
  url: SITE.url,
  logo: absoluteUrl("/icon.svg"),
})

export const websiteLd = (): Json => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": absoluteUrl("/#website"),
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  inLanguage: ["en", "hi"],
  publisher: { "@id": absoluteUrl("/#organization") },
})

export const softwareLd = (): Json => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": absoluteUrl("/#app"),
  name: SITE.name,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Any (web browser)",
  url: SITE.url,
  description: SITE.description,
  featureList: [
    "Convert PDF, DOCX, EPUB, TXT and web pages to audio",
    "Study version, quick revision, plain-language explanation and quiz modes",
    "Hindi, Hinglish and 20+ languages with natural voices",
    "Source page links, chapters and sleep timer",
    "Private podcast feed and MP3 download",
  ],
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "INR" },
    { "@type": "Offer", name: "Per book unlock", price: "99", priceCurrency: "INR" },
    { "@type": "Offer", name: "Pro monthly", price: "149", priceCurrency: "INR" },
    { "@type": "Offer", name: "Pro yearly", price: "999", priceCurrency: "INR" },
  ],
})

export const faqLd = (items: { q: string; a: string }[]): Json => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
})

export const breadcrumbLd = (items: { name: string; path: string }[]): Json => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: item.name,
    item: absoluteUrl(item.path),
  })),
})

export const howToLd = (name: string, steps: { name: string; text: string }[]): Json => ({
  "@context": "https://schema.org",
  "@type": "HowTo",
  name,
  step: steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text })),
})

export const webPageLd = (name: string, description: string, path: string): Json => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name,
  description,
  url: absoluteUrl(path),
  isPartOf: { "@id": absoluteUrl("/#website") },
})
