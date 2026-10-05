import type { Voice } from "@/lib/api/types"

const ACCENTS: Record<string, string> = { US: "US", GB: "UK", IN: "India", AU: "Australia", CA: "Canada", IE: "Ireland", ZA: "South Africa" }

/** "en-IN" -> "India". Falls back to the region name, then to the raw code. */
export function accentName(locale: string): string {
  const region = locale.split("-")[1] ?? locale
  if (ACCENTS[region]) return ACCENTS[region]
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(region) ?? region
  } catch {
    return region
  }
}

const EXPRESSIVE_RANK = { high: 2, medium: 1, calm: 0 } as const

/** "Emma · Female · US · Expressive". Only the two ends are named: "Expressive" (lively) and "Calm" (even, steady). */
export function voiceLabel(voice: Voice): string {
  const tag = voice.expressive === "high" ? " · Expressive" : voice.expressive === "calm" ? " · Calm" : ""
  return `${voice.name} · ${voice.gender === "Female" ? "Female" : "Male"} · ${accentName(voice.locale)}${tag}`
}

export interface VoiceGroup {
  locale: string
  label: string
  voices: Voice[]
}

/** Voices grouped by accent. Within a group the recommended voices come first; groups with recommended voices come first. */
export function groupVoices(voices: Voice[]): VoiceGroup[] {
  const byLocale = new Map<string, Voice[]>()
  for (const voice of voices) byLocale.set(voice.locale, [...(byLocale.get(voice.locale) ?? []), voice])
  const groups = [...byLocale.entries()].map(([locale, list]) => ({
    locale,
    label: accentName(locale),
    voices: [...list].sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        (b.expressive ? EXPRESSIVE_RANK[b.expressive] : -1) - (a.expressive ? EXPRESSIVE_RANK[a.expressive] : -1) ||
        a.name.localeCompare(b.name),
    ),
  }))
  return groups.sort((a, b) => {
    const featured = Number(b.voices.some((v) => v.featured)) - Number(a.voices.some((v) => v.featured))
    return featured || b.voices.length - a.voices.length || a.label.localeCompare(b.label)
  })
}

/** The voice to start with when the language list has no default: the first recommended one. */
export function firstVoice(voices: Voice[]): string {
  return voices.find((v) => v.featured)?.id ?? voices[0]?.id ?? ""
}
