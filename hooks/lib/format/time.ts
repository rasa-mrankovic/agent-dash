export function ago(ms: number): string {
  if (!ms) return ''
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (s < 60) return s + 's'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  return Math.floor(s / 3600) + 'h'
}

// Elapsed time with one finer unit: 42s, 3m 07s, 1h 05m
export function duration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return s + 's'
  if (s < 3600) return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's'
  return Math.floor(s / 3600) + 'h ' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + 'm'
}

// resetsAt may be epoch seconds, epoch milliseconds, or an ISO date string
export function untilText(resetsAt: string | number | null | undefined): string {
  const raw = String(resetsAt === undefined || resetsAt === null ? '' : resetsAt).trim()
  if (!raw) return ''
  let t = /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : Date.parse(raw)
  if (!Number.isFinite(t)) return ''
  if (t < 1e12) t *= 1000
  const s = Math.max(0, Math.floor((t - Date.now()) / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return 'resets in ' + d + 'd ' + h + 'h'
  if (h > 0) return 'resets in ' + h + 'h ' + m + 'm'
  return 'resets in ' + m + 'm'
}
