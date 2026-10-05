"use client"

import { SignUpButton } from "@clerk/nextjs"
import { HeadphonesIcon, PlusIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { useSession } from "@/components/providers/session-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api/client"
import type { Doc } from "@/lib/api/types"
import { MODE_BY_ID } from "@/lib/content/core"
import { formatDuration, timeAgo, timeUntil } from "@/lib/format"

export function LibraryClient() {
  const { api, ready, me, isSignedIn } = useSession()
  const [docs, setDocs] = useState<Doc[] | null>(null)
  const [toDelete, setToDelete] = useState<Doc | null>(null)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    api
      .request<{ documents: Doc[] }>("/v1/docs")
      .then((res) => !cancelled && setDocs(res.documents))
      .catch(() => !cancelled && setDocs([]))
    return () => {
      cancelled = true
    }
  }, [api, ready])

  async function remove(doc: Doc) {
    try {
      await api.request(`/v1/docs/${doc.id}`, { method: "DELETE" })
      setDocs((prev) => prev?.filter((d) => d.id !== doc.id) ?? null)
      toast.success("Deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete.")
    } finally {
      setToDelete(null)
    }
  }

  return (
    <div className="container-page py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">My library</h1>
          <p className="text-muted-foreground">Everything you have prepared to listen to.</p>
        </div>
        <Link href="/" className={buttonVariants()}>
          <PlusIcon /> New audio
        </Link>
      </div>

      {me?.kind === "anon" && !isSignedIn && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border bg-accent/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Guest audio is kept for 24 hours on this browser. Create a free account to keep your library for 7 days, on every device.
          </p>
          <SignUpButton mode="modal">
            <Button size="sm">Sign up free</Button>
          </SignUpButton>
        </div>
      )}

      {docs === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <HeadphonesIcon className="mx-auto mb-3 size-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Nothing here yet</h2>
          <p className="mt-1 text-muted-foreground">Paste text, drop a PDF or add a link to hear it in seconds.</p>
          <Link href="/" className={buttonVariants({ className: "mt-5" })}>
            Create your first audio
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => {
            const total = doc.total_chunks ?? 0
            const percent = total ? Math.min(100, Math.round((doc.progress.chunk / total) * 100)) : 0
            return (
              <li key={doc.id} className="flex flex-col rounded-2xl border bg-card p-5">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{MODE_BY_ID[doc.mode].label}</Badge>
                  {doc.unlocked && <Badge>Unlocked</Badge>}
                  {doc.status === "processing" && <Badge variant="outline">Preparing…</Badge>}
                  {doc.status === "failed" && <Badge variant="destructive">Failed</Badge>}
                </div>
                <h2 className="line-clamp-2 font-semibold">{doc.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDuration(doc.est_seconds)} · {timeAgo(doc.created_at)} · expires in {timeUntil(doc.expires_at)}
                </p>
                {percent > 0 && (
                  <div className="mt-3 space-y-1">
                    <Progress value={percent} aria-label="Listening progress" />
                    <p className="text-xs text-muted-foreground">{percent}% listened</p>
                  </div>
                )}
                <div className="mt-auto flex items-center gap-2 pt-4">
                  <Link href={`/listen/${doc.id}`} className={buttonVariants({ size: "sm", className: "flex-1" })}>
                    {percent > 0 ? "Resume" : "Listen"}
                  </Link>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${doc.title}`} onClick={() => setToDelete(doc)}>
                    <Trash2Icon />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{toDelete?.title}&rdquo;?</DialogTitle>
            <DialogDescription>The audio and text are removed from our servers. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={() => toDelete && void remove(toDelete)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
