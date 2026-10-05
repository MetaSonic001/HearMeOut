import type { Mode } from "@/lib/api/types"

export interface ModeCopy {
  id: Mode
  label: string
  short: string
  description: string
  ai: boolean
  icon: "book" | "languages" | "graduation" | "zap" | "lightbulb" | "help"
}

export const MODES: ModeCopy[] = [
  {
    id: "read",
    label: "Read it to me",
    short: "Every word",
    description: "Every word, cleaned up for listening: page numbers, headers and citations removed.",
    ai: false,
    icon: "book",
  },
  {
    id: "translate",
    label: "Translate and listen",
    short: "In another language",
    description: "Your document translated faithfully into Hindi, Tamil, Spanish or 20+ other languages, then read aloud in the voice you pick.",
    ai: true,
    icon: "languages",
  },
  {
    id: "study",
    label: "Study version",
    short: "About ⅓ of the length",
    description: "All the key ideas, definitions and examples in about a third of the time.",
    ai: true,
    icon: "graduation",
  },
  {
    id: "revision",
    label: "Quick revision",
    short: "The essentials",
    description: "The must-remember points, fast. Perfect the night before an exam or meeting.",
    ai: true,
    icon: "zap",
  },
  {
    id: "explain",
    label: "Explain it simply",
    short: "Like a friendly teacher",
    description: "Plain-language explanations with examples, in English, Hindi, Hinglish and more.",
    ai: true,
    icon: "lightbulb",
  },
  {
    id: "quiz",
    label: "Quiz me",
    short: "Questions, then answers",
    description: "Questions with time to think, then the answer in a second voice. Learn by recalling.",
    ai: true,
    icon: "help",
  },
]

export const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<Mode, ModeCopy>

export const PRICES = {
  book: 99,
  proMonthly: 149,
  proYearly: 999,
  currency: "₹",
} as const

export interface FaqItem {
  q: string
  a: string
}

export const FAQ: FaqItem[] = [
  {
    q: "Is HearMeOut free?",
    a: "Yes. You can listen for free every day: about 20 minutes of newly prepared audio as a guest and about 60 minutes with a free account. When you need more, you can unlock a single document for ₹99 or go Pro for ₹149 a month or ₹999 a year.",
  },
  {
    q: "Do I need to sign up?",
    a: "No. Paste text, upload a file or add a link and press Create to listen straight away. A free account adds a bigger daily allowance, MP3 downloads and a library that keeps your documents for 7 days instead of 24 hours.",
  },
  {
    q: "How long can my document be?",
    a: "There is no 30-minute cap. A guest can listen to documents of up to about 150,000 characters (roughly a 100-page book), a free account up to about 600,000 characters, and Pro up to about 3 million characters. The daily allowance decides how much audio is prepared each day, and you can unlock any single book for ₹99 with no daily limit.",
  },
  {
    q: "Which files and links work?",
    a: "PDF, Word (DOCX), EPUB, plain text, Markdown and HTML files, pasted text, and links to web articles or PDFs. Scanned PDFs that are only pictures of pages work too: we read the text from the images (OCR) in English, Hindi, Marathi, Tamil, Telugu and Kannada, and you can fix any word before listening.",
  },
  {
    q: "Which languages and voices are available?",
    a: "Natural neural voices in English (US, UK, Indian, Australian), Hindi, Hinglish, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam, Urdu and more than ten global languages including Spanish, French, German and Japanese. You can preview every voice before you start.",
  },
  {
    q: "What is the difference between Read, Translate, Study, Revision, Explain and Quiz?",
    a: "Read narrates your document word for word, cleaned for listening. Translate turns it into another language first, then reads it in the voice you choose. Study keeps all the key ideas in about a third of the time. Revision gives the must-remember points. Explain teaches the material in plain language, in the language you choose. Quiz asks questions, gives you time to answer out loud, then reveals the answer.",
  },
  {
    q: "Can I listen in Spotify, Apple Podcasts or another podcast app?",
    a: "Yes, with Pro. Pro gives you a private podcast feed: each chapter of your documents appears as an episode in any podcast app, ready for offline listening. The feed link is private to you.",
  },
  {
    q: "Is my document private?",
    a: "Yes. Your documents are visible only to you. Guest documents are deleted after 24 hours, free-account documents after 7 days and Pro documents after 90 days, and you can delete any document yourself at any time.",
  },
  {
    q: "What does the ₹99 per-book unlock do?",
    a: "It removes the daily listening limit for that one document, whatever its length, and keeps it for 90 days with MP3 download. It is a one-time payment, not a subscription.",
  },
  {
    q: "Can I upload copyrighted books?",
    a: "Use HearMeOut for content you own or have the right to listen to, such as your own notes, textbooks you purchased, open-access papers and articles. Audio is for your private listening and may not be shared or redistributed.",
  },
]
