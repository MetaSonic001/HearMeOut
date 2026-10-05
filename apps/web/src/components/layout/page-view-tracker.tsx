"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { useSession } from "@/components/providers/session-provider"
import { track } from "@/lib/analytics"

/** Counts page views (cookieless, first-party). The owner's own visits are not counted. */
export function PageViewTracker() {
  const pathname = usePathname()
  const { me, ready } = useSession()
  const isAdmin = Boolean(me?.is_admin)

  useEffect(() => {
    if (!ready || isAdmin || pathname.startsWith("/admin")) return
    track("page_view", {}, pathname)
  }, [pathname, ready, isAdmin])

  return null
}
