export const NAV_LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/use-cases", label: "Use cases" },
  { href: "/voices", label: "Voices" },
  { href: "/pricing", label: "Pricing" },
] as const

export const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/", label: "Listen now" },
      { href: "/library", label: "My library" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Use cases",
    links: [
      { href: "/use-cases/pdf-to-audiobook", label: "PDF to audiobook" },
      { href: "/use-cases/study-notes-to-audio", label: "Study notes to audio" },
      { href: "/use-cases/upsc-notes-to-audio", label: "UPSC notes as audio" },
      { href: "/use-cases/research-paper-to-audio", label: "Research papers" },
      { href: "/use-cases", label: "All use cases" },
    ],
  },
  {
    title: "Languages",
    links: [
      { href: "/voices/hindi", label: "Hindi text to speech" },
      { href: "/voices/hinglish", label: "Hinglish audio" },
      { href: "/voices/marathi", label: "Marathi" },
      { href: "/voices/tamil", label: "Tamil" },
      { href: "/voices", label: "All voices" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/compare/speechify", label: "HearMeOut vs Speechify" },
      { href: "/compare/notebooklm", label: "HearMeOut vs NotebookLM" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/copyright", label: "Copyright" },
    ],
  },
] as const
