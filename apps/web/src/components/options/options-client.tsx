"use client"

import { SignUpButton } from "@clerk/nextjs"
import { AlertTriangleIcon, ArrowRightIcon, InfoIcon, Loader2Icon, RotateCwIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { ModePicker } from "@/components/options/mode-picker"
import { ScanFailed, ScanProgress } from "@/components/options/scan-progress"
import { SectionList } from "@/components/options/section-list"
import { useVoices, VoicePicker } from "@/components/options/voice-picker"
import { useSession } from "@/components/providers/session-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api/client"
import type { Doc, Draft, Mode } from "@/lib/api/types"
import { track } from "@/lib/analytics"
import { MODE_BY_ID } from "@/lib/content/core"
import { debug, warn } from "@/lib/debug"
import { formatDuration, formatNumber, timeUntil, wordsFromChars } from "@/lib/format"
import { createBlocker, suggestedTranslationTarget } from "@/lib/options"
import { firstVoice } from "@/lib/voices"

const AI_MODES: Mode[] = ["translate", "study", "revision", "explain", "quiz"]
const POLL_MS = 1500

export function OptionsClient({ draftId }: { draftId: string }) {
  const router = useRouter()
  const { api, me, config, configError, reloadConfig, ready } = useSession()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [missing, setMissing] = useState(false)
  const [mode, setMode] = useState<Mode>("read")
  const [language, setLanguage] = useState("en")
  const [voiceChoice, setVoiceChoice] = useState<{ language: string; voice?: string; voice2?: string } | null>(null)
  const [title, setTitle] = useState("")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; signup?: boolean } | null>(null)

  const languages = useMemo(() => config?.languages ?? [], [config?.languages])
  const llm = config?.llm ?? false

  // take the values we show from a freshly loaded (or freshly finished) draft
  const adopt = useCallback((d: Draft) => {
    setDraft(d)
    setTitle(d.title)
    setLanguage(d.language)
    setSelected(new Set(d.sections.map((s) => s.idx)))
  }, [])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    api
      .request<Draft>(`/v1/drafts/${draftId}`)
      .then((d) => {
        if (cancelled) return
        debug("options", "draft loaded", { id: d.id, status: d.status, sections: d.sections.length, language: d.language })
        adopt(d)
      })
      .catch((err) => {
        warn("options", "draft could not be loaded", err)
        if (!cancelled) setMissing(true)
      })
    return () => {
      cancelled = true
    }
  }, [api, draftId, ready, adopt])

  // a scanned PDF is read in the background: follow its progress and continue when it is ready
  const scanning = draft?.status === "ocr"
  useEffect(() => {
    if (!scanning) return
    let cancelled = false
    const timer = setInterval(() => {
      api
        .request<Draft>(`/v1/drafts/${draftId}`)
        .then((d) => {
          if (cancelled) return
          debug("options", "scan progress", d.ocr)
          if (d.status === "ocr") setDraft(d)
          else adopt(d)
        })
        .catch((err) => {
          if (cancelled) return
          warn("options", "scan progress check failed", err)
          if (err instanceof ApiError && err.status === 404) setMissing(true)
        })
    }, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [api, draftId, scanning, adopt])

  const documentLanguage = draft?.language ?? "en"

  // the narration language: reading keeps the document's language; Translate always changes it;
  // the other smart modes can change it when the AI service is on
  const effectiveLanguage = mode === "read" ? documentLanguage : mode === "translate" || llm ? language : documentLanguage

  const voices = useVoices(effectiveLanguage)

  // default voices follow the language; a manual choice only applies to the language it was made for
  const defaults = languages.find((l) => l.code === effectiveLanguage)
  const choice = voiceChoice?.language === effectiveLanguage ? voiceChoice : null
  const voice = choice?.voice ?? defaults?.voice ?? firstVoice(voices.voices)
  const voice2 =
    choice?.voice2 ??
    defaults?.voice2 ??
    voices.voices.find((v) => v.id !== voice && v.gender !== voices.voices.find((x) => x.id === voice)?.gender)?.id ??
    voice
  const setVoice = (v: string) => setVoiceChoice({ language: effectiveLanguage, voice2: choice?.voice2, voice: v })
  const setVoice2 = (v: string) => setVoiceChoice({ language: effectiveLanguage, voice: choice?.voice, voice2: v })

  const selectedChars = useMemo(
    () => (draft ? draft.sections.filter((s) => selected.has(s.idx)).reduce((sum, s) => sum + s.chars, 0) : 0),
    [draft, selected],
  )
  const totalChars = useMemo(() => (draft ? draft.sections.reduce((sum, s) => sum + s.chars, 0) : 0), [draft])

  const estimates = useMemo(() => {
    const fraction = totalChars > 0 ? selectedChars / totalChars : 0
    const base = draft?.estimates ?? { read: 0, translate: 0, study: 0, revision: 0, explain: 0, quiz: 0 }
    return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v * fraction])) as Record<Mode, number>
  }, [draft, selectedChars, totalChars])

  const allowance = me?.allowance
  const aiLeft = allowance && allowance.ai_docs_limit !== null ? allowance.ai_docs_limit - allowance.ai_docs_used : Infinity
  const disabledModes = useMemo(() => {
    const out: Partial<Record<Mode, string>> = {}
    if (config && !llm) out.translate = "Translation needs the AI service, which is not switched on for this site yet."
    if (aiLeft <= 0) {
      const reason = me?.kind === "anon" ? "You have used today's smart listen. Sign up free for more." : "Daily smart-listening limit reached. Try again tomorrow or upgrade."
      for (const m of AI_MODES) out[m] = reason
    }
    return out
  }, [aiLeft, me?.kind, config, llm])

  const maxChars = me?.limits.max_chars ?? 150_000
  const overLimit = selectedChars > maxChars

  const blocker = createBlocker({
    draftLoaded: Boolean(draft) && !scanning,
    selectedCount: selected.size,
    overLimit,
    voice,
    voicesLoading: voices.loading || !config,
    voicesFailed: voices.failed,
    mode,
    language: effectiveLanguage,
    documentLanguage,
  })
  const canCreate = blocker === null && !busy

  // dev-only: always know why the button is (not) available
  useEffect(() => {
    debug("options", blocker ? `Create is blocked: ${blocker}` : "Create is available", { mode, effectiveLanguage, voice, voices: voices.voices.length })
  }, [blocker, mode, effectiveLanguage, voice, voices.voices.length])

  function chooseMode(next: Mode) {
    setMode(next)
    setError(null)
    if (next === "translate" && language === documentLanguage) setLanguage(suggestedTranslationTarget(documentLanguage))
  }

  function toggle(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  async function create() {
    if (!draft || !canCreate) return
    setBusy(true)
    setError(null)
    debug("options", "creating audio", { mode, language: effectiveLanguage, voice })
    try {
      const doc = await api.request<Doc>("/v1/docs", {
        method: "POST",
        json: {
          draft_id: draft.id,
          mode,
          language: effectiveLanguage,
          voice,
          voice2: mode === "quiz" ? voice2 : undefined,
          sections: [...selected].sort((a, b) => a - b),
          title: title.trim() || undefined,
        },
      })
      track("cta_click", { action: "create_audio", mode })
      router.push(`/listen/${doc.id}`)
    } catch (err) {
      warn("options", "create failed", err)
      setBusy(false)
      const message = err instanceof ApiError ? err.message : "We could not reach the server. Check your connection and try again."
      setError({ message, signup: err instanceof ApiError && err.code === "ai_limit" && me?.kind === "anon" })
      toast.error(message)
    }
  }

  if (missing) {
    return (
      <div className="container-page max-w-xl py-20 text-center">
        <h1 className="text-2xl font-semibold">This upload has expired</h1>
        <p className="mt-2 text-muted-foreground">For your privacy we only keep uploads for a few hours. Add your content again to continue.</p>
        <Link href="/" className={buttonVariants({ size: "lg", className: "mt-6" })}>
          Start again
        </Link>
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1.6fr_1fr]" aria-busy="true" aria-label="Loading your document">
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (draft.status === "ocr") return <ScanProgress draft={draft} />
  if (draft.status === "failed") return <ScanFailed message={draft.error} />

  const showLanguagePicker = mode === "translate" || (mode !== "read" && llm)
  const languageItems = languages
    .filter((l) => mode !== "translate" || l.code !== documentLanguage)
    .map((l) => ({ value: l.code, label: l.native === l.label ? l.label : `${l.label} · ${l.native}` }))
  const draftLanguageLabel = languages.find((l) => l.code === documentLanguage)?.label ?? "English"
  const targetLabel = languages.find((l) => l.code === effectiveLanguage)?.label ?? effectiveLanguage

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-6">
        <p className="text-sm font-medium text-primary">Step 2 of 2</p>
        <h1 className="text-3xl font-semibold">How do you want to listen?</h1>
      </div>

      {configError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangleIcon />
          <AlertTitle>We could not reach the server</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            The list of voices and languages did not load. Check your connection.
            <Button type="button" size="sm" variant="outline" onClick={reloadConfig}>
              <RotateCwIcon /> Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-8">
          {draft.warnings.length > 0 && (
            <Alert>
              <AlertTriangleIcon />
              <AlertTitle>Good to know</AlertTitle>
              <AlertDescription>{draft.warnings.join(" ")}</AlertDescription>
            </Alert>
          )}

          <section aria-labelledby="mode-h" className="space-y-3">
            <h2 id="mode-h" className="text-lg font-semibold">1. Choose a mode</h2>
            <ModePicker value={mode} onChange={chooseMode} estimates={estimates} disabled={disabledModes} />
          </section>

          <section aria-labelledby="voice-h" className="space-y-4">
            <h2 id="voice-h" className="text-lg font-semibold">2. Choose a voice</h2>
            {showLanguagePicker && (
              <div className="space-y-1.5">
                <label htmlFor="lang" className="text-sm font-medium">{mode === "translate" ? "Translate into" : "Language to listen in"}</label>
                <Select items={languageItems} value={language} onValueChange={(v) => v && setLanguage(v)}>
                  <SelectTrigger id="lang" className="h-10 w-full sm:w-72" aria-label={mode === "translate" ? "Translate into" : "Language to listen in"}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languageItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mode === "translate" ? (
                  <p className="text-xs text-muted-foreground">
                    Your document is in {draftLanguageLabel}. It is translated into {targetLabel} word for word, then read aloud. Translating uses one smart listen.
                  </p>
                ) : (
                  language !== documentLanguage && <p className="text-xs text-muted-foreground">Your document is in {draftLanguageLabel}. It will be explained in {targetLabel}.</p>
                )}
              </div>
            )}
            {mode !== "read" && mode !== "translate" && !llm && (
              <p className="flex gap-2 text-sm text-muted-foreground">
                <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Smart modes will use your document&apos;s language ({draftLanguageLabel}). Other languages need the AI service, which is not switched on for this site yet.
              </p>
            )}
            {mode === "read" && <p className="text-sm text-muted-foreground">Detected language: {draftLanguageLabel}. To hear it in another language, choose “Translate and listen”.</p>}

            <div className="space-y-4" key={effectiveLanguage}>
              <VoicePicker
                id="voice"
                label={mode === "quiz" ? "Narrator and questions" : "Voice"}
                language={effectiveLanguage}
                value={voice}
                voices={voices}
                onChange={setVoice}
              />
              {mode === "quiz" && voices.voices.length > 0 && (
                <VoicePicker id="voice2" label="Answers" language={effectiveLanguage} value={voice2} voices={voices} onChange={setVoice2} />
              )}
            </div>
          </section>

          <section aria-labelledby="sections-h" className="space-y-3">
            <h2 id="sections-h" className="text-lg font-semibold">3. Pick sections <span className="text-sm font-normal text-muted-foreground">(optional)</span></h2>
            <SectionList
              draft={draft}
              selected={selected}
              onToggle={toggle}
              onSelectAll={(all) => setSelected(new Set(all ? draft.sections.map((s) => s.idx) : []))}
              onDraftChange={(d) => setDraft(d)}
            />
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="space-y-1.5">
              <label htmlFor="title" className="text-sm font-medium">Title</label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} className="h-10" />
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Listening time</dt>
                <dd className="text-lg font-semibold">{formatDuration(estimates[mode])}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Mode</dt>
                <dd className="text-lg font-semibold">{MODE_BY_ID[mode].label}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Words</dt>
                <dd className="font-medium">{formatNumber(wordsFromChars(selectedChars))}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pages</dt>
                <dd className="font-medium">{draft.page_count ?? "–"}</dd>
              </div>
            </dl>

            {allowance && allowance.limit_minutes !== null && (
              <div className="space-y-1.5 rounded-xl bg-muted/60 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Today&apos;s free listening</span>
                  <span className="font-medium">
                    {Math.round(allowance.used_minutes)} of {allowance.limit_minutes} min
                  </span>
                </div>
                <Progress value={Math.min(100, (allowance.used_minutes / allowance.limit_minutes) * 100)} aria-label="Daily listening used" />
                <p className="text-xs text-muted-foreground">
                  Resets in {timeUntil(allowance.resets_at)}.{" "}
                  {estimates[mode] / 60 > (allowance.remaining_minutes ?? Infinity) && "This is longer than what is left today. You can start and continue tomorrow, or unlock it for ₹99."}
                </p>
              </div>
            )}

            {overLimit && (
              <Alert variant="destructive">
                <AlertTriangleIcon />
                <AlertTitle>Too long for your plan</AlertTitle>
                <AlertDescription>
                  This selection is about {formatNumber(wordsFromChars(selectedChars))} words; your plan allows about {formatNumber(wordsFromChars(maxChars))}. Untick some sections
                  {me?.kind === "anon" ? " or sign up free for a bigger limit." : " or upgrade."}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error.message}
                {error.signup && (
                  <SignUpButton mode="modal">
                    <Button size="sm" className="mt-2 w-full">Sign up free</Button>
                  </SignUpButton>
                )}
              </div>
            )}

            <Button size="lg" className="h-11 w-full text-base" disabled={!canCreate} aria-describedby="create-status" onClick={() => void create()}>
              {busy ? <><Loader2Icon className="animate-spin" /> Preparing…</> : <>Create audio <ArrowRightIcon /></>}
            </Button>
            <p id="create-status" role="status" aria-live="polite" className="flex min-h-5 items-start justify-center gap-1.5 text-center text-xs text-muted-foreground">
              {blocker ? (
                <>
                  {(voices.loading || !config) && <Loader2Icon className="mt-px size-3.5 shrink-0 animate-spin" aria-hidden="true" />}
                  <span>{blocker}</span>
                </>
              ) : busy ? (
                <span>{mode === "read" ? "Getting your first audio ready…" : "Writing the first part. Your audio opens in a few seconds."}</span>
              ) : mode !== "read" ? (
                <span>Smart listening is prepared chapter by chapter. Your first audio is ready in a few seconds.</span>
              ) : null}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
