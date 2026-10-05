/** "1h 05m", "12m", "45s" — friendly durations for listening time. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  if (s < 60) return `${s}s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, "0")}m`
}

/** "3:07" or "1:02:45" — player clock. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n)
}

export function formatMoney(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(
      amountMinor / 100,
    )
  } catch {
    return `${(amountMinor / 100).toFixed(0)} ${currency}`
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, (now - new Date(iso).getTime()) / 1000)
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`
  return `${Math.floor(diff / 86400)} d ago`
}

export function timeUntil(iso: string, now = Date.now()): string {
  const diff = Math.max(0, (new Date(iso).getTime() - now) / 1000)
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))} min`
  if (diff < 86400) return `${Math.round(diff / 3600)} hours`
  return `${Math.round(diff / 86400)} days`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`
}

export function wordsFromChars(chars: number): number {
  return Math.round(chars / 5.7)
}
