"use client"

import { CheckIcon, Loader2Icon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { useSession } from "@/components/providers/session-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { useCheckout } from "@/lib/checkout"
import { PRICES } from "@/lib/content/core"
import { SITE } from "@/lib/config"
import { cn } from "@/lib/utils"

interface Tier {
  id: "free" | "book" | "pro" | "institutes"
  name: string
  blurb: string
  points: string[]
  featured?: boolean
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    blurb: "Everything you need to try it, every day.",
    points: [
      "About 20 min of new audio a day as a guest",
      "About 60 min a day with a free account",
      "All five listening modes (1 smart listen a day as a guest, 3 with an account)",
      "MP3 download with an account",
      "Library kept 24 hours (guest) or 7 days (account)",
    ],
  },
  {
    id: "book",
    name: "Per book",
    blurb: "One long document, no daily limit, pay once.",
    points: [
      "Any length, up to 3 million characters",
      "No daily limit on that document",
      "All modes, MP3 download",
      "Kept for 90 days",
      "One-time payment, no subscription",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "For students and professionals who listen every day.",
    featured: true,
    points: [
      "Unlimited daily listening (fair use)",
      "Unlimited standard voices in every language",
      "Study, revision, explain and quiz modes",
      "Private podcast feed for Apple Podcasts and more",
      "Files up to 50 MB, documents kept 90 days",
    ],
  },
  {
    id: "institutes",
    name: "Institutes",
    blurb: "For coaching centres, colleges and publishers.",
    points: ["Bulk conversion of course material", "Branded private feeds for your students", "Invoicing and priority support"],
  },
]

export function PricingClient() {
  const { config } = useSession()
  const { checkout, busy } = useCheckout()
  const [yearly, setYearly] = useState(true)
  const billing = config?.billing ?? false

  return (
    <div>
      <div className="mb-8 flex justify-center">
        <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-full border bg-card p-1 text-sm">
          {[
            { v: false, label: "Monthly" },
            { v: true, label: "Yearly · save 44%" },
          ].map((o) => (
            <button
              key={String(o.v)}
              role="radio"
              aria-checked={yearly === o.v}
              onClick={() => setYearly(o.v)}
              className={cn("rounded-full px-4 py-1.5 font-medium transition-colors", yearly === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((tier) => {
          const price =
            tier.id === "free" ? "₹0" : tier.id === "book" ? `₹${PRICES.book}` : tier.id === "pro" ? `₹${yearly ? PRICES.proYearly : PRICES.proMonthly}` : "Custom"
          const note =
            tier.id === "free" ? "forever" : tier.id === "book" ? "one-time, per document" : tier.id === "pro" ? (yearly ? "per year (about ₹83/month)" : "per month") : "talk to us"
          return (
            <div key={tier.id} className={cn("flex flex-col rounded-2xl border bg-card p-6", tier.featured && "border-primary ring-1 ring-primary")}>
              {tier.featured && <p className="mb-2 w-fit rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">Most popular</p>}
              <h2 className="text-lg font-semibold">{tier.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{tier.blurb}</p>
              <p className="mt-4 text-4xl font-semibold">{price}</p>
              <p className="text-sm text-muted-foreground">{note}</p>
              <ul className="my-5 flex-1 space-y-2 text-sm">
                {tier.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    {p}
                  </li>
                ))}
              </ul>
              {tier.id === "free" && (
                <Link href="/#top" className={buttonVariants({ variant: "outline", size: "lg" })}>
                  Start listening
                </Link>
              )}
              {tier.id === "book" && (
                <Link href="/library" className={buttonVariants({ variant: "outline", size: "lg" })}>
                  Choose a document
                </Link>
              )}
              {tier.id === "pro" &&
                (billing ? (
                  <Button size="lg" disabled={busy !== null} onClick={() => void checkout(yearly ? "pro_yearly" : "pro_monthly")}>
                    {busy?.startsWith("pro") && <Loader2Icon className="animate-spin" />} Go Pro
                  </Button>
                ) : (
                  <Button size="lg" disabled>
                    Payments opening soon
                  </Button>
                ))}
              {tier.id === "institutes" && (
                <a href={`mailto:${SITE.email}?subject=HearMeOut%20for%20Institutes`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                  Contact us
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
