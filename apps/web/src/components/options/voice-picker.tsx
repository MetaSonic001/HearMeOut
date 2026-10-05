"use client"

import { Loader2Icon, PlayIcon, RotateCwIcon, SquareIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { useSession } from "@/components/providers/session-provider"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import type { Voice } from "@/lib/api/types"
import { API_URL } from "@/lib/config"
import { debug, warn } from "@/lib/debug"
import { groupVoices, voiceLabel } from "@/lib/voices"

const cache = new Map<string, Voice[]>()

export interface VoicesState {
  voices: Voice[]
  loading: boolean
  failed: boolean
  retry: () => void
}

/** Voices for a language, cached for the session. Exposes loading and failure so the UI never sits silently. */
export function useVoices(language: string): VoicesState {
  const { api } = useSession()
  const [fetched, setFetched] = useState<{ language: string; voices: Voice[] } | null>(null)
  const [failedFor, setFailedFor] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!language || cache.has(language)) return
    let cancelled = false
    api
      .request<{ voices: Voice[] }>(`/v1/voices?language=${encodeURIComponent(language)}`)
      .then((res) => {
        cache.set(language, res.voices)
        debug("voices", `loaded ${res.voices.length} voices`, { language })
        if (!cancelled) {
          setFetched({ language, voices: res.voices })
          setFailedFor(null)
        }
      })
      .catch((err) => {
        warn("voices", `could not load voices for ${language}`, err)
        if (!cancelled) setFailedFor(language)
      })
    return () => {
      cancelled = true
    }
  }, [api, language, attempt])

  const retry = useCallback(() => {
    setFailedFor(null)
    setAttempt((n) => n + 1)
  }, [])

  const voices = cache.get(language) ?? (fetched?.language === language ? fetched.voices : [])
  const failed = failedFor === language && voices.length === 0
  return { voices, loading: Boolean(language) && voices.length === 0 && !failed, failed, retry }
}

interface VoicePickerProps {
  id: string
  label: string
  language: string
  value: string
  voices: VoicesState
  onChange: (voiceId: string) => void
}

export function VoicePicker({ id, label, language, value, voices: state, onChange }: VoicePickerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [preview, setPreview] = useState<"idle" | "loading" | "playing">("idle")
  const [previewFailed, setPreviewFailed] = useState(false)

  useEffect(() => () => audioRef.current?.pause(), [])

  const groups = groupVoices(state.voices)
  const items = state.voices.map((v) => ({ value: v.id, label: voiceLabel(v) }))

  // a preview belongs to one voice: stop it when the choice changes
  function choose(voiceId: string) {
    audioRef.current?.pause()
    setPreview("idle")
    setPreviewFailed(false)
    onChange(voiceId)
  }

  function togglePreview() {
    if (preview !== "idle") {
      audioRef.current?.pause()
      setPreview("idle")
      return
    }
    setPreviewFailed(false)
    const audio = new Audio(`${API_URL}/v1/voices/${encodeURIComponent(value)}/sample?language=${encodeURIComponent(language)}`)
    audioRef.current = audio
    setPreview("loading")
    audio.addEventListener("playing", () => setPreview("playing"))
    audio.addEventListener("ended", () => setPreview("idle"))
    audio.addEventListener("error", () => {
      warn("voices", "voice preview failed", { value })
      setPreviewFailed(true)
      setPreview("idle")
    })
    void audio.play().catch(() => {
      setPreviewFailed(true)
      setPreview("idle")
    })
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {state.voices.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">{state.voices.length} voices</span>}
      </label>

      {state.loading && <Skeleton className="h-10 w-full" aria-label="Loading voices" />}

      {state.failed && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>We could not load the voices.</span>
          <Button type="button" size="sm" variant="outline" onClick={state.retry}>
            <RotateCwIcon /> Try again
          </Button>
        </div>
      )}

      {state.voices.length > 0 && (
        <div className="flex gap-2">
          <Select items={items} value={value} onValueChange={(v) => v && choose(v)}>
            <SelectTrigger id={id} className="h-10 min-w-0 flex-1" aria-label={label}>
              <SelectValue placeholder="Choose a voice" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectGroup key={group.locale}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.voices.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {voiceLabel(v)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" className="h-10 shrink-0" onClick={togglePreview} disabled={!value} aria-label="Hear this voice">
            {preview === "loading" ? <Loader2Icon className="animate-spin" /> : preview === "playing" ? <SquareIcon /> : <PlayIcon />}
            <span className="hidden sm:inline">{preview === "idle" ? "Preview" : preview === "loading" ? "Loading…" : "Stop"}</span>
          </Button>
        </div>
      )}
      {previewFailed && <p role="alert" className="text-xs text-destructive">The preview could not play. Check your connection and try again.</p>}
    </div>
  )
}
