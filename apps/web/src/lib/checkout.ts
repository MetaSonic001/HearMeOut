"use client"

import { useClerk } from "@clerk/nextjs"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { useSession } from "@/components/providers/session-provider"
import { ApiError } from "@/lib/api/client"
import { track } from "@/lib/analytics"

export type Product = "pro_monthly" | "pro_yearly" | "book"

/** Start a Dodo checkout. Guests are asked to create a free account first. */
export function useCheckout() {
  const { api, isSignedIn } = useSession()
  const clerk = useClerk()
  const [busy, setBusy] = useState<Product | null>(null)

  const checkout = useCallback(
    async (product: Product, docId?: string) => {
      if (!isSignedIn) {
        toast.info("Create a free account first, then you can complete your purchase.")
        clerk.openSignUp({ forceRedirectUrl: window.location.href })
        return
      }
      setBusy(product)
      track("cta_click", { action: "checkout", product })
      try {
        const res = await api.request<{ checkout_url: string }>("/v1/billing/checkout", {
          method: "POST",
          json: { product, doc_id: docId, return_path: window.location.pathname },
        })
        window.location.href = res.checkout_url
      } catch (err) {
        setBusy(null)
        toast.error(err instanceof ApiError ? err.message : "We could not start checkout. Please try again.")
      }
    },
    [api, clerk, isSignedIn],
  )

  return { checkout, busy }
}
