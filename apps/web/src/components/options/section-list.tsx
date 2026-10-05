"use client"

import { Loader2Icon, PencilIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { useSession } from "@/components/providers/session-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/api/client"
import type { Draft, DraftSection } from "@/lib/api/types"
import { formatNumber } from "@/lib/format"

interface SectionListProps {
  draft: Draft
  selected: Set<number>
  onToggle: (idx: number) => void
  onSelectAll: (all: boolean) => void
  onDraftChange: (draft: Draft) => void
}

function pages(s: DraftSection): string | null {
  if (s.page_start == null) return null
  return s.page_end && s.page_end !== s.page_start ? `pp. ${s.page_start}–${s.page_end}` : `p. ${s.page_start}`
}

export function SectionList({ draft, selected, onToggle, onSelectAll, onDraftChange }: SectionListProps) {
  const { api } = useSession()
  const [editing, setEditing] = useState<DraftSection | null>(null)
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function openEditor(section: DraftSection) {
    setEditing(section)
    setTitle(section.title)
    setText("")
    setLoading(true)
    try {
      const res = await api.request<{ text: string }>(`/v1/drafts/${draft.id}/sections/${section.idx}`)
      setText(res.text)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load this section.")
      setEditing(null)
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      const updated = await api.request<Draft>(`/v1/drafts/${draft.id}/sections/${editing.idx}`, {
        method: "PUT",
        json: { title, text },
      })
      onDraftChange(updated)
      setEditing(null)
      toast.success("Section updated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save your changes.")
    } finally {
      setSaving(false)
    }
  }

  const allSelected = selected.size === draft.sections.length

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selected.size} of {draft.sections.length} sections selected
        </p>
        <Button variant="ghost" size="sm" onClick={() => onSelectAll(!allSelected)}>
          {allSelected ? "Clear all" : "Select all"}
        </Button>
      </div>
      <ul className="max-h-96 divide-y overflow-y-auto rounded-xl border bg-card">
        {draft.sections.map((s) => (
          <li key={s.idx} className="flex items-center gap-3 px-3 py-2.5">
            <Checkbox checked={selected.has(s.idx)} onCheckedChange={() => onToggle(s.idx)} aria-label={`Include ${s.title}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{s.title}</p>
              <p className="text-xs text-muted-foreground">
                {[pages(s), `${formatNumber(Math.round(s.chars / 5.7))} words`].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void openEditor(s)} aria-label={`Edit ${s.title}`}>
              <PencilIcon /> Edit
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && !saving && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit section</DialogTitle>
            <DialogDescription>Fix anything that was read wrongly. Blank lines separate paragraphs.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Section title" />
            {loading ? (
              <div className="flex h-60 items-center justify-center text-muted-foreground">
                <Loader2Icon className="animate-spin" />
              </div>
            ) : (
              <Textarea value={text} onChange={(e) => setText(e.target.value)} className="h-72 resize-none" aria-label="Section text" />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving || loading || text.trim().length === 0}>
              {saving && <Loader2Icon className="animate-spin" />} Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
