"use client"

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { AdminStats, TopItem } from "@/lib/api/types"
import { formatDuration, formatMoney, formatNumber } from "@/lib/format"

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function TopList({ title, items }: { title: string; items: TopItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.label} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="truncate">{item.label}</span>
                <span className="tabular-nums text-muted-foreground">{formatNumber(item.count)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(item.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const trafficConfig = {
  visitors: { label: "Visitors", color: "var(--chart-1)" },
  pageviews: { label: "Page views", color: "var(--chart-2)" },
} satisfies ChartConfig

const activityConfig = {
  docs: { label: "Documents created", color: "var(--chart-1)" },
  signups: { label: "Sign-ups", color: "var(--chart-3)" },
} satisfies ChartConfig

const minutesConfig = { minutes: { label: "Minutes of audio", color: "var(--chart-4)" } } satisfies ChartConfig

export function Dashboard({ stats }: { stats: AdminStats }) {
  const { totals, daily, funnel, top } = stats
  const revenue = Object.entries(totals.revenue)
  const funnelSteps: [string, number][] = [
    ["Visitors", funnel.visitors],
    ["Added content", funnel.drafts],
    ["Created audio", funnel.docs],
    ["Pressed play", funnel.plays],
    ["Signed up", funnel.signups],
    ["Purchased", funnel.purchases],
  ]
  const funnelMax = Math.max(1, ...funnelSteps.map(([, n]) => n))

  return (
    <div className="space-y-8">
      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Visitors" value={formatNumber(totals.visitors)} hint={`${formatNumber(totals.pageviews)} page views`} />
        <Tile label="Documents created" value={formatNumber(totals.docs_created)} hint={`${formatNumber(totals.live_documents)} stored now`} />
        <Tile label="Audio prepared" value={formatDuration(totals.minutes_listened * 60)} hint="by guests and members" />
        <Tile label="Sign-ups" value={formatNumber(totals.signups)} hint={`${formatNumber(totals.users)} users, ${formatNumber(totals.pro_users)} Pro`} />
        <Tile
          label="Revenue"
          value={revenue.length ? revenue.map(([cur, amt]) => formatMoney(amt, cur)).join(" + ") : "₹0"}
          hint={`${formatNumber(funnel.purchases)} purchases`}
        />
        <Tile label="Visit to listen" value={funnel.visitors ? `${((funnel.plays / funnel.visitors) * 100).toFixed(1)}%` : "0%"} hint="visitors who pressed play" />
        <Tile label="Listen to sign-up" value={funnel.plays ? `${((funnel.signups / funnel.plays) * 100).toFixed(1)}%` : "0%"} hint="of listeners" />
        <Tile label="Sign-up to purchase" value={funnel.signups ? `${((funnel.purchases / funnel.signups) * 100).toFixed(1)}%` : "0%"} hint="of new members" />
      </section>

      <section aria-label="Traffic" className="rounded-2xl border bg-card p-5">
        <h2 className="mb-4 font-semibold">Traffic</h2>
        <ChartContainer config={trafficConfig} className="h-64 w-full">
          <AreaChart data={daily} margin={{ left: 0, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area dataKey="pageviews" type="monotone" fill="var(--color-pageviews)" fillOpacity={0.15} stroke="var(--color-pageviews)" />
            <Area dataKey="visitors" type="monotone" fill="var(--color-visitors)" fillOpacity={0.25} stroke="var(--color-visitors)" />
          </AreaChart>
        </ChartContainer>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Activity" className="rounded-2xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">Documents and sign-ups</h2>
          <ChartContainer config={activityConfig} className="h-56 w-full">
            <BarChart data={daily}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="docs" fill="var(--color-docs)" radius={3} />
              <Bar dataKey="signups" fill="var(--color-signups)" radius={3} />
            </BarChart>
          </ChartContainer>
        </section>
        <section aria-label="Audio" className="rounded-2xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">Minutes of audio prepared</h2>
          <ChartContainer config={minutesConfig} className="h-56 w-full">
            <BarChart data={daily}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} />} />
              <Bar dataKey="minutes" fill="var(--color-minutes)" radius={3} />
            </BarChart>
          </ChartContainer>
        </section>
      </div>

      <section aria-label="Funnel" className="rounded-2xl border bg-card p-5">
        <h2 className="mb-4 font-semibold">Funnel</h2>
        <ul className="space-y-3">
          {funnelSteps.map(([label, n], i) => (
            <li key={label}>
              <div className="flex justify-between text-sm">
                <span>{label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(n)}
                  {i > 0 && funnelSteps[i - 1][1] > 0 ? ` · ${((n / funnelSteps[i - 1][1]) * 100).toFixed(0)}% of previous` : ""}
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(n / funnelMax) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Breakdowns" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TopList title="Top pages" items={top.pages} />
        <TopList title="Where visitors come from" items={top.referrers} />
        <TopList title="Countries" items={top.countries} />
        <TopList title="Devices" items={top.devices} />
        <TopList title="Modes chosen" items={top.modes} />
        <TopList title="Languages chosen" items={top.languages} />
        <TopList title="Content sources" items={top.sources} />
      </section>
    </div>
  )
}
