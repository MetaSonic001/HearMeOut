"use client"

import { Show, SignInButton, SignUpButton } from "@clerk/nextjs"
import { CheckIcon, CopyIcon, Loader2Icon, RssIcon } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { useSession } from "@/components/providers/session-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ApiError } from "@/lib/api/client"
import { useCheckout } from "@/lib/checkout"
import { PRICES } from "@/lib/content/core"
import { timeUntil } from "@/lib/format"

export function AccountClient() {
  const { api, me, config, refreshMe } = useSession()
  const { checkout, busy } = useCheckout()
  const params = useSearchParams()
  const [copied, setCopied] = useState(false)
  const [portalBusy, setPortalBusy] = useState(false)

  // after returning from checkout, plan changes arrive via webhook: refresh a few times
  useEffect(() => {
    if (params.get("checkout") !== "success") return
    toast.success("Thank you! We are confirming your payment…")
    let tries = 0
    const id = window.setInterval(async () => {
      tries++
      const fresh = await refreshMe()
      if (fresh?.plan === "pro" || tries >= 8) window.clearInterval(id)
    }, 3000)
    return () => window.clearInterval(id)
  }, [params, refreshMe])

  async function copyFeed() {
    if (!me?.feed_url) return
    await navigator.clipboard.writeText(me.feed_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function openPortal() {
    setPortalBusy(true)
    try {
      const res = await api.request<{ url: string }>("/v1/billing/portal", { method: "POST" })
      window.location.href = res.url
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not open billing.")
      setPortalBusy(false)
    }
  }

  const allowance = me?.allowance
  const billing = config?.billing ?? false

  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="text-3xl font-semibold">Account</h1>

      <Show when="signed-out">
        <div className="mt-6 rounded-2xl border bg-card p-6 text-center">
          <p className="text-lg font-medium">Sign in to see your plan and settings</p>
          <p className="mt-1 text-muted-foreground">A free account gives you 60 minutes of listening a day and keeps your library for 7 days.</p>
          <div className="mt-4 flex justify-center gap-2">
            <SignInButton mode="modal">
              <Button variant="outline">Sign in</Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button>Sign up free</Button>
            </SignUpButton>
          </div>
        </div>
      </Show>

      <Show when="signed-in">
        {!me ? (
          <div className="mt-10 flex justify-center">
            <Loader2Icon className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="rounded-2xl border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Your plan</p>
                  <p className="text-2xl font-semibold">{me.is_admin ? "Owner (unlimited)" : me.plan_label}</p>
                  {me.email && <p className="text-sm text-muted-foreground">{me.email}</p>}
                  {me.plan === "pro" && me.plan_ends_at && <p className="text-sm text-muted-foreground">Current period ends in {timeUntil(me.plan_ends_at)}</p>}
                </div>
                {me.plan === "pro" && billing && !me.is_admin && (
                  <Button variant="outline" onClick={() => void openPortal()} disabled={portalBusy}>
                    {portalBusy && <Loader2Icon className="animate-spin" />} Manage subscription
                  </Button>
                )}
              </div>

              {allowance && allowance.limit_minutes !== null && (
                <div className="mt-5 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Today&apos;s listening</span>
                    <span className="font-medium">
                      {Math.round(allowance.used_minutes)} of {allowance.limit_minutes} min
                    </span>
                  </div>
                  <Progress value={Math.min(100, (allowance.used_minutes / allowance.limit_minutes) * 100)} aria-label="Daily listening used" />
                  <p className="text-xs text-muted-foreground">
                    Resets in {timeUntil(allowance.resets_at)}. Smart listens today: {allowance.ai_docs_used}
                    {allowance.ai_docs_limit !== null ? ` of ${allowance.ai_docs_limit}` : ""}.
                  </p>
                </div>
              )}
            </section>

            {me.plan === "free" && (
              <section className="rounded-2xl border border-primary/40 bg-accent/40 p-6">
                <h2 className="text-lg font-semibold">Go Pro</h2>
                <p className="mt-1 text-muted-foreground">Unlimited listening, every mode, and a private podcast feed in your favourite app.</p>
                {billing ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button disabled={busy !== null} onClick={() => void checkout("pro_monthly")}>
                      {busy === "pro_monthly" && <Loader2Icon className="animate-spin" />} ₹{PRICES.proMonthly} / month
                    </Button>
                    <Button variant="outline" disabled={busy !== null} onClick={() => void checkout("pro_yearly")}>
                      {busy === "pro_yearly" && <Loader2Icon className="animate-spin" />} ₹{PRICES.proYearly} / year
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Payments are being switched on. Please check back soon.</p>
                )}
              </section>
            )}

            <section className="rounded-2xl border bg-card p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <RssIcon className="size-5 text-primary" aria-hidden="true" /> Private podcast feed
              </h2>
              {me.feed_url ? (
                <div className="mt-3 space-y-3">
                  <div className="flex gap-2">
                    <Input readOnly value={me.feed_url} aria-label="Podcast feed link" className="h-10 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                    <Button variant="outline" className="h-10" onClick={() => void copyFeed()}>
                      {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <Alert>
                    <AlertTitle>How to use it</AlertTitle>
                    <AlertDescription>
                      In Apple Podcasts choose File → Follow a Show by URL. In Pocket Casts, Overcast and most other apps, search for &ldquo;Add by URL&rdquo;. Keep this link private; anyone with it can listen to your feed.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <p className="mt-2 text-muted-foreground">
                  Pro members get each chapter of their documents as an episode in Apple Podcasts, Spotify-compatible apps and more. <Link href="/pricing" className="underline underline-offset-4">See Pro</Link>.
                </p>
              )}
            </section>

            <p className="text-sm text-muted-foreground">
              Need to change your email or password, or delete your account? Use the profile menu in the top-right corner.{" "}
              <Link href="/privacy" className="underline underline-offset-4">Privacy</Link> ·{" "}
              <Link href="/library" className={buttonVariants({ variant: "link", className: "h-auto p-0" })}>My library</Link>
            </p>
          </div>
        )}
      </Show>
    </div>
  )
}
