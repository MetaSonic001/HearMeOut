export type Mode = "read" | "translate" | "study" | "revision" | "explain" | "quiz"
export type PlanName = "anon" | "free" | "pro" | "admin"

export interface PlanLimits {
  name: PlanName
  label: string
  daily_minutes: number | null
  max_chars: number
  max_file_mb: number
  ai_docs_per_day: number | null
  ttl_days: number
  can_download: boolean
  has_feed: boolean
  max_ocr_pages: number
}

export interface Allowance {
  used_minutes: number
  limit_minutes: number | null
  remaining_minutes: number | null
  ai_docs_used: number
  ai_docs_limit: number | null
  resets_at: string
}

export interface Me {
  kind: "anon" | "user"
  plan: PlanName
  plan_label: string
  is_admin: boolean
  email: string | null
  name: string | null
  limits: PlanLimits
  allowance: Allowance
  plan_ends_at: string | null
  feed_url: string | null
  billing: boolean
}

export interface ModeInfo {
  id: Mode
  label: string
  description: string
  ai: boolean
  ratio: number
}

export interface LanguageInfo {
  code: string
  label: string
  native: string
  indian: boolean
  voice: string
  voice2: string
}

export interface AppConfig {
  llm: boolean
  ocr: boolean
  billing: boolean
  modes: ModeInfo[]
  languages: LanguageInfo[]
  plans: Record<string, PlanLimits>
}

export interface Voice {
  id: string
  name: string
  locale: string
  gender: string
  language: string
  featured: boolean
  /** How much the voice's pitch moves (measured): flat voices sound robotic over a long listen. Null when not measured. */
  expressive?: "high" | "medium" | "calm" | null
}

export interface DraftSection {
  idx: number
  title: string
  page_start: number | null
  page_end: number | null
  chars: number
}

export interface OcrProgress {
  stage: "queued" | "detecting" | "reading" | "building"
  done: number
  total: number
  script: string | null
  queued?: boolean
  seconds?: number
}

export interface Draft {
  id: string
  status: "ready" | "ocr" | "failed"
  error: string | null
  ocr: OcrProgress | null
  title: string
  source_type: string
  language: string
  page_count: number | null
  total_chars: number
  estimates: Record<Mode, number>
  warnings: string[]
  preview: string
  sections: DraftSection[]
  limits: { max_chars: number }
  expires_at: string
}

export interface DocSection {
  idx: number
  title: string
  page_start: number | null
  page_end: number | null
  first_chunk: number | null
  chunk_count: number
}

export interface Doc {
  id: string
  title: string
  source_type: string
  mode: Mode
  language: string
  voice: string
  voice2: string | null
  status: "processing" | "ready" | "failed"
  error: string | null
  est_seconds: number
  total_chunks: number | null
  total_sections: number
  scripted_sections: number
  page_count: number | null
  unlocked: boolean
  ai: boolean
  progress: { chunk: number; offset: number }
  created_at: string
  expires_at: string
  sections?: DocSection[]
  ready_chunks?: number
  allowance?: Allowance
  can_download?: boolean
}

export interface Chunk {
  idx: number
  text: string
  kind: "narration" | "question" | "answer"
  section: number
  page_start: number | null
  page_end: number | null
  pause_ms: number
  ready: boolean
  duration_ms: number | null
}

export interface DailyStat {
  date: string
  visitors: number
  pageviews: number
  docs: number
  signups: number
  minutes: number
  revenue: number
}

export interface TopItem {
  label: string
  count: number
}

export interface AdminStats {
  range_days: number
  totals: {
    visitors: number
    pageviews: number
    docs_created: number
    signups: number
    minutes_listened: number
    revenue: Record<string, number>
    users: number
    pro_users: number
    live_documents: number
  }
  daily: DailyStat[]
  funnel: { visitors: number; drafts: number; docs: number; plays: number; signups: number; purchases: number }
  top: Record<"pages" | "referrers" | "countries" | "devices" | "modes" | "languages" | "sources", TopItem[]>
  generated_at: string
}
