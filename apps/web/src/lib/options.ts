import type { Mode } from "@/lib/api/types"

export interface CreateState {
  draftLoaded: boolean
  selectedCount: number
  overLimit: boolean
  voice: string
  voicesLoading: boolean
  voicesFailed: boolean
  mode: Mode
  language: string
  documentLanguage: string
}

/**
 * Why the Create button cannot be pressed right now, in words a listener understands, or null when it can.
 * Every disabled state must have a reason shown next to the button: a silent disabled button is a bug.
 */
export function createBlocker(s: CreateState): string | null {
  if (!s.draftLoaded) return "Loading your document…"
  if (s.selectedCount === 0) return "Tick at least one section below to continue."
  if (s.overLimit) return "This selection is longer than your plan allows. Untick some sections."
  if (s.mode === "translate" && s.language === s.documentLanguage) return "Choose a language different from your document's to translate into."
  if (s.voicesFailed) return "The voices could not be loaded. Press “Try again” in the voice section."
  if (!s.voice) return s.voicesLoading ? "Loading voices…" : "Choose a voice to continue."
  return null
}

/** A sensible language to translate into: Hindi for English documents, English for everything else. */
export function suggestedTranslationTarget(documentLanguage: string): string {
  return documentLanguage === "en" ? "hi" : "en"
}

/** "About 2 min left" from how long the pages done so far took. */
export function scanTimeLeft(done: number, total: number, elapsedSeconds: number): string | null {
  if (done < 1 || total <= done) return null
  const left = Math.round(((total - done) * elapsedSeconds) / done)
  if (left < 10) return "Almost done"
  if (left < 90) return `About ${Math.round(left / 5) * 5} seconds left`
  return `About ${Math.round(left / 60)} min left`
}
