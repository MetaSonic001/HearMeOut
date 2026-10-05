"use client"

import { AlertTriangleIcon, ScanTextIcon } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { Draft } from "@/lib/api/types"
import { scanTimeLeft } from "@/lib/options"

const STAGE_TEXT: Record<string, string> = {
  queued: "Waiting for another scan to finish…",
  detecting: "Checking which language the pages are written in…",
  reading: "Reading the pages…",
  building: "Putting the text together…",
}

/** Shown while a scanned PDF is being read. The page polls the draft and moves on by itself when it is ready. */
export function ScanProgress({ draft }: { draft: Draft }) {
  const ocr = draft.ocr
  const total = ocr?.total ?? 0
  const done = ocr?.done ?? 0
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  const left = ocr && ocr.stage === "reading" ? scanTimeLeft(done, total, ocr.seconds ?? 0) : null

  return (
    <div className="container-page max-w-xl py-16">
      <div className="rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <ScanTextIcon className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold">Reading your scanned pages</h1>
        <p className="mt-1 text-muted-foreground">
          {draft.title} · {total} {total === 1 ? "page" : "pages"} to read
        </p>

        <div className="mt-6 space-y-2" role="status" aria-live="polite">
          <Progress value={ocr?.stage === "queued" || ocr?.stage === "detecting" ? null : percent} aria-label="Scan reading progress" />
          <p className="text-sm font-medium">
            {ocr?.stage === "reading" ? `Page ${Math.min(done + 1, total)} of ${total}` : STAGE_TEXT[ocr?.stage ?? "queued"]}
          </p>
          <p className="min-h-5 text-xs text-muted-foreground">{left ?? (ocr?.stage === "reading" ? `${percent}% done` : "")}</p>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Keep this page open. When it is ready you can pick your mode and voice, and fix any word that was misread.
        </p>
      </div>
    </div>
  )
}

export function ScanFailed({ message }: { message: string | null }) {
  return (
    <div className="container-page max-w-xl py-16">
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangleIcon className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold">We could not read this scan</h1>
        <p className="mt-2 text-muted-foreground">{message ?? "Something went wrong while reading the pages."}</p>
        <p className="mt-2 text-sm text-muted-foreground">A sharper, straight scan helps. You can also paste the text instead.</p>
        <Link href="/" className={buttonVariants({ size: "lg", className: "mt-6" })}>
          Start again
        </Link>
      </div>
    </div>
  )
}
