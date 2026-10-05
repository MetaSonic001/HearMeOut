import type { FaqItem } from "@/lib/content/core"
import type { Mode } from "@/lib/api/types"

export interface UseCase {
  slug: string
  /** Page H1 */
  title: string
  /** <title> tag (kept under ~60 chars) */
  metaTitle: string
  description: string
  keyword: string
  audience: string
  intro: string
  mode: Mode
  steps: { name: string; text: string }[]
  benefits: { title: string; text: string }[]
  faqs: FaqItem[]
  related: string[]
}

const STEPS_UPLOAD = (what: string): UseCase["steps"] => [
  { name: `Add your ${what}`, text: `Drop in your ${what} or paste it. No sign-up is needed for your first listen.` },
  { name: "Choose how to listen", text: "Pick full narration, a study version, quick revision, a plain-language explanation or a quiz, then a voice and language." },
  { name: "Press play", text: "Audio starts within seconds. Skip chapters, change the speed, set a sleep timer and see the source page for anything you hear." },
]

export const USE_CASES: UseCase[] = [
  {
    slug: "pdf-to-audiobook",
    title: "Turn any PDF into an audiobook, free",
    metaTitle: "PDF to Audiobook Converter: Free, No Length Limit",
    description:
      "Convert PDFs of any length into natural-sounding audio. Headers, page numbers and citations are removed, chapters are detected, and you can listen straight away without signing up.",
    keyword: "pdf to audiobook",
    audience: "Anyone with a long PDF they would rather listen to",
    intro:
      "HearMeOut converts a PDF into audio you can start listening to in seconds. It reads the real text of the document, removes running headers, page numbers, footnote markers and reference lists, detects chapters from the bookmarks or headings, and narrates it with natural voices. Documents are not capped at 30 minutes, and you do not need an account to try it.",
    mode: "read",
    steps: STEPS_UPLOAD("PDF"),
    benefits: [
      { title: "Cleaned for listening", text: "Page furniture, citations and reference lists are removed so the audio flows like a book, not a scanner." },
      { title: "Chapters and page links", text: "Jump between chapters and see which page of the PDF you are hearing." },
      { title: "Starts instantly", text: "Audio is prepared in small pieces just ahead of you, so a 500-page book starts as fast as a single page." },
      { title: "Fair pricing in rupees", text: "Listen free every day, unlock a whole book for ₹99, or go Pro for ₹149 a month." },
    ],
    faqs: [
      { q: "Is there a page or length limit for PDFs?", a: "Guests can convert PDFs up to about 150,000 characters and free accounts up to about 600,000 characters. Pro handles roughly 3 million characters. There is no 30-minute listening cap." },
      { q: "Does it work with scanned PDFs?", a: "Yes. If your PDF is just pictures of pages, HearMeOut reads the text from the images (OCR) in English, Hindi, Marathi, Tamil, Telugu and Kannada before you listen. Clear, straight scans work best, and you can edit any word that was misread." },
      { q: "Can I download the audio?", a: "Yes. With a free account you can download an MP3 of any document you have listened to, and Pro adds a private podcast feed." },
    ],
    related: ["text-to-audiobook", "ebook-to-audiobook", "research-paper-to-audio"],
  },
  {
    slug: "text-to-audiobook",
    title: "Text to audiobook with no 30-minute limit",
    metaTitle: "Text to Audiobook Converter, No 30-Minute Limit",
    description:
      "Paste any amount of text and hear it as an audiobook with natural voices in English, Hindi and more. Free every day, no sign-up needed to start.",
    keyword: "text to audiobook",
    audience: "People who hit length limits on other text-to-speech tools",
    intro:
      "Most text-to-audio tools stop after a few minutes and ask for a subscription. HearMeOut lets you paste or upload long text and listen straight away, with a generous free daily allowance, natural voices and chapters. When you need more, you can unlock a single book for ₹99 instead of paying for a monthly plan.",
    mode: "read",
    steps: STEPS_UPLOAD("text"),
    benefits: [
      { title: "No tiny limit", text: "Paste a whole chapter or a whole book. Audio is prepared as you listen." },
      { title: "Pay only when you need more", text: "A single book unlock is a one-time ₹99, with no subscription." },
      { title: "Natural voices", text: "Choose from multiple neural voices per language and preview each one first." },
      { title: "Works on your phone", text: "Lock-screen controls, sleep timer and speed control from 0.75x to 2.5x." },
    ],
    faqs: [
      { q: "How much text can I paste?", a: "Guests can paste about 150,000 characters at once; a free account about 600,000." },
      { q: "Which voices do you use?", a: "Neural voices with several choices per language. You can preview any voice before creating audio." },
    ],
    related: ["pdf-to-audiobook", "article-to-podcast", "docx-to-audio"],
  },
  {
    slug: "study-notes-to-audio",
    title: "Turn study notes into audio you can revise on the go",
    metaTitle: "Study Notes to Audio: Listen, Revise and Get Quizzed",
    description:
      "Upload notes or a textbook chapter and get a study version, quick revision or quiz you can listen to anywhere. Built for students.",
    keyword: "study notes to audio",
    audience: "Students revising for exams",
    intro:
      "Reading the same notes again and again is slow. HearMeOut turns your notes or textbook chapters into audio and lets you choose how deep to go: the full text, a study version with all the key ideas in about a third of the time, a quick revision of the essentials, or a quiz that asks you questions and gives you time to answer before revealing the answer.",
    mode: "study",
    steps: STEPS_UPLOAD("notes"),
    benefits: [
      { title: "Shorter, not shallower", text: "Study mode keeps definitions, formulas explained in words and examples while cutting repetition." },
      { title: "Active recall by ear", text: "Quiz mode pauses so you can answer out loud, then plays the answer in a second voice." },
      { title: "Check the source", text: "Every section shows the page it came from so you can look up the details." },
      { title: "Study in your language", text: "Ask for explanations in Hindi, Hinglish, Marathi, Tamil and more." },
    ],
    faqs: [
      { q: "Will the study version miss important points?", a: "Study mode is designed to keep every key concept, definition and example while removing repetition. For exact wording, use Read mode and jump to the page shown for any section." },
      { q: "Can I get quizzed on my own notes?", a: "Yes. Choose Quiz me and each chapter becomes a short set of questions with thinking time and spoken answers." },
    ],
    related: ["lecture-notes-to-podcast", "upsc-notes-to-audio", "english-to-hindi-explained"],
  },
  {
    slug: "upsc-notes-to-audio",
    title: "UPSC notes as audio: revise while you commute",
    metaTitle: "UPSC Notes to Audio: Revise Polity, History & More",
    description:
      "Turn your UPSC notes, NCERT chapters and current-affairs PDFs into audio with study, revision and quiz modes. Listen on the way, in English or Hindi.",
    keyword: "upsc notes audio",
    audience: "UPSC and State PSC aspirants",
    intro:
      "UPSC preparation means huge volumes of reading. With HearMeOut you can turn your own notes, NCERT chapters, editorials and current-affairs PDFs into audio and use the hours you spend travelling, walking or cooking. Use revision mode the week before the exam, quiz mode to test recall, and Hindi or Hinglish explanations for tricky topics.",
    mode: "revision",
    steps: STEPS_UPLOAD("notes or NCERT chapter"),
    benefits: [
      { title: "Use dead time", text: "Commutes and chores become revision time without carrying a screen." },
      { title: "Hindi and Hinglish", text: "Hear difficult English material explained in the language you think in." },
      { title: "Fast revision passes", text: "Quick revision mode turns a long chapter into the essentials." },
      { title: "Affordable", text: "Free daily listening, ₹99 per book or ₹999 for a year of Pro." },
    ],
    faqs: [
      { q: "Can it read Hindi PDFs?", a: "Yes, as long as the PDF contains selectable Hindi text. HearMeOut detects the language and picks a Hindi voice automatically." },
      { q: "Is this affiliated with UPSC or any coaching institute?", a: "No. HearMeOut is an independent tool that turns your own study material into audio." },
    ],
    related: ["study-notes-to-audio", "neet-jee-notes-to-audio", "english-to-hindi-explained"],
  },
  {
    slug: "neet-jee-notes-to-audio",
    title: "NEET and JEE theory as audio for faster revision",
    metaTitle: "NEET & JEE Notes to Audio for Revision",
    description:
      "Convert Physics, Chemistry and Biology theory notes into audio for revision, with quick-revision and quiz modes in English or Hinglish.",
    keyword: "neet notes audio",
    audience: "NEET and JEE aspirants",
    intro:
      "Theory chapters in Chemistry and Biology are perfect for listening: definitions, reactions, exceptions and classifications. Upload your notes, pick quick revision or quiz mode and revise during breaks, travel or before sleep. Explanations in Hinglish help when the textbook language is heavy.",
    mode: "quiz",
    steps: STEPS_UPLOAD("theory notes"),
    benefits: [
      { title: "Great for theory subjects", text: "Chemistry exceptions and Biology classifications stick better when you hear and recall them." },
      { title: "Quiz yourself", text: "Spoken questions with thinking time, then the answer." },
      { title: "Hinglish explanations", text: "Complex ideas explained in everyday language." },
      { title: "Short sessions", text: "Chapter-by-chapter audio fits into ten-minute breaks." },
    ],
    faqs: [
      { q: "Does it handle formulas and equations?", a: "Plain-text content is read well. Heavy equations and diagrams are better studied on paper, so use audio for the theory and recall parts." },
    ],
    related: ["upsc-notes-to-audio", "study-notes-to-audio", "lecture-notes-to-podcast"],
  },
  {
    slug: "research-paper-to-audio",
    title: "Listen to research papers as audio",
    metaTitle: "Research Paper to Audio: Listen to arXiv & PDFs",
    description:
      "Turn academic papers into audio with citations and reference lists removed. Get a study version or plain-language explanation of dense research.",
    keyword: "research paper to audio",
    audience: "Researchers, grad students and engineers",
    intro:
      "Keeping up with papers is hard. HearMeOut turns an arXiv or journal PDF into audio, removing in-text citation markers, author emails and the reference list so it sounds natural. Use study mode for the key ideas, or explain mode for a plain-language walk-through of a paper outside your specialty.",
    mode: "explain",
    steps: STEPS_UPLOAD("paper"),
    benefits: [
      { title: "Citations stripped", text: "Numeric and author-year citations are removed so sentences flow." },
      { title: "Plain-language explanations", text: "Understand a paper outside your field without wading through jargon." },
      { title: "Section by section", text: "Jump straight to the method or results using the chapter list." },
      { title: "Page links", text: "See the page a passage came from to check the original." },
    ],
    faqs: [
      { q: "How does it handle two-column layouts?", a: "Text is read in the reading order stored in the PDF, which works for most journal and arXiv formats. Tables and figures are skipped." },
    ],
    related: ["pdf-to-audiobook", "study-notes-to-audio", "article-to-podcast"],
  },
  {
    slug: "ebook-to-audiobook",
    title: "EPUB to audiobook converter",
    metaTitle: "EPUB to Audiobook Converter, Free to Try",
    description:
      "Turn EPUB ebooks into audiobooks with chapters detected from the book itself. Natural voices, speed control and sleep timer.",
    keyword: "epub to audiobook",
    audience: "Readers who own ebooks and want audio",
    intro:
      "Upload an EPUB you own and HearMeOut reads the chapters in order with natural voices, using the book's own structure for the chapter list. Listen free every day, or unlock the whole book for a one-time ₹99 with no daily limit.",
    mode: "read",
    steps: STEPS_UPLOAD("EPUB"),
    benefits: [
      { title: "Real chapters", text: "Chapter titles come from the EPUB so navigation matches the book." },
      { title: "One-time unlock", text: "₹99 per book instead of a monthly subscription." },
      { title: "Offline-friendly", text: "Download MP3 with a free account or use your private podcast feed with Pro." },
      { title: "For books you own", text: "Use it for ebooks you have the right to listen to." },
    ],
    faqs: [
      { q: "Does it work with DRM-protected ebooks?", a: "No. HearMeOut cannot open DRM-protected files and does not remove DRM." },
    ],
    related: ["pdf-to-audiobook", "text-to-audiobook", "article-to-podcast"],
  },
  {
    slug: "docx-to-audio",
    title: "Turn Word documents into audio",
    metaTitle: "Word (DOCX) to Audio: Listen to Documents",
    description:
      "Upload a DOCX report, assignment or manual and listen to it. Headings become chapters and lists are read naturally.",
    keyword: "docx to audio",
    audience: "Professionals with long reports and manuals",
    intro:
      "Reports, SOPs, manuals and assignments pile up. Upload a Word document and HearMeOut uses your headings as chapters, reads lists naturally and gives you a study version or quick revision of the key points for long documents.",
    mode: "study",
    steps: STEPS_UPLOAD("Word document"),
    benefits: [
      { title: "Headings become chapters", text: "Navigation follows the structure you wrote." },
      { title: "Summaries on demand", text: "Get the key points of a long report in a fraction of the time." },
      { title: "Private", text: "Documents are visible only to you and deleted on a schedule you can see." },
      { title: "Multilingual", text: "Listen in the document's language or ask for explanations in another." },
    ],
    faqs: [
      { q: "What happens to tables?", a: "Tables are skipped because they do not read well aloud; you are told how many were skipped." },
    ],
    related: ["text-to-audiobook", "article-to-podcast", "pdf-to-audiobook"],
  },
  {
    slug: "article-to-podcast",
    title: "Turn any web article into a private podcast",
    metaTitle: "Article to Podcast: Listen to Any Web Page",
    description:
      "Paste a link and listen to the article. Navigation, ads and comments are stripped; Pro adds a private podcast feed for your phone.",
    keyword: "article to podcast",
    audience: "Busy readers with a long reading list",
    intro:
      "Paste the link to an article or a PDF on the web and HearMeOut extracts the main text, leaving out menus, ads and comments, then reads it to you. With Pro, your documents also appear in a private podcast feed so you can add them to the podcast app you already use.",
    mode: "read",
    steps: [
      { name: "Paste a link", text: "Add the web address of an article or PDF." },
      { name: "Choose how to listen", text: "Full text or a short study version." },
      { name: "Listen anywhere", text: "Play in the browser, or follow your private podcast feed with Pro." },
    ],
    benefits: [
      { title: "Main text only", text: "Navigation, ads and comments are left out." },
      { title: "Private feed (Pro)", text: "Episodes appear in Apple Podcasts, Spotify and other apps." },
      { title: "Short version", text: "Get the gist in a few minutes with study or revision mode." },
      { title: "Respectful fetching", text: "Pages that block automated readers cannot be opened; paste the text instead." },
    ],
    faqs: [
      { q: "Why can't it open some links?", a: "Some sites block automated access or require a login. Copy the article text and paste it instead." },
    ],
    related: ["text-to-audiobook", "research-paper-to-audio", "pdf-to-audiobook"],
  },
  {
    slug: "lecture-notes-to-podcast",
    title: "Turn lecture notes and slides into a revision podcast",
    metaTitle: "Lecture Notes to Podcast: Audio Revision for Students",
    description:
      "Convert lecture PDFs and notes into audio, summarised or quizzed, and revise before exams. Chapters and page links included.",
    keyword: "lecture notes to audio",
    audience: "University and college students",
    intro:
      "Lecture PDFs are rarely fun to reread. HearMeOut turns them into audio you can use for revision walks, gym sessions or bus rides. Choose a study version to compress a long lecture, or quiz mode to test what you remember.",
    mode: "study",
    steps: STEPS_UPLOAD("lecture PDF"),
    benefits: [
      { title: "Compress long lectures", text: "Study version keeps the key ideas in about a third of the time." },
      { title: "Test yourself", text: "Quiz mode asks questions with time to answer." },
      { title: "Chapter navigation", text: "Move between lectures or sections quickly." },
      { title: "Student pricing", text: "Free daily listening and ₹999 for a year of Pro." },
    ],
    faqs: [
      { q: "Do slides work?", a: "Slide decks exported as PDF work when they contain real text. Image-only slides cannot be read." },
    ],
    related: ["study-notes-to-audio", "neet-jee-notes-to-audio", "research-paper-to-audio"],
  },
  {
    slug: "dyslexia-friendly-listening",
    title: "Listen instead of read: audio for dyslexia and tired eyes",
    metaTitle: "Listen Instead of Read: Audio for Dyslexia & Eye Strain",
    description:
      "Turn any text into clear audio with adjustable speed and a transcript that highlights what you are hearing. Helpful for dyslexia, ADHD and eye strain.",
    keyword: "text to speech for dyslexia",
    audience: "People who find reading tiring or difficult",
    intro:
      "Listening can make long documents easier to take in. HearMeOut reads text aloud with natural voices, lets you set the speed, and shows a large, clear transcript that follows along so you can listen and read together. No sign-up is needed to start.",
    mode: "read",
    steps: STEPS_UPLOAD("text"),
    benefits: [
      { title: "Follow-along transcript", text: "Large text with the current sentence highlighted." },
      { title: "Speed you control", text: "From 0.75x to 2.5x, remembered between visits." },
      { title: "Simple, calm design", text: "One clear action per screen and keyboard shortcuts." },
      { title: "Explain it simply", text: "Get a plain-language version of dense material." },
    ],
    faqs: [
      { q: "Is HearMeOut an assistive-technology product?", a: "It is a general listening tool that many people with reading difficulties find helpful. It is not a medical device and does not replace professional advice." },
    ],
    related: ["text-to-audiobook", "pdf-to-audiobook", "english-to-hindi-explained"],
  },
  {
    slug: "english-to-hindi-explained",
    title: "Understand English study material in Hindi or Hinglish audio",
    metaTitle: "English to Hindi & Hinglish Audio Explanations",
    description:
      "Upload English notes or textbooks and listen to plain-language explanations in Hindi, Hinglish, Marathi, Tamil and more.",
    keyword: "english to hindi audio explanation",
    audience: "Students who think in Hindi or another Indian language",
    intro:
      "Technical English can be a barrier to understanding. With Explain mode, HearMeOut re-teaches your English material in the language you choose, such as Hindi, Hinglish, Marathi or Tamil, keeping technical terms in English where that is natural. It is meant to help you understand, not just translate word for word.",
    mode: "explain",
    steps: STEPS_UPLOAD("English notes or textbook"),
    benefits: [
      { title: "Hinglish that sounds natural", text: "The way friends explain things, with technical terms kept in English." },
      { title: "More than translation", text: "Concepts are explained with simple analogies." },
      { title: "11 Indian languages", text: "Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam, Urdu and Hinglish." },
      { title: "Check the original", text: "Source page links let you see the English text." },
    ],
    faqs: [
      { q: "Is the explanation always accurate?", a: "Explanations are generated by AI from your document and stay close to the source, but you should check the original for anything critical, which is why page links are shown." },
      { q: "Does this need an account?", a: "Smart listening modes work for guests once a day and for free accounts three times a day." },
    ],
    related: ["study-notes-to-audio", "upsc-notes-to-audio", "neet-jee-notes-to-audio"],
  },
]

export const USE_CASE_BY_SLUG = Object.fromEntries(USE_CASES.map((u) => [u.slug, u]))
