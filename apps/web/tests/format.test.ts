import { describe, expect, it } from "vitest"

import { formatBytes, formatClock, formatDuration, formatMoney, formatNumber, plural, timeAgo, timeUntil, wordsFromChars } from "@/lib/format"

describe("formatDuration", () => {
  it("handles seconds, minutes and hours", () => {
    expect(formatDuration(0)).toBe("0s")
    expect(formatDuration(45)).toBe("45s")
    expect(formatDuration(60)).toBe("1m")
    expect(formatDuration(754)).toBe("12m")
    expect(formatDuration(3905)).toBe("1h 05m")
    expect(formatDuration(67320)).toBe("18h 42m")
  })
  it("never goes negative", () => expect(formatDuration(-20)).toBe("0s"))
})

describe("formatClock", () => {
  it("renders m:ss and h:mm:ss", () => {
    expect(formatClock(0)).toBe("0:00")
    expect(formatClock(187)).toBe("3:07")
    expect(formatClock(3765)).toBe("1:02:45")
  })
})

describe("numbers and money", () => {
  it("uses Indian digit grouping", () => expect(formatNumber(1234567)).toBe("12,34,567"))
  it("formats paise as rupees", () => expect(formatMoney(9900, "INR")).toMatch(/₹\s?99/))
  it("falls back for unknown currencies", () => expect(formatMoney(500, "???")).toContain("5"))
  it("pluralises", () => {
    expect(plural(1, "page")).toBe("1 page")
    expect(plural(3, "page")).toBe("3 pages")
  })
  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(2048)).toBe("2 KB")
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB")
  })
  it("estimates words from characters", () => expect(wordsFromChars(5700)).toBe(1000))
})

describe("relative time", () => {
  const now = Date.parse("2026-10-03T12:00:00Z")
  it("timeAgo", () => {
    expect(timeAgo("2026-10-03T11:59:40Z", now)).toBe("just now")
    expect(timeAgo("2026-10-03T11:30:00Z", now)).toBe("30 min ago")
    expect(timeAgo("2026-10-03T07:00:00Z", now)).toBe("5 h ago")
    expect(timeAgo("2026-10-01T12:00:00Z", now)).toBe("2 d ago")
  })
  it("timeUntil", () => {
    expect(timeUntil("2026-10-03T12:20:00Z", now)).toBe("20 min")
    expect(timeUntil("2026-10-03T17:00:00Z", now)).toBe("5 hours")
    expect(timeUntil("2026-10-06T12:00:00Z", now)).toBe("3 days")
  })
})
