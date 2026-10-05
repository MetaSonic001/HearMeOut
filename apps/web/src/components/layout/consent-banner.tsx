"use client"

import Link from "next/link"
import { useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import { getConsent, setConsent } from "@/lib/analytics"
import { GA_ID, GTM_ID } from "@/lib/config"

function subscribe(callback: () => void) {
  window.addEventListener("hmo-consent", callback)
  return () => window.removeEventListener("hmo-consent", callback)
}

export function ConsentBanner() {
  const consent = useSyncExternalStore(subscribe, getConsent, () => "granted" as const)
  if (!GA_ID && !GTM_ID) return null // nothing to consent to: first-party stats are cookieless
  if (consent !== null) return null
  return (
    <div
      role="dialog"
      aria-label="Analytics preferences"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border bg-popover p-4 text-popover-foreground shadow-lg sm:flex-row sm:items-center"
    >
      <p className="text-sm">
        We use privacy-friendly analytics to improve HearMeOut. Allow Google Analytics too?{" "}
        <Link href="/privacy" className="underline underline-offset-4">
          Learn more
        </Link>
      </p>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={() => setConsent("denied")}>
          No thanks
        </Button>
        <Button size="sm" onClick={() => setConsent("granted")}>
          Allow
        </Button>
      </div>
    </div>
  )
}
