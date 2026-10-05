"use client"

import { ModeIcon } from "@/components/marketing/mode-icon"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { Mode } from "@/lib/api/types"
import { MODES } from "@/lib/content/core"
import { formatDuration } from "@/lib/format"
import { cn } from "@/lib/utils"

interface ModePickerProps {
  value: Mode
  onChange: (mode: Mode) => void
  /** Estimated seconds for each mode given the current selection. */
  estimates: Record<Mode, number>
  /** Modes that cannot be used right now, with the reason. */
  disabled?: Partial<Record<Mode, string>>
}

export function ModePicker({ value, onChange, estimates, disabled = {} }: ModePickerProps) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as Mode)} aria-label="How do you want to listen?" className="grid gap-3 sm:grid-cols-2">
      {MODES.map((mode) => {
        const reason = disabled[mode.id]
        const selected = value === mode.id
        return (
          <label
            key={mode.id}
            className={cn(
              "relative flex cursor-pointer gap-3 rounded-xl border bg-card p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
              selected ? "border-primary bg-accent/50 ring-1 ring-primary" : "hover:border-primary/40",
              reason && "cursor-not-allowed opacity-60 hover:border-border",
              (mode.id === "read" || mode.id === "quiz") && "sm:col-span-2",
            )}
          >
            <RadioGroupItem value={mode.id} disabled={Boolean(reason)} className="sr-only" />
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <ModeIcon icon={mode.icon} className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{mode.label}</span>
                <span className="shrink-0 text-sm font-medium text-primary">{formatDuration(estimates[mode.id])}</span>
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{reason ?? mode.description}</span>
            </span>
          </label>
        )
      })}
    </RadioGroup>
  )
}
