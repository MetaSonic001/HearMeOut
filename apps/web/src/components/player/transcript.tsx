"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import type { Chunk, DocSection } from "@/lib/api/types"
import { cn } from "@/lib/utils"

const BEFORE = 6
const AFTER = 40

interface TranscriptProps {
  chunks: Chunk[]
  sections: DocSection[]
  index: number
  time: number
  duration: number
  playing: boolean
  onSeek: (idx: number) => void
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?।॥])\s+/).filter(Boolean)
}

function ActiveText({ text, fraction }: { text: string; fraction: number }) {
  const sentences = useMemo(() => splitSentences(text), [text])
  const total = text.length || 1
  const target = Math.min(0.999, Math.max(0, fraction)) * total
  const starts = useMemo(() => {
    const out: number[] = []
    let sum = 0
    for (const s of sentences) {
      out.push(sum)
      sum += s.length + 1
    }
    return out
  }, [sentences])
  return (
    <>
      {sentences.map((sentence, i) => {
        const start = starts[i]
        const active = target >= start && target < start + sentence.length + 1
        return (
          <span key={i} className={cn("rounded-sm transition-colors", active && "bg-primary/15 text-foreground")}>
            {sentence}{" "}
          </span>
        )
      })}
    </>
  )
}

export function Transcript({ chunks, sections, index, time, duration, playing, onSeek }: TranscriptProps) {
  const [extraBefore, setExtraBefore] = useState(0)
  const [extraAfter, setExtraAfter] = useState(0)
  const activeRef = useRef<HTMLDivElement>(null)

  const start = Math.max(0, index - BEFORE - extraBefore)
  const end = Math.min(chunks.length, index + AFTER + extraAfter)
  const visible = chunks.slice(start, end)

  useEffect(() => {
    const el = activeRef.current
    if (!el) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" })
  }, [index])

  const fraction = duration > 0 ? time / duration : 0

  return (
    <article aria-label="Transcript" className="transcript mx-auto max-w-3xl space-y-3">
      {start > 0 && (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => setExtraBefore((n) => n + 30)}>
            Show earlier text
          </Button>
        </div>
      )}
      {visible.map((chunk, i) => {
        const absolute = start + i
        const active = absolute === index
        const previous = chunks[absolute - 1]
        const newSection = sections.length > 1 && (!previous || previous.section !== chunk.section)
        const sectionTitle = sections.find((s) => s.idx === chunk.section)?.title
        return (
          <div key={chunk.idx}>
            {newSection && sectionTitle && (
              <h2 className="mt-8 mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-primary">{sectionTitle}</h2>
            )}
            <div
              ref={active ? activeRef : undefined}
              role="button"
              tabIndex={0}
              aria-current={active ? "true" : undefined}
              onClick={() => onSeek(absolute)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSeek(absolute)
              }}
              className={cn(
                "cursor-pointer rounded-lg border-l-4 px-4 py-2 text-muted-foreground transition-colors hover:bg-muted/50",
                active ? "border-primary bg-accent/40 text-foreground" : "border-transparent",
              )}
            >
              {chunk.kind !== "narration" && (
                <span className="mr-2 inline-block rounded-full bg-primary px-2 py-0.5 align-middle font-sans text-xs font-semibold text-primary-foreground">
                  {chunk.kind === "question" ? "Question" : "Answer"}
                </span>
              )}
              {active && playing ? <ActiveText text={chunk.text} fraction={fraction} /> : chunk.text}
            </div>
          </div>
        )
      })}
      {end < chunks.length && (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => setExtraAfter((n) => n + 60)}>
            Show more text
          </Button>
        </div>
      )}
    </article>
  )
}
