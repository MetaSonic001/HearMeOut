import { describe, expect, it } from "vitest"

import type { Voice } from "@/lib/api/types"
import { createBlocker, scanTimeLeft, suggestedTranslationTarget, type CreateState } from "@/lib/options"
import { accentName, firstVoice, groupVoices, voiceLabel } from "@/lib/voices"

const ready: CreateState = {
  draftLoaded: true,
  selectedCount: 3,
  overLimit: false,
  voice: "en-US-AvaNeural",
  voicesLoading: false,
  voicesFailed: false,
  mode: "read",
  language: "en",
  documentLanguage: "en",
}

describe("createBlocker: a disabled Create button always has a reason", () => {
  it("is null when everything is fine", () => {
    expect(createBlocker(ready)).toBeNull()
  })

  it("explains each way the button can be blocked", () => {
    expect(createBlocker({ ...ready, draftLoaded: false })).toMatch(/Loading your document/)
    expect(createBlocker({ ...ready, selectedCount: 0 })).toMatch(/at least one section/)
    expect(createBlocker({ ...ready, overLimit: true })).toMatch(/longer than your plan/)
    expect(createBlocker({ ...ready, voice: "", voicesLoading: true })).toMatch(/Loading voices/)
    expect(createBlocker({ ...ready, voice: "", voicesFailed: true })).toMatch(/could not be loaded/)
    expect(createBlocker({ ...ready, voice: "" })).toMatch(/Choose a voice/)
  })

  it("never lets a missing language list silently disable the button: it says it is loading", () => {
    // the bug: the voice came only from /v1/config, so a failed config request left Create disabled with no message
    expect(createBlocker({ ...ready, voice: "", voicesLoading: true })).not.toBeNull()
  })

  it("asks for a different language when translating into the document's own language", () => {
    expect(createBlocker({ ...ready, mode: "translate", language: "en" })).toMatch(/different from your document/)
    expect(createBlocker({ ...ready, mode: "translate", language: "hi", voice: "hi-IN-SwaraNeural" })).toBeNull()
  })
})

describe("translation target and scan timing", () => {
  it("suggests Hindi for English documents and English otherwise", () => {
    expect(suggestedTranslationTarget("en")).toBe("hi")
    expect(suggestedTranslationTarget("hi")).toBe("en")
  })

  it("estimates the time left from the pages done so far", () => {
    expect(scanTimeLeft(0, 10, 5)).toBeNull()
    expect(scanTimeLeft(10, 10, 50)).toBeNull()
    expect(scanTimeLeft(9, 10, 18)).toBe("Almost done")
    expect(scanTimeLeft(2, 12, 8)).toBe("About 40 seconds left")
    expect(scanTimeLeft(2, 62, 40)).toBe("About 20 min left")
  })
})

const voice = (id: string, locale: string, gender: string, name: string, featured = false, expressive: Voice["expressive"] = null): Voice => ({
  id,
  locale,
  gender,
  name,
  language: locale.split("-")[0],
  featured,
  expressive,
})

describe("voices", () => {
  const list = [
    voice("en-AU-WilliamNeural", "en-AU", "Male", "William"),
    voice("en-US-AvaNeural", "en-US", "Female", "Ava", true, "calm"),
    voice("en-US-AndrewNeural", "en-US", "Male", "Andrew", true, "high"),
    voice("en-IN-NeerjaNeural", "en-IN", "Female", "Neerja", true),
    voice("en-US-ZaraNeural", "en-US", "Female", "Zara"),
  ]

  it("names accents in plain words", () => {
    expect(accentName("en-GB")).toBe("UK")
    expect(accentName("en-IN")).toBe("India")
    expect(accentName("hi-IN")).toBe("India")
    expect(accentName("es-MX")).toBe("Mexico")
  })

  it("labels a voice with its name, gender and accent", () => {
    expect(voiceLabel(list[1])).toBe("Ava · Female · US · Calm")
    expect(voiceLabel(list[2])).toBe("Andrew · Male · US · Expressive")
    expect(voiceLabel(list[0])).toBe("William · Male · Australia")
  })

  it("groups by accent with recommended voices and bigger groups first", () => {
    const groups = groupVoices(list)
    expect(groups.map((g) => g.label)).toEqual(["US", "India", "Australia"])
    expect(groups[0].voices.map((v) => v.name)).toEqual(["Andrew", "Ava", "Zara"]) // featured first, lively before calm
  })

  it("picks the first recommended voice when there is no default", () => {
    expect(firstVoice(list)).toBe("en-US-AvaNeural")
    expect(firstVoice([voice("x", "en-US", "Male", "X")])).toBe("x")
    expect(firstVoice([])).toBe("")
  })
})
