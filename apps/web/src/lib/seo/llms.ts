import { FAQ, MODES, PRICES } from "@/lib/content/core"
import { COMPARE_PAGES } from "@/lib/content/compare"
import { LANGUAGE_PAGES } from "@/lib/content/languages"
import { USE_CASES } from "@/lib/content/use-cases"
import { SITE, absoluteUrl } from "@/lib/config"

/** /llms.txt: a short, link-rich summary for AI assistants (llmstxt.org convention). */
export function buildLlmsTxt(): string {
  const lines = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.name} turns PDFs, Word files, EPUBs, web articles and pasted text into natural-sounding audio. Listeners can hear every word, or choose a study version, quick revision, plain-language explanation or a spoken quiz, in English, Hindi, Hinglish and 20+ languages. Free to start with no sign-up; priced in Indian rupees.`,
    "",
    "## Key facts",
    `- Free daily listening: about 20 minutes as a guest, about 60 minutes with a free account; no 30-minute cap on document length.`,
    `- Per-book unlock: ₹${PRICES.book} one-time per document, any length, no daily limit on that document.`,
    `- Pro: ₹${PRICES.proMonthly} per month or ₹${PRICES.proYearly} per year, with every mode and a private podcast feed.`,
    "- Supported inputs: PDF, DOCX, EPUB, TXT, Markdown, HTML, pasted text and web links.",
    "- Source page links, chapters, speed control, sleep timer, MP3 download and podcast feed.",
    "",
    "## Main pages",
    `- [Home](${absoluteUrl("/")}): upload or paste content and start listening`,
    `- [How it works](${absoluteUrl("/how-it-works")}): cleaning, chapters, instant start, smart modes`,
    `- [Pricing](${absoluteUrl("/pricing")}): free, per book, Pro and Institutes`,
    `- [FAQ](${absoluteUrl("/faq")}): limits, file types, languages, privacy`,
    "",
    "## Use cases",
    ...USE_CASES.map((u) => `- [${u.title}](${absoluteUrl(`/use-cases/${u.slug}`)}): ${u.description}`),
    "",
    "## Languages and voices",
    ...LANGUAGE_PAGES.map((l) => `- [${l.label}](${absoluteUrl(`/voices/${l.slug}`)}): ${l.voices.length} voice${l.voices.length === 1 ? "" : "s"}`),
    "",
    "## Comparisons",
    ...COMPARE_PAGES.map((c) => `- [HearMeOut vs ${c.name}](${absoluteUrl(`/compare/${c.slug}`)})`),
    "",
    "## Optional",
    `- [Full content for AI](${absoluteUrl("/llms-full.txt")})`,
    `- [Sitemap](${absoluteUrl("/sitemap.xml")})`,
    "",
  ]
  return lines.join("\n")
}

/** /llms-full.txt: the substance of the public site in one document. */
export function buildLlmsFull(): string {
  const parts: string[] = [
    `# ${SITE.name}: full reference`,
    "",
    `${SITE.name} is a web app at ${SITE.url} that converts documents into audio for listening and learning.`,
    "",
    "## Listening modes",
    ...MODES.map((m) => `- **${m.label}**: ${m.description}`),
    "",
    "## Pricing (Indian rupees)",
    `- Guest: free, about 20 minutes of new audio per day, one smart listen per day, files up to 10 MB, documents kept 24 hours.`,
    `- Free account: about 60 minutes per day, three smart listens per day, MP3 download, files up to 25 MB, documents kept 7 days.`,
    `- Per book: ₹${PRICES.book} once, one document of any length (up to about 3 million characters), no daily limit on it, kept 90 days.`,
    `- Pro: ₹${PRICES.proMonthly}/month or ₹${PRICES.proYearly}/year, unlimited listening (fair use), every mode, private podcast feed, files up to 50 MB.`,
    "- Institutes: custom pricing for coaching centres, colleges and publishers.",
    "",
    "## Frequently asked questions",
    ...FAQ.flatMap((f) => [`### ${f.q}`, f.a, ""]),
    "## Use cases",
    ...USE_CASES.flatMap((u) => [`### ${u.title}`, u.intro, ...u.benefits.map((b) => `- ${b.title}: ${b.text}`), ""]),
    "## Languages",
    ...LANGUAGE_PAGES.map((l) => `- ${l.label} (${l.native}): ${l.angle}`),
    "",
  ]
  return parts.join("\n")
}
