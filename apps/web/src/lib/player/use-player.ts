"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { ApiClient } from "@/lib/api/client"
import { ApiError } from "@/lib/api/client"
import type { Chunk, Doc } from "@/lib/api/types"
import { KEYS, readStorage, writeStorage } from "@/lib/storage"
import { useLatest } from "@/lib/use-latest"

export const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5] as const
const PREFETCH_AHEAD = 2
const KEEP_BEHIND = 2
const NOT_READY_RETRIES = 120

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "blocked" | "ended" | "error"

export interface QuotaBlock {
  options: string[]
  resetsAt: string | null
  message: string
}

export type SleepTimer = { kind: "minutes"; until: number } | { kind: "chapter"; section: number } | null

interface Options {
  api: ApiClient
  doc: Doc
  chunks: Chunk[]
  onProgress?: (chunk: number, offset: number) => void
  onFirstPlay?: () => void
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function loadSpeed(): number {
  const saved = Number(readStorage(KEYS.speed))
  return SPEEDS.includes(saved as (typeof SPEEDS)[number]) ? saved : 1
}

function estimateSeconds(chunk: Chunk | undefined): number {
  if (!chunk) return 0
  if (chunk.duration_ms) return chunk.duration_ms / 1000
  return chunk.text.length / 14.5 + chunk.pause_ms / 1000
}

export function usePlayer({ api, doc, chunks, onProgress, onFirstPlay }: Options) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const blobs = useRef(new Map<number, { url: string; durationMs: number | null }>())
  const inflight = useRef(new Map<number, Promise<void>>())
  const token = useRef(0)
  const chunksRef = useLatest(chunks)
  const docRef = useLatest(doc)
  const indexRef = useRef(doc.progress.chunk)
  const speedRef = useRef(loadSpeed())
  const startedRef = useRef(false)
  const lastSavedRef = useRef(0)

  const [status, setStatus] = useState<PlayerStatus>("idle")
  const [index, setIndexState] = useState(doc.progress.chunk)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeedState] = useState(loadSpeed)
  const [blocked, setBlocked] = useState<QuotaBlock | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [sleepTimer, setSleepTimerState] = useState<SleepTimer>(null)
  const sleepRef = useLatest<SleepTimer>(sleepTimer)

  const setIndex = useCallback((i: number) => {
    indexRef.current = i
    setIndexState(i)
  }, [])

  // ---------------------------------------------------------------- fetching
  const totalChunks = useCallback(() => docRef.current.total_chunks ?? chunksRef.current.length, [docRef, chunksRef])

  const fetchChunk = useCallback(
    (idx: number): Promise<void> => {
      if (blobs.current.has(idx)) return Promise.resolve()
      const existing = inflight.current.get(idx)
      if (existing) return existing
      const promise = (async () => {
        let serverBusy = 0
        for (let attempt = 0; attempt < NOT_READY_RETRIES; attempt++) {
          try {
            const { blob, durationMs } = await api.blob(`/v1/docs/${docRef.current.id}/chunks/${idx}/audio`)
            blobs.current.set(idx, { url: URL.createObjectURL(blob), durationMs })
            return
          } catch (err) {
            if (err instanceof ApiError && err.code === "not_ready") {
              await sleep(2000)
              continue
            }
            if (err instanceof ApiError && (err.status === 503 || err.status === 0) && serverBusy < 4) {
              serverBusy++
              await sleep(1200 * serverBusy)
              continue
            }
            throw err
          }
        }
        throw new ApiError(504, "not_ready", "This part is taking longer than expected.")
      })().finally(() => inflight.current.delete(idx))
      inflight.current.set(idx, promise)
      return promise
    },
    [api, docRef],
  )

  const cleanup = useCallback((current: number) => {
    for (const [idx, entry] of blobs.current) {
      if (idx < current - KEEP_BEHIND || idx > current + PREFETCH_AHEAD + 4) {
        URL.revokeObjectURL(entry.url)
        blobs.current.delete(idx)
      }
    }
  }, [])

  // ---------------------------------------------------------------- playback
  const playChunk = useCallback(
    async (idx: number, offset = 0, autoplay = true) => {
      const audio = audioRef.current
      if (!audio) return
      const myToken = ++token.current
      if (idx >= totalChunks() && docRef.current.status === "ready") {
        setStatus("ended")
        return
      }
      setBlocked(null)
      setMessage(null)
      setIndex(idx)
      setStatus("loading")
      setWaiting(true)
      try {
        await fetchChunk(idx)
      } catch (err) {
        if (token.current !== myToken) return
        setWaiting(false)
        if (err instanceof ApiError && err.code === "quota_exceeded") {
          audio.pause()
          const details = err.details as { options?: string[]; allowance?: { resets_at?: string } }
          setBlocked({ options: details.options ?? [], resetsAt: details.allowance?.resets_at ?? null, message: err.message })
          setStatus("blocked")
        } else if (err instanceof ApiError && err.code === "chunk_not_found") {
          setStatus("ended")
        } else {
          setMessage(err instanceof ApiError ? err.message : "We could not load the audio.")
          setStatus("error")
        }
        return
      }
      if (token.current !== myToken) return
      setWaiting(false)
      const entry = blobs.current.get(idx)
      if (!entry) return
      audio.src = entry.url
      audio.playbackRate = speedRef.current
      audio.preservesPitch = true
      const startAt = Math.max(0, offset)
      const begin = () => {
        if (startAt > 0) audio.currentTime = startAt
      }
      audio.addEventListener("loadedmetadata", begin, { once: true })
      setTime(startAt)
      if (autoplay) {
        try {
          await audio.play()
          if (!startedRef.current) {
            startedRef.current = true
            onFirstPlay?.()
          }
        } catch {
          setStatus("paused") // the browser needs a tap to start audio
        }
      } else {
        setStatus("paused")
      }
      for (let k = 1; k <= PREFETCH_AHEAD; k++) {
        if (idx + k < totalChunks() || docRef.current.status === "processing") void fetchChunk(idx + k).catch(() => undefined)
      }
      cleanup(idx)
    },
    [cleanup, docRef, fetchChunk, onFirstPlay, setIndex, totalChunks],
  )

  const saveProgress = useCallback(
    (force = false) => {
      const audio = audioRef.current
      if (!audio || !onProgress) return
      const now = Date.now()
      if (!force && now - lastSavedRef.current < 8000) return
      lastSavedRef.current = now
      onProgress(indexRef.current, audio.currentTime || 0)
    },
    [onProgress],
  )

  const playChunkRef = useLatest(playChunk)
  const saveProgressRef = useLatest(saveProgress)

  // create the audio element once and wire its events
  useEffect(() => {
    const audio = new Audio()
    audio.preload = "auto"
    audioRef.current = audio
    const blobMap = blobs.current
    const saveRef = saveProgressRef
    const onTime = () => {
      setTime(audio.currentTime)
      saveProgressRef.current()
    }
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onEnded = () => {
      const current = indexRef.current
      const sleep = sleepRef.current
      const nextChunk = chunksRef.current[current + 1]
      const currentChunk = chunksRef.current[current]
      if (sleep?.kind === "chapter" && nextChunk && currentChunk && nextChunk.section !== currentChunk.section) {
        setSleepTimerState(null)
        setStatus("paused")
        setIndex(current + 1)
        saveProgressRef.current(true)
        return
      }
      void playChunkRef.current(current + 1)
    }
    const onPlaying = () => {
      setStatus("playing")
      setWaiting(false)
    }
    const onPause = () => {
      if (!audio.ended && !audio.seeking) setStatus((s) => (s === "playing" ? "paused" : s))
      saveProgressRef.current(true)
    }
    const onWaiting = () => setWaiting(true)
    audio.addEventListener("timeupdate", onTime)
    audio.addEventListener("loadedmetadata", onMeta)
    audio.addEventListener("durationchange", onMeta)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("playing", onPlaying)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("waiting", onWaiting)
    return () => {
      saveRef.current(true)
      audio.pause()
      audio.removeAttribute("src")
      audio.load()
      audio.removeEventListener("timeupdate", onTime)
      audio.removeEventListener("ended", onEnded)
      for (const entry of blobMap.values()) URL.revokeObjectURL(entry.url)
      blobMap.clear()
      audioRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // sleep timer (minutes)
  useEffect(() => {
    if (sleepTimer?.kind !== "minutes") return
    const id = window.setInterval(() => {
      if (Date.now() >= sleepTimer.until) {
        audioRef.current?.pause()
        setSleepTimerState(null)
        window.clearInterval(id)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [sleepTimer])

  // ----------------------------------------------------------------- actions
  const play = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    if (status === "ended") return playChunk(0)
    if (status === "blocked" || status === "error" || !audio.src) return playChunk(indexRef.current, status === "idle" ? docRef.current.progress.offset : 0)
    try {
      await audio.play()
    } catch {
      setStatus("paused")
    }
  }, [docRef, playChunk, status])

  const pause = useCallback(() => audioRef.current?.pause(), [])
  const toggle = useCallback(() => (status === "playing" ? pause() : void play()), [pause, play, status])

  const seekToChunk = useCallback((idx: number, offset = 0) => playChunk(Math.max(0, idx), offset), [playChunk])

  const seekBy = useCallback(
    (delta: number) => {
      const audio = audioRef.current
      if (!audio) return
      const target = audio.currentTime + delta
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0
      if (target >= 0 && target <= dur) {
        audio.currentTime = target
        return
      }
      if (target > dur) return void playChunk(indexRef.current + 1, Math.max(0, target - dur))
      const prev = chunksRef.current[indexRef.current - 1]
      if (!prev) return void (audio.currentTime = 0)
      const prevDur = estimateSeconds(prev)
      void playChunk(indexRef.current - 1, Math.max(0, prevDur + target))
    },
    [chunksRef, playChunk],
  )

  const setSpeed = useCallback((value: number) => {
    speedRef.current = value
    setSpeedState(value)
    writeStorage(KEYS.speed, String(value))
    if (audioRef.current) audioRef.current.playbackRate = value
  }, [])

  const sectionStarts = useMemo(() => {
    const starts: number[] = []
    let last = -1
    chunks.forEach((c, i) => {
      if (c.section !== last) {
        starts.push(i)
        last = c.section
      }
    })
    return starts
  }, [chunks])

  const currentSection = chunks[index]?.section ?? 0
  const jumpChapter = useCallback(
    (direction: 1 | -1) => {
      const current = chunksRef.current[indexRef.current]?.section ?? 0
      const startOfCurrent = sectionStarts.find((i) => chunksRef.current[i]?.section === current) ?? 0
      if (direction === -1) {
        const intoSection = indexRef.current - startOfCurrent
        const target = intoSection > 0 || (audioRef.current?.currentTime ?? 0) > 5 ? startOfCurrent : (sectionStarts[sectionStarts.indexOf(startOfCurrent) - 1] ?? 0)
        return void playChunk(target)
      }
      const next = sectionStarts[sectionStarts.indexOf(startOfCurrent) + 1]
      if (next !== undefined) void playChunk(next)
    },
    [chunksRef, playChunk, sectionStarts],
  )

  const setSleepTimer = useCallback((value: SleepTimer) => setSleepTimerState(value), [])

  // overall position (seconds) using real durations where known and estimates elsewhere
  const elapsed = useMemo(() => {
    let sum = 0
    for (let i = 0; i < Math.min(index, chunks.length); i++) sum += estimateSeconds(chunks[i])
    return sum + time
  }, [chunks, index, time])
  const total = useMemo(() => {
    const known = chunks.reduce((sum, c) => sum + estimateSeconds(c), 0)
    return Math.max(known, doc.est_seconds)
  }, [chunks, doc.est_seconds])

  const seekToFraction = useCallback(
    (fraction: number) => {
      const target = fraction * total
      let acc = 0
      for (let i = 0; i < chunksRef.current.length; i++) {
        const d = estimateSeconds(chunksRef.current[i])
        if (acc + d >= target) return void playChunk(i, Math.max(0, target - acc))
        acc += d
      }
      void playChunk(Math.max(0, chunksRef.current.length - 1))
    },
    [chunksRef, playChunk, total],
  )

  // media session (lock screen / headset controls)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({ title: doc.title, artist: "HearMeOut", album: chunks[index] ? `Part ${chunks[index].section + 1}` : undefined })
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => void play()],
      ["pause", () => pause()],
      ["seekbackward", () => seekBy(-15)],
      ["seekforward", () => seekBy(15)],
      ["previoustrack", () => jumpChapter(-1)],
      ["nexttrack", () => jumpChapter(1)],
    ]
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        /* action not supported on this browser */
      }
    }
  }, [chunks, doc.title, index, jumpChapter, pause, play, seekBy])

  useEffect(() => {
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = status === "playing" ? "playing" : "paused"
    }
  }, [status])

  return {
    status,
    index,
    time,
    duration,
    speed,
    blocked,
    message,
    waiting,
    sleepTimer,
    elapsed,
    total,
    currentSection,
    sectionStarts,
    play,
    pause,
    toggle,
    seekBy,
    seekToChunk,
    seekToFraction,
    jumpChapter,
    setSpeed,
    setSleepTimer,
    audioRef,
  }
}
