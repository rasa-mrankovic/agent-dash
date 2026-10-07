// Pure text helpers. No mods API calls in this file.

const ANSI_ESCAPES = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[ -/]*[0-~])/g
const CONTROL_CHARS = /[\x00-\x1f\x7f-\x9f]/g

export function fit(text: string, width: number): string {
  const t = String(text || '').replace(ANSI_ESCAPES, '').replace(CONTROL_CHARS, ' ')
  if (width <= 0) return ''
  return t.length <= width ? t : t.slice(0, Math.max(0, width - 1)) + '…'
}

export function fmtTokens(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return Math.round(n / 1e3) + 'k'
  return String(n)
}

export function baseName(p: string): string {
  const parts = String(p || '').split('/').filter(Boolean)
  return parts[parts.length - 1] || 'session'
}

// A 0–100 percentage as filled and empty bar cells
export function bar(percent: number, cells: number): { filled: string, empty: string } {
  const p = Math.max(0, Math.min(100, Number(percent) || 0))
  const filled = Math.round((p / 100) * cells)
  return { filled: '█'.repeat(filled), empty: '░'.repeat(cells - filled) }
}

const KINDS: Record<string, string> = { five_hour: '5h', seven_day: 'week', seven_day_opus: 'week opus', seven_day_sonnet: 'week sonnet' }

export function kindLabel(kind: string): string {
  const k = String(kind || '').toLowerCase()
  return KINDS[k] || k.replace(/_/g, ' ') || 'limit'
}
