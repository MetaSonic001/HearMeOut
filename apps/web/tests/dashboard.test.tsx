import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Dashboard } from "@/components/admin/dashboard"
import type { AdminStats } from "@/lib/api/types"

const stats: AdminStats = {
  range_days: 7,
  totals: {
    visitors: 1234,
    pageviews: 5678,
    docs_created: 321,
    signups: 45,
    minutes_listened: 600,
    revenue: { INR: 29700 },
    users: 50,
    pro_users: 3,
    live_documents: 77,
  },
  daily: [
    { date: "2026-09-30", visitors: 100, pageviews: 300, docs: 20, signups: 3, minutes: 40, revenue: 0 },
    { date: "2026-10-01", visitors: 150, pageviews: 400, docs: 25, signups: 5, minutes: 55, revenue: 9900 },
  ],
  funnel: { visitors: 1234, drafts: 400, docs: 321, plays: 300, signups: 45, purchases: 3 },
  top: {
    pages: [{ label: "/", count: 900 }],
    referrers: [{ label: "google.com", count: 500 }, { label: "Direct", count: 300 }],
    countries: [{ label: "IN", count: 1000 }],
    devices: [{ label: "mobile", count: 800 }],
    modes: [{ label: "study", count: 120 }],
    languages: [{ label: "hi", count: 80 }],
    sources: [{ label: "pdf", count: 200 }],
  },
  generated_at: "2026-10-03T00:00:00Z",
}

describe("admin dashboard", () => {
  it("shows the numbers that matter to the owner", () => {
    render(<Dashboard stats={stats} />)
    const totals = screen.getByRole("region", { name: "Totals" })
    expect(within(totals).getByText("1,234")).toBeDefined()
    expect(within(totals).getByText("5,678 page views")).toBeDefined()
    expect(within(totals).getByText("321")).toBeDefined()
    expect(within(totals).getByText(/₹\s?297/)).toBeDefined()
    expect(within(totals).getByText("3 purchases")).toBeDefined()
    expect(within(totals).getByText("10h 00m")).toBeDefined()
  })

  it("computes conversion rates and funnel steps", () => {
    render(<Dashboard stats={stats} />)
    expect(screen.getByText("24.3%")).toBeDefined() // plays / visitors
    const funnel = screen.getByRole("region", { name: "Funnel" })
    expect(within(funnel).getByText(/Purchased/)).toBeDefined()
    expect(within(funnel).getByText(/3 · 7% of previous/)).toBeDefined()
  })

  it("lists traffic sources and breakdowns", () => {
    render(<Dashboard stats={stats} />)
    const breakdowns = screen.getByRole("region", { name: "Breakdowns" })
    expect(within(breakdowns).getByText("google.com")).toBeDefined()
    expect(within(breakdowns).getByText("study")).toBeDefined()
    expect(within(breakdowns).getByText("mobile")).toBeDefined()
  })

  it("does not break on an empty range", () => {
    const empty: AdminStats = {
      ...stats,
      totals: { ...stats.totals, visitors: 0, pageviews: 0, docs_created: 0, signups: 0, minutes_listened: 0, revenue: {}, users: 0, pro_users: 0, live_documents: 0 },
      daily: [],
      funnel: { visitors: 0, drafts: 0, docs: 0, plays: 0, signups: 0, purchases: 0 },
      top: { pages: [], referrers: [], countries: [], devices: [], modes: [], languages: [], sources: [] },
    }
    render(<Dashboard stats={empty} />)
    expect(screen.getAllByText("No data yet.").length).toBe(7)
    expect(screen.getAllByText("0%").length).toBeGreaterThan(0)
  })
})
