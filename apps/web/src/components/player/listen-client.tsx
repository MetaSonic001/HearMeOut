"use client"

import { DownloadIcon, Loader2Icon, PlayIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { ChaptersSheet } from "@/components/player/chapters-sheet"
import { PaywallDialog } from "@/components/player/paywall-dialog"
import { PlayerBar } from "@/components/player/player-bar"
import { SourceDialog } from "@/components/player/source-dialog"
import { Transcript } from "@/components/player/transcript"
import { useSession } from "@/components/providers/session-provider"
import { useCheckout } from "@/lib/checkout"
import { PRICES } from "@/lib/content/core"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api/client"
import type { Chunk, Doc } from "@/lib/api/types"
import { track } from "@/lib/analytics"
import { API_URL } from "@/lib/config"
import { MODE_BY_ID } from "@/lib/content/core"
import { formatDuration } from "@/lib/format"
import { usePlayer } from "@/lib/player/use-player"
import { KEYS, writeStorage } from "@/lib/storage"

const PAGE = 500

export function ListenClient({ docId }: { docId: string }) {
  const { api, ready } = useSession()
  const [doc, setDoc] = useState<Doc | null>(null)
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [missing, setMissing] = useState(false)
  const chunksLengthRef = useRef(0)
  chunksLengthRef.current = chunks.length

  const loadChunks = useCallback(
    async (from: number) => {
      let start = from
      const collected: Chunk[] = []
      for (;;) {
        const res = await api.request<{ chunks: Chunk[] }>(`/v1/docs/${docId}/chunks?start=${start}&limit=${PAGE}`)
        collected.push(...res.chunks)
        if (res.chunks.length < PAGE) break
        start += PAGE
      }
      return collected
    },
    [api, docId],
  )

  // initial load
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    void (async () => {
      try {
        const d = await api.request<Doc>(`/v1/docs/${docId}`)
        const list = await loadChunks(0)
        if (cancelled) return
        setDoc(d)
        setChunks(list)
        writeStorage(KEYS.lastDoc, docId)
      } catch {
        if (!cancelled) setMissing(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [api, docId, loadChunks, ready])

  // while smart modes are still preparing chapters, keep the list fresh
  useEffect(() => {
    if (!doc || doc.status !== "processing") return
    const id = window.setInterval(async () => {
      try {
        const fresh = await api.request<Doc>(`/v1/docs/${docId}`)
        const more = await loadChunks(chunksLengthRef.current)
        setDoc(fresh)
        if (more.length) setChunks((prev) => [...prev, ...more])
      } catch {
        /* keep trying quietly */
      }
    }, 2000)
    return () => window.clearInterval(id)
  }, [api, doc, docId, loadChunks])

  if (missing) {
    return (
      <div className="container-page max-w-xl py-20 text-center">
        <h1 className="text-2xl font-semibold">We couldn&apos;t find that audio</h1>
        <p className="mt-2 text-muted-foreground">It may have expired (guest audio is kept for 24 hours) or belong to another browser.</p>
        <Link href="/" className={buttonVariants({ size: "lg", className: "mt-6" })}>
          Create new audio
        </Link>
      </div>
    )
  }
  if (!doc) {
    return (
      <div className="container-page max-w-3xl space-y-4 py-10">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }
  return <Listen key={doc.id} doc={doc} chunks={chunks} setDoc={setDoc} />
}

function Listen({ doc, chunks, setDoc }: { doc: Doc; chunks: Chunk[]; setDoc: (d: Doc) => void }) {
  const router = useRouter()
  const { api, me, config } = useSession()
  const { checkout, busy: checkoutBusy } = useCheckout()
  const [startedOnce, setStartedOnce] = useState(false)
  const [dismissedBlock, setDismissedBlock] = useState<unknown>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [download, setDownload] = useState<{ state: "idle" | "preparing" | "stalled"; percent: number }>({ state: "idle", percent: 0 })

  const player = usePlayer({
    api,
    doc,
    chunks,
    onProgress: (chunk, offset) => {
      void api.request(`/v1/docs/${doc.id}/progress`, { method: "POST", json: { chunk, offset } }).catch(() => undefined)
    },
    onFirstPlay: () => {
      setStartedOnce(true)
      track("play_started", { mode: doc.mode })
    },
  })

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (!t || e.metaKey || e.ctrlKey || e.altKey) return
      if (t.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [role='menu']")) return
      if (t.tagName === "BUTTON" && e.key === " ") return
      switch (e.key) {
        case " ":
          e.preventDefault()
          player.toggle()
          break
        case "ArrowLeft":
          player.seekBy(-15)
          break
        case "ArrowRight":
          player.seekBy(15)
          break
        case "ArrowUp":
        case "ArrowDown": {
          e.preventDefault()
          const speeds = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5]
          const at = Math.max(0, speeds.indexOf(player.speed))
          player.setSpeed(speeds[Math.min(speeds.length - 1, Math.max(0, at + (e.key === "ArrowUp" ? 1 : -1)))])
          break
        }
        case "n":
        case "N":
          player.jumpChapter(1)
          break
        case "p":
        case "P":
          player.jumpChapter(-1)
          break
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [player])

  async function remove() {
    try {
      await api.request(`/v1/docs/${doc.id}`, { method: "DELETE" })
      router.push("/library")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete this document.")
    }
  }

  async function startDownload() {
    try {
      setDownload({ state: "preparing", percent: 0 })
      await api.request(`/v1/docs/${doc.id}/render`, { method: "POST" })
      let lastReady = -1
      let lastChange = Date.now()
      for (;;) {
        await new Promise((r) => setTimeout(r, 2500))
        const fresh = await api.request<Doc>(`/v1/docs/${doc.id}`)
        setDoc(fresh)
        const total = fresh.total_chunks ?? 0
        const readyCount = fresh.ready_chunks ?? 0
        setDownload({ state: "preparing", percent: total ? Math.round((readyCount / total) * 100) : 0 })
        if (fresh.status === "ready" && total > 0 && readyCount >= total) break
        if (readyCount !== lastReady) {
          lastReady = readyCount
          lastChange = Date.now()
        } else if (Date.now() - lastChange > 60000) {
          setDownload({ state: "stalled", percent: Math.round((readyCount / Math.max(total, 1)) * 100) })
          toast.info("Your daily limit stopped the download part-way. It will finish when your allowance resets.")
          return
        }
      }
      const { url } = await api.request<{ url: string }>(`/v1/docs/${doc.id}/download-link`)
      setDownload({ state: "idle", percent: 0 })
      const link = document.createElement("a")
      link.href = new URL(url, API_URL).toString()
      link.click()
    } catch (err) {
      setDownload({ state: "idle", percent: 0 })
      toast.error(err instanceof ApiError ? err.message : "Could not prepare the download.")
    }
  }

  const sections = doc.sections ?? []
  const currentChunk = chunks[player.index]
  const currentSection = sections.find((s) => s.idx === currentChunk?.section)
  const mode = MODE_BY_ID[doc.mode]
  const preparing = doc.status === "processing"
  const noAudioYet = chunks.length === 0

  if (doc.status === "failed") {
    return (
      <div className="container-page max-w-xl py-16">
        <Alert variant="destructive">
          <AlertTitle>We couldn&apos;t prepare this document</AlertTitle>
          <AlertDescription>{doc.error ?? "Something went wrong."} Please try again.</AlertDescription>
        </Alert>
        <Link href="/" className={buttonVariants({ className: "mt-4" })}>
          Try again
        </Link>
      </div>
    )
  }

  return (
    <div className="pb-44">
      <div className="container-page max-w-3xl py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold sm:text-3xl">{doc.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{mode.label}</Badge>
              <span>{formatDuration(doc.est_seconds)}</span>
              {doc.page_count ? <span>· {doc.page_count} pages</span> : null}
              {doc.unlocked && <Badge>Unlocked</Badge>}
              {preparing && (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2Icon className="size-3.5 animate-spin" /> Preparing chapter {Math.min(doc.scripted_sections + 1, doc.total_sections)} of {doc.total_sections}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            {config?.billing && !doc.unlocked && me && !me.is_admin && me.plan !== "pro" && (
              <Button size="sm" onClick={() => void checkout("book", doc.id)} disabled={checkoutBusy !== null}>
                Unlock for ₹{PRICES.book}
              </Button>
            )}
            {(doc.can_download ?? false) && (
              <Button variant="outline" size="sm" onClick={() => void startDownload()} disabled={download.state === "preparing" || preparing}>
                {download.state === "preparing" ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
                {download.state === "preparing" ? `Preparing ${download.percent}%` : "Download MP3"}
              </Button>
            )}
            <Button variant="ghost" size="icon" aria-label="Delete this document" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon />
            </Button>
          </div>
        </div>

        {!startedOnce && player.status !== "playing" && !noAudioYet && player.status !== "blocked" && (
          <div className="mb-8 flex flex-col items-center gap-3 rounded-2xl border bg-accent/40 p-8 text-center">
            <p className="text-lg font-medium">{doc.progress.chunk > 0 ? "Welcome back. Pick up where you left off." : "Your audio is ready."}</p>
            <Button size="lg" className="h-12 px-8 text-base" onClick={() => void player.play()}>
              <PlayIcon /> {doc.progress.chunk > 0 ? "Resume listening" : "Start listening"}
            </Button>
          </div>
        )}

        {noAudioYet ? (
          <div className="space-y-3 rounded-2xl border p-8 text-center text-muted-foreground">
            <Loader2Icon className="mx-auto size-6 animate-spin" />
            <p>Preparing your first chapter. This usually takes a few seconds.</p>
          </div>
        ) : (
          <Transcript
            chunks={chunks}
            sections={sections}
            index={player.index}
            time={player.time}
            duration={player.duration}
            playing={player.status === "playing"}
            onSeek={(idx) => void player.seekToChunk(idx)}
          />
        )}

        {player.message && (
          <Alert variant="destructive" className="mx-auto mt-6 max-w-3xl">
            <AlertTitle>Playback problem</AlertTitle>
            <AlertDescription>
              {player.message}{" "}
              <button className="underline" onClick={() => void player.play()}>
                Try again
              </button>
            </AlertDescription>
          </Alert>
        )}
        <p className="mx-auto mt-10 max-w-3xl text-center text-xs text-muted-foreground">
          Shortcuts: Space play/pause · ← → skip 15 seconds · ↑ ↓ speed · N / P next / previous chapter
        </p>
      </div>

      <PlayerBar
        title={doc.title}
        chapter={currentSection?.title}
        status={player.status}
        waiting={player.waiting}
        elapsed={player.elapsed}
        total={player.total}
        speed={player.speed}
        sleepTimer={player.sleepTimer}
        currentSection={player.currentSection}
        onToggle={player.toggle}
        onSeekBy={player.seekBy}
        onSeekFraction={player.seekToFraction}
        onChapter={player.jumpChapter}
        onSpeed={player.setSpeed}
        onSleep={player.setSleepTimer}
        extras={
          <>
            <SourceDialog chunk={currentChunk} section={currentSection} aiMode={doc.ai} />
            <ChaptersSheet sections={sections} currentSection={player.currentSection} onJump={(i) => void player.seekToChunk(i)} />
          </>
        }
      />

      <PaywallDialog block={player.blocked === dismissedBlock ? null : player.blocked} doc={doc} onClose={() => setDismissedBlock(player.blocked)} />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>The audio and text are removed from our servers. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={() => void remove()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

