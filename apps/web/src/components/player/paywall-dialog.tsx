"use client"

import { SignUpButton } from "@clerk/nextjs"
import { BookMarkedIcon, CalendarClockIcon, Loader2Icon, SparklesIcon, UserPlusIcon } from "lucide-react"
import Link from "next/link"

import { useSession } from "@/components/providers/session-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Doc } from "@/lib/api/types"
import { useCheckout } from "@/lib/checkout"
import { PRICES } from "@/lib/content/core"
import { timeUntil } from "@/lib/format"
import type { QuotaBlock } from "@/lib/player/use-player"

interface PaywallDialogProps {
  block: QuotaBlock | null
  doc: Doc
  onClose: () => void
}

export function PaywallDialog({ block, doc, onClose }: PaywallDialogProps) {
  const { config, isSignedIn, me } = useSession()
  const { checkout, busy } = useCheckout()
  const billing = config?.billing ?? false
  const options = block?.options ?? []
  const freeMinutes = config?.plans.free?.daily_minutes ?? 60

  return (
    <Dialog open={block !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>You&apos;ve reached today&apos;s free listening</DialogTitle>
          <DialogDescription>
            {block?.message} Your place is saved. Pick what suits you, or continue{" "}
            {block?.resetsAt ? `in ${timeUntil(block.resetsAt)}` : "tomorrow"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {options.includes("signup") && !isSignedIn && (
            <div className="flex items-start gap-3 rounded-xl border p-4">
              <UserPlusIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-medium">Create a free account</p>
                <p className="text-sm text-muted-foreground">{freeMinutes} minutes a day, MP3 downloads, and your library kept for 7 days.</p>
                <SignUpButton mode="modal" forceRedirectUrl={typeof window === "undefined" ? undefined : window.location.href}>
                  <Button size="sm" className="mt-3">Sign up free</Button>
                </SignUpButton>
              </div>
            </div>
          )}

          {options.includes("book") && !doc.unlocked && (
            <div className="flex items-start gap-3 rounded-xl border p-4">
              <BookMarkedIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-medium">Unlock this book · ₹{PRICES.book}</p>
                <p className="text-sm text-muted-foreground">One-time payment. No daily limit on this document, any length, kept for 90 days.</p>
                {billing ? (
                  <Button size="sm" className="mt-3" disabled={busy !== null} onClick={() => void checkout("book", doc.id)}>
                    {busy === "book" && <Loader2Icon className="animate-spin" />} Unlock for ₹{PRICES.book}
                  </Button>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Payments are being switched on. Please check back soon.</p>
                )}
              </div>
            </div>
          )}

          {options.includes("pro") && me?.plan !== "pro" && (
            <div className="flex items-start gap-3 rounded-xl border border-primary/40 bg-accent/40 p-4">
              <SparklesIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-medium">Go Pro · ₹{PRICES.proMonthly}/month</p>
                <p className="text-sm text-muted-foreground">Unlimited listening, every mode, private podcast feed. Or ₹{PRICES.proYearly} for a year.</p>
                <Link href="/pricing" className={buttonVariants({ size: "sm", className: "mt-3" })}>
                  See Pro
                </Link>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            <CalendarClockIcon /> I&apos;ll continue later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
