"use client"

import { GaugeIcon, Loader2Icon, MoonIcon, PauseIcon, PlayIcon, RotateCcwIcon, RotateCwIcon, SkipBackIcon, SkipForwardIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import { formatClock } from "@/lib/format"
import { SPEEDS, type PlayerStatus, type SleepTimer } from "@/lib/player/use-player"

interface PlayerBarProps {
  title: string
  chapter: string | undefined
  status: PlayerStatus
  waiting: boolean
  elapsed: number
  total: number
  speed: number
  sleepTimer: SleepTimer
  onToggle: () => void
  onSeekBy: (delta: number) => void
  onSeekFraction: (fraction: number) => void
  onChapter: (direction: 1 | -1) => void
  onSpeed: (speed: number) => void
  onSleep: (timer: SleepTimer) => void
  currentSection: number
  extras: React.ReactNode
}

function useSleepLabel(timer: SleepTimer): string | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (timer?.kind !== "minutes") return
    const id = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(id)
  }, [timer])
  if (timer?.kind === "minutes") return `${Math.max(1, Math.ceil((timer.until - now) / 60000))} min`
  return timer?.kind === "chapter" ? "End of chapter" : null
}

export function PlayerBar(props: PlayerBarProps) {
  const { status, waiting, elapsed, total, speed, sleepTimer } = props
  const [drag, setDrag] = useState<number | null>(null)
  const fraction = total > 0 ? Math.min(1, elapsed / total) : 0
  const value = drag ?? Math.round(fraction * 1000)
  const playing = status === "playing"
  const busy = status === "loading" || (playing && waiting)

  const sleepLabel = useSleepLabel(sleepTimer)

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="container-page space-y-1 py-2 sm:py-3">
        <div className="flex items-center gap-3">
          <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{formatClock(elapsed)}</span>
          <Slider
            value={[value]}
            min={0}
            max={1000}
            step={1}
            onValueChange={(v) => setDrag(Array.isArray(v) ? v[0] : v)}
            onValueCommitted={(v) => {
              props.onSeekFraction((Array.isArray(v) ? v[0] : v) / 1000)
              setDrag(null)
            }}
            aria-label="Position in the document"
            className="flex-1"
          />
          <span className="w-12 text-xs tabular-nums text-muted-foreground">{formatClock(total)}</span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-medium">{props.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {status === "blocked" ? "Daily limit reached" : status === "error" ? "Could not load audio" : props.chapter ?? " "}
            </p>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="icon" aria-label="Previous chapter" onClick={() => props.onChapter(-1)} className="hidden sm:inline-flex">
              <SkipBackIcon />
            </Button>
            <Button variant="ghost" size="icon-lg" aria-label="Back 15 seconds" onClick={() => props.onSeekBy(-15)}>
              <RotateCcwIcon />
            </Button>
            <Button size="icon-lg" className="size-12 rounded-full" aria-label={playing ? "Pause" : "Play"} onClick={props.onToggle}>
              {busy ? <Loader2Icon className="size-6 animate-spin" /> : playing ? <PauseIcon className="size-6" /> : <PlayIcon className="size-6" />}
            </Button>
            <Button variant="ghost" size="icon-lg" aria-label="Forward 15 seconds" onClick={() => props.onSeekBy(15)}>
              <RotateCwIcon />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Next chapter" onClick={() => props.onChapter(1)} className="hidden sm:inline-flex">
              <SkipForwardIcon />
            </Button>
          </div>

          <div className="flex items-center justify-end gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="sm" aria-label={`Speed ${speed}x`}>
                    <GaugeIcon /> {speed}x
                  </Button>
                }
              />
              <DropdownMenuContent align="end" side="top">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Speed</DropdownMenuLabel>
                  {SPEEDS.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => props.onSpeed(s)} className={s === speed ? "font-semibold text-primary" : undefined}>
                      {s}x{s === 1 ? " (normal)" : ""}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="sm" aria-label="Sleep timer">
                    <MoonIcon /> <span className="hidden sm:inline">{sleepLabel ?? "Sleep"}</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" side="top">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Stop playing after</DropdownMenuLabel>
                  {[15, 30, 45, 60].map((m) => (
                    <DropdownMenuItem key={m} onClick={() => props.onSleep({ kind: "minutes", until: Date.now() + m * 60000 })}>
                      {m} minutes
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onClick={() => props.onSleep({ kind: "chapter", section: props.currentSection })}>End of this chapter</DropdownMenuItem>
                  {sleepTimer && <DropdownMenuItem onClick={() => props.onSleep(null)}>Turn off timer</DropdownMenuItem>}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {props.extras}
          </div>
        </div>
      </div>
    </div>
  )
}
