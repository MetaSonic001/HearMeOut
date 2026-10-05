"use client"

import { FileTextIcon, LinkIcon, Loader2Icon, UploadCloudIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useRef, useState, type DragEvent } from "react"

import { useSession } from "@/components/providers/session-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/api/client"
import type { Draft } from "@/lib/api/types"
import { track } from "@/lib/analytics"
import { formatBytes, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const ACCEPT = ".pdf,.docx,.epub,.txt,.md,.markdown,.html,.htm"
const SAMPLE_TEXT = `How memory works

Memory is the brain's ability to store and recall information. Scientists usually describe three stages: encoding, storage and retrieval.

Encoding is how information first gets into memory. Paying attention matters a great deal, because information you do not notice rarely gets stored.

Storage is how information is kept over time. Short-term memory holds a few items for seconds, while long-term memory can last for years. Sleep helps move new information into long-term memory.

Retrieval is how we bring information back. Testing yourself is one of the most powerful ways to strengthen memory, because the effort of recalling makes the memory stronger. This is why quizzing yourself works better than rereading.`

type Kind = "paste" | "upload" | "link"

/** What a scan is written in. "auto" lets the server try each script and keep the one it reads best. */
const SCAN_LANGUAGES = [
  { value: "auto", label: "Detect automatically" },
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi · हिन्दी" },
  { value: "mr", label: "Marathi · मराठी" },
  { value: "ta", label: "Tamil · தமிழ்" },
  { value: "te", label: "Telugu · తెలుగు" },
  { value: "kn", label: "Kannada · ಕನ್ನಡ" },
]

export function IntakeCard({ className }: { className?: string }) {
  const router = useRouter()
  const { api, me, config } = useSession()
  const [tab, setTab] = useState<Kind>("paste")
  const [text, setText] = useState("")
  const [url, setUrl] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [scanLanguage, setScanLanguage] = useState("auto")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const maxMb = me?.limits.max_file_mb ?? 10
  const maxChars = me?.limits.max_chars ?? 150_000

  const pickFile = useCallback(
    (picked: File | null) => {
      setError(null)
      if (!picked) return setFile(null)
      if (picked.size > maxMb * 1024 * 1024) {
        setFile(null)
        setError(
          `That file is ${formatBytes(picked.size)}. ${me?.kind === "anon" ? "Guests can upload up to" : "Your plan allows up to"} ${maxMb} MB${me?.kind === "anon" ? ". Sign in free for bigger files" : ""}.`,
        )
        return
      }
      setFile(picked)
    },
    [maxMb, me?.kind],
  )

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    pickFile(event.dataTransfer.files?.[0] ?? null)
  }

  async function submit(kind: Kind) {
    setError(null)
    setBusy(true)
    track("upload_started", { kind })
    try {
      let draft: Draft
      if (kind === "paste") {
        draft = await api.request<Draft>("/v1/drafts/text", { method: "POST", json: { text } })
      } else if (kind === "link") {
        draft = await api.request<Draft>("/v1/drafts/url", { method: "POST", json: { url: url.trim() } })
      } else {
        const form = new FormData()
        form.append("file", file as File)
        if (scanLanguage !== "auto" && file?.name.toLowerCase().endsWith(".pdf")) form.append("ocr_language", scanLanguage)
        draft = await api.request<Draft>("/v1/drafts/file", { method: "POST", form })
      }
      router.push(`/new/${draft.id}`)
    } catch (err) {
      setBusy(false)
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.")
    }
  }

  const canSubmit =
    !busy && ((tab === "paste" && text.trim().length > 0) || (tab === "link" && url.trim().length > 4) || (tab === "upload" && file))

  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-sm sm:p-5", className)}>
      <Tabs value={tab} onValueChange={(v) => { setTab(v as Kind); setError(null) }}>
        <TabsList className="grid h-10 w-full grid-cols-3">
          <TabsTrigger value="paste"><FileTextIcon /> Paste text</TabsTrigger>
          <TabsTrigger value="upload"><UploadCloudIcon /> Upload file</TabsTrigger>
          <TabsTrigger value="link"><LinkIcon /> Web link</TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="mt-4 space-y-2">
          <label htmlFor="intake-text" className="sr-only">Text to listen to</label>
          <Textarea
            id="intake-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your notes, an article or a chapter here…"
            className="min-h-44 resize-y text-base"
            disabled={busy}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <button type="button" className="underline underline-offset-4 hover:text-foreground" onClick={() => setText(SAMPLE_TEXT)} disabled={busy}>
              Try a sample
            </button>
            <span className={cn(text.length > maxChars && "text-destructive")}>
              {formatNumber(text.length)} / {formatNumber(maxChars)} characters
            </span>
          </div>
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
              dragging ? "border-primary bg-accent" : "border-input hover:bg-muted/50",
            )}
          >
            {file ? (
              <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
                <FileTextIcon className="size-5 text-primary" />
                <span className="max-w-56 truncate font-medium">{file.name}</span>
                <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                <button type="button" aria-label="Remove file" onClick={() => { pickFile(null); if (inputRef.current) inputRef.current.value = "" }} disabled={busy}>
                  <XIcon className="size-4" />
                </button>
              </div>
            ) : (
              <>
                <UploadCloudIcon className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Drag a file here, or</p>
                <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>Choose a file</Button>
                <p className="text-xs text-muted-foreground">PDF (scans too), Word, EPUB, TXT or HTML · up to {maxMb} MB</p>
              </>
            )}
            <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" aria-label="Upload a document" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          </div>
          {config?.ocr && (!file || file.name.toLowerCase().endsWith(".pdf")) && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
              <label htmlFor="scan-language" className="text-muted-foreground">
                <span className="font-medium text-foreground">Scanned PDF?</span> We will read the text from the images. Language of the scan:
              </label>
              <Select items={SCAN_LANGUAGES} value={scanLanguage} onValueChange={(v) => v && setScanLanguage(v)}>
                <SelectTrigger id="scan-language" className="h-9 w-full sm:w-52" aria-label="Language of the scanned pages">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCAN_LANGUAGES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </TabsContent>

        <TabsContent value="link" className="mt-4 space-y-2">
          <label htmlFor="intake-url" className="sr-only">Web address</label>
          <Input
            id="intake-url"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) void submit("link") }}
            placeholder="https://example.com/a-long-article"
            className="h-11 text-base"
            disabled={busy}
          />
          <p className="text-xs text-muted-foreground">Works with articles and links to PDFs. We read only the main text.</p>
        </TabsContent>
      </Tabs>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button size="lg" className="mt-4 h-11 w-full text-base" disabled={!canSubmit} onClick={() => void submit(tab)}>
        {busy ? (
          <>
            <Loader2Icon className="animate-spin" /> Reading your document…
          </>
        ) : (
          "Continue"
        )}
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">No sign-up needed. Your content stays private.</p>
    </div>
  )
}
