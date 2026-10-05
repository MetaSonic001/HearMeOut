import { auth } from "@clerk/nextjs/server"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Dashboard } from "@/components/admin/dashboard"
import { buttonVariants } from "@/components/ui/button"
import type { AdminStats } from "@/lib/api/types"
import { API_INTERNAL_URL } from "@/lib/config"
import { NOINDEX } from "@/lib/seo/metadata"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Admin", ...NOINDEX }
export const dynamic = "force-dynamic"

const RANGES = [7, 30, 90]

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const { userId, getToken, redirectToSignIn } = await auth()
  if (!userId) return redirectToSignIn({ returnBackUrl: "/admin" })

  const raw = (await searchParams).days
  const parsed = Number(Array.isArray(raw) ? raw[0] : raw)
  const days = RANGES.includes(parsed) ? parsed : 30

  const token = await getToken()
  let stats: AdminStats | null = null
  let failure: string | null = null
  let status = 0
  try {
    const res = await fetch(`${API_INTERNAL_URL}/v1/admin/stats?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    })
    status = res.status
    if (res.ok) stats = (await res.json()) as AdminStats
    else failure = `The API answered with an error (${res.status}).`
  } catch {
    failure = "The API did not respond. If it is waking up on free hosting, wait a moment and refresh."
  }
  if (status === 401 || status === 403) notFound() // not the owner: reveal nothing

  return (
    <div className="container-page py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Admin dashboard</h1>
          <p className="text-muted-foreground">How many people use HearMeOut, and what they do. Your own visits are not counted.</p>
        </div>
        <div className="inline-flex rounded-full border bg-card p-1 text-sm" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin?days=${r}`}
              className={cn("rounded-full px-4 py-1.5 font-medium", r === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {r} days
            </Link>
          ))}
        </div>
      </div>
      {stats ? (
        <Dashboard stats={stats} />
      ) : (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
          {failure}
          <Link href={`/admin?days=${days}`} className={buttonVariants({ variant: "outline", size: "sm", className: "ml-3" })}>
            Retry
          </Link>
        </div>
      )}
    </div>
  )
}
