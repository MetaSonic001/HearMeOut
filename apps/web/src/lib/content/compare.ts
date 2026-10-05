import type { FaqItem } from "@/lib/content/core"

export interface ComparePage {
  slug: string
  name: string
  tagline: string
  summary: string
  theirs: string[]
  chooseThemIf: string[]
  chooseUsIf: string[]
  rows: { feature: string; them: string; us: string }[]
  faqs: FaqItem[]
}

export const COMPARE_CHECKED = "October 2026"

const US = {
  price: "Free daily listening; ₹99 per book; Pro ₹149/month or ₹999/year, priced in rupees",
  account: "No sign-up needed for your first listens",
  length: "No 30-minute cap; the daily allowance decides how much audio is prepared each day",
  modes: "Read, Translate, Study version, Quick revision, Explain simply, Quiz me",
  lang: "Hindi, Hinglish, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam, Urdu and 10+ global languages",
  source: "Every section links to its source page",
  feed: "Private podcast feed with Pro",
}

export const COMPARE_PAGES: ComparePage[] = [
  {
    slug: "speechify",
    name: "Speechify",
    tagline: "HearMeOut vs Speechify: a rupee-priced alternative for students",
    summary:
      "Speechify is a well-known text-to-speech reader with a large voice library and apps on many platforms. HearMeOut is a lighter, web-based option built around studying: it offers study, revision and quiz modes, source-page links, Indian languages including Hinglish, and pricing in rupees with a one-time per-book option.",
    theirs: [
      "A polished reader app with mobile, web and browser extension",
      "A large catalogue of voices and languages",
      "Subscription pricing, quoted in US dollars on its website",
    ],
    chooseThemIf: [
      "You want a full reading app with browser extension and device sync",
      "You want celebrity or specialty voices",
    ],
    chooseUsIf: [
      "You want to study from your documents with summaries and quizzes",
      "You think in Hindi, Hinglish or another Indian language",
      "You prefer paying once for one book rather than a monthly subscription",
    ],
    rows: [
      { feature: "Pricing", them: "Subscription, quoted in USD on their website", us: US.price },
      { feature: "Sign-up to try", them: "Account usually required for full features", us: US.account },
      { feature: "Study modes", them: "Listening and AI features vary by plan", us: US.modes },
      { feature: "Indian languages", them: "Check their language list", us: US.lang },
      { feature: "Source page links", them: "Not a focus", us: US.source },
      { feature: "Podcast feed", them: "Not a focus", us: US.feed },
    ],
    faqs: [
      { q: "Is HearMeOut cheaper than Speechify?", a: "HearMeOut is priced in rupees and has a free daily allowance plus a one-time ₹99 per-book option. Compare current prices on both websites, as plans change." },
      { q: "Can HearMeOut replace Speechify?", a: "If your main goal is studying documents by ear, yes. If you need a cross-device reading app with a browser extension, Speechify may suit you better." },
    ],
  },
  {
    slug: "naturalreader",
    name: "NaturalReader",
    tagline: "HearMeOut vs NaturalReader: listen, then revise and get quizzed",
    summary:
      "NaturalReader reads documents, web pages and books aloud and is popular for accessibility. HearMeOut focuses on learning: it can condense, explain and quiz your material, link audio to source pages and explain English content in Hindi or Hinglish.",
    theirs: [
      "Reads documents, pages and ebooks aloud",
      "Desktop, browser and mobile options",
      "Subscription tiers priced in US dollars",
    ],
    chooseThemIf: [
      "You mainly need a dependable read-aloud tool across many apps",
      "You want desktop software for offline reading",
    ],
    chooseUsIf: [
      "You want study versions, quick revision and quizzes of your own notes",
      "You want Indian languages and Hinglish explanations",
      "You want to pay in rupees, including per book",
    ],
    rows: [
      { feature: "Pricing", them: "Subscription tiers, quoted in USD", us: US.price },
      { feature: "Study modes", them: "Check their current AI features", us: US.modes },
      { feature: "Indian languages", them: "Check their language list", us: US.lang },
      { feature: "Source page links", them: "Not a focus", us: US.source },
      { feature: "Document length", them: "Varies by plan", us: US.length },
    ],
    faqs: [
      { q: "Which is better for students?", a: "HearMeOut is designed for studying: summaries, quizzes and Hindi or Hinglish explanations. NaturalReader is a general-purpose reader, so it depends on whether you want to learn from documents or simply hear them." },
    ],
  },
  {
    slug: "elevenreader",
    name: "ElevenReader",
    tagline: "HearMeOut vs ElevenReader: study-focused audio in rupees",
    summary:
      "ElevenReader, from ElevenLabs, turns documents and books into audio with high-quality voices and has a free tier with monthly listening time. HearMeOut is tuned for studying and for Indian users: study and quiz modes, source page links, Hinglish, and rupee pricing with a per-book unlock.",
    theirs: [
      "High-quality voices from a leading voice-AI company",
      "A free tier with a monthly listening allowance and paid plans in USD",
      "Apps for mobile",
    ],
    chooseThemIf: [
      "Voice quality and a mobile reading app matter most",
      "You want a library of published audiobooks as well",
    ],
    chooseUsIf: [
      "You want your own notes turned into summaries and quizzes",
      "You want Indian languages including Hinglish",
      "You want to pay in rupees and buy a single book once",
    ],
    rows: [
      { feature: "Pricing", them: "Free tier plus paid plans quoted in USD", us: US.price },
      { feature: "Daily free listening", them: "Monthly allowance on free tier", us: "About 20 minutes a day as a guest, 60 with a free account" },
      { feature: "Study modes", them: "Check their current features", us: US.modes },
      { feature: "Source page links", them: "Not a focus", us: US.source },
      { feature: "Sign-up to try", them: "Account required", us: US.account },
    ],
    faqs: [
      { q: "Does HearMeOut sound as good as ElevenReader?", a: "HearMeOut uses natural neural voices that are comfortable for long listening. Premium voice-AI products may sound more expressive; listen to our voice previews and decide." },
    ],
  },
  {
    slug: "notebooklm",
    name: "NotebookLM",
    tagline: "HearMeOut vs NotebookLM: faithful audio you can follow in the source",
    summary:
      "Google's NotebookLM turns your sources into conversational audio overviews, which are great for a quick discussion-style summary. HearMeOut complements that: it can read your document faithfully, create a study version, revision or quiz, and link what you hear to the source page, with no daily-cap surprises for long documents.",
    theirs: [
      "Conversational two-host audio overviews of your sources",
      "Free to use with usage limits",
      "Chat, study guides and other features tied to your sources",
    ],
    chooseThemIf: [
      "You want a discussion-style summary and chat across several sources",
      "You already use Google's ecosystem",
    ],
    chooseUsIf: [
      "You want the actual text read to you, not only a summary",
      "You want chapter navigation, source page links and quizzes by voice",
      "You want Indian-language explanations and a private podcast feed",
    ],
    rows: [
      { feature: "Format", them: "Conversational overview by two AI hosts", us: "Faithful reading or a single narrator in study, revision, explain and quiz modes" },
      { feature: "Full-text narration", them: "Not the main purpose", us: "Yes: Read it to me mode" },
      { feature: "Source page links", them: "Citations in chat", us: US.source },
      { feature: "Pricing", them: "Free with usage limits", us: US.price },
      { feature: "Podcast feed", them: "Not a focus", us: US.feed },
    ],
    faqs: [
      { q: "Is it better to use NotebookLM or HearMeOut?", a: "They solve different problems. NotebookLM gives a conversational overview. HearMeOut reads and teaches your actual document and lets you jump to the source. Many people use both." },
    ],
  },
]

export const COMPARE_BY_SLUG = Object.fromEntries(COMPARE_PAGES.map((c) => [c.slug, c]))
