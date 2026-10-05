// Pure text helpers. No mods API calls in this file.

export function fit(text, width) {
  const t = String(text || '')
  if (width <= 0) return ''
  return t.length <= width ? t : t.slice(0, Math.max(0, width - 1)) + '…'
}

export function ago(ms) {
  if (!ms) return ''
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (s < 60) return s + 's'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  return Math.floor(s / 3600) + 'h'
}

export function fmtTokens(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return Math.round(n / 1e3) + 'k'
  return String(n)
}

export function baseName(p) {
  const parts = String(p || '').split('/').filter(Boolean)
  return parts[parts.length - 1] || 'session'
}

// A 0–100 percentage as filled and empty bar cells
export function bar(percent, cells) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0))
  const filled = Math.round((p / 100) * cells)
  return { filled: '█'.repeat(filled), empty: '░'.repeat(cells - filled) }
}

const KINDS = { five_hour: '5h', seven_day: 'week', seven_day_opus: 'week opus', seven_day_sonnet: 'week sonnet' }

export function kindLabel(kind) {
  const k = String(kind || '').toLowerCase()
  return KINDS[k] || k.replace(/_/g, ' ') || 'limit'
}

// resetsAt may be epoch seconds, epoch milliseconds, or an ISO date string
export function untilText(resetsAt) {
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
