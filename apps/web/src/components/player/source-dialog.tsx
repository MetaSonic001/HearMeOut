"use client"

import { FileSearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { Chunk, DocSection } from "@/lib/api/types"

interface SourceDialogProps {
  chunk: Chunk | undefined
  section: DocSection | undefined
  aiMode: boolean
}

export function SourceDialog({ chunk, section, aiMode }: SourceDialogProps) {
  const pages =
    chunk?.page_start != null
      ? chunk.page_end && chunk.page_end !== chunk.page_start
        ? `pages ${chunk.page_start}–${chunk.page_end}`
        : `page ${chunk.page_start}`
      : null
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" aria-label="Show source" disabled={!chunk}>
            <FileSearchIcon /> <span className="hidden sm:inline">Source</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Where this comes from</DialogTitle>
          <DialogDescription>
            {section ? `${section.title}. ` : ""}
            {pages ? `Your original document, ${pages}.` : "This document has no page numbers, but the section is shown above."}
          </DialogDescription>
        </DialogHeader>
        {chunk && (
          <div className="space-y-3">
            <p className="transcript max-h-64 overflow-y-auto rounded-xl bg-muted/60 p-4 text-base">{chunk.text}</p>
            {aiMode && (
              <p className="text-xs text-muted-foreground">
                This is the text being spoken, prepared from {pages ?? "this section"}. Check your original for exact wording.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
