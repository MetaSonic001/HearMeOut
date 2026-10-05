"use client"

import { ListIcon, Loader2Icon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import type { DocSection } from "@/lib/api/types"
import { cn } from "@/lib/utils"

interface ChaptersSheetProps {
  sections: DocSection[]
  currentSection: number
  onJump: (firstChunk: number) => void
}

export function ChaptersSheet({ sections, currentSection, onJump }: ChaptersSheetProps) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="sm" aria-label="Chapters">
            <ListIcon /> <span className="hidden sm:inline">Chapters</span>
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Chapters</SheetTitle>
          <SheetDescription>{sections.length} sections. Tap one to jump there.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] px-4">
          <ol className="space-y-1 pb-8">
            {sections.map((s) => {
              const ready = s.first_chunk !== null
              return (
                <li key={s.idx}>
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() => {
                      if (s.first_chunk !== null) {
                        onJump(s.first_chunk)
                        setOpen(false)
                      }
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors hover:bg-muted disabled:opacity-60",
                      s.idx === currentSection && "bg-accent font-medium text-accent-foreground",
                    )}
                  >
                    <span className="w-6 shrink-0 text-muted-foreground">{s.idx + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    {!ready ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" /> : s.page_start != null && <span className="shrink-0 text-xs text-muted-foreground">p. {s.page_start}</span>}
                  </button>
                </li>
              )
            })}
          </ol>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
