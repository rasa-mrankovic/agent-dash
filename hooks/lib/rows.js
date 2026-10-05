import { baseName, fmtTokens } from './format.js'

// Pure data shaping. No mods API calls in this file.

export const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash']

export function toolDetail(e) {
  const v = e.command || e.file_path || e.pattern || e.query || e.description || e.prompt || ''
  return String(v).replace(/\s+/g, ' ').slice(0, 80)
}

export function addTokens(tokens, usage) {
  if (!usage) return tokens
  const input = Number(usage.input_tokens || 0) + Number(usage.cache_read_input_tokens || 0) + Number(usage.cache_creation_input_tokens || 0)
  const output = Number(usage.output_tokens || 0)
  return { input: tokens.input + input, output: tokens.output + output }
}

// Keep every running agent and the 10 most recently finished ones, so the store stays small
export function trimAgents(agents) {
  const entries = Object.entries(agents)
  const running = entries.filter(([, a]) => a.state !== 'done')
  const done = entries
    .filter(([, a]) => a.state === 'done')
    .sort((x, y) => (y[1].endedAt || 0) - (x[1].endedAt || 0))
    .slice(0, 10)
  return Object.fromEntries([...running, ...done])
}

// Join `claude agents --json --all` rows with reporter snapshots; waiting sessions first
export function mergeRows(sessions, snapshots) {
  const rows = []
  const seen = new Set()
  for (const s of sessions) {
    const snap = s.sessionId ? snapshots[s.sessionId] : null
    seen.add(s.sessionId)
    rows.push({
      key: s.sessionId || s.id || s.cwd + ':' + s.startedAt,
      id: s.id || null,
      sessionId: s.sessionId || null,
      name: s.name || baseName(s.cwd),
      group: groupOf(s),
      summary: summaryOf(s, snap),
      startedAt: s.startedAt,
      snap,
    })
  }
  // sessions only the store knows about, for example when `claude agents` is unavailable
  for (const snap of Object.values(snapshots)) {
    if (seen.has(snap.id) || snap.ended) continue
    rows.push({
      key: snap.id,
      id: null,
      sessionId: snap.id,
      name: baseName(snap.cwd),
      group: Date.now() - snap.updatedAt < 60000 ? 'Working' : 'Done',
      summary: snap.lastTools && snap.lastTools[0] ? snap.lastTools[0].tool + ' ' + snap.lastTools[0].detail : '',
      startedAt: snap.updatedAt,
      snap,
    })
  }
  rows.sort((a, b) => (a.group === b.group ? 0 : a.group === 'Needs input' ? -1 : 1))
  return rows
}

function groupOf(s) {
  if (s.state === 'blocked' || s.status === 'waiting') return 'Needs input'
  if (s.state === 'working' || s.status === 'busy') return 'Working'
  return 'Done'
}

function summaryOf(s, snap) {
  if (s.waitingFor) return s.waitingFor
  if (snap && snap.lastTools && snap.lastTools[0]) return snap.lastTools[0].tool + ' ' + snap.lastTools[0].detail
  return s.state || s.status || ''
}

// The line under each session: agents, tasks, tokens, worktree, diff
export function miniInfo(r) {
  const snap = r.snap
  if (!snap) return 'no reporter snapshot yet'
  const parts = []
  const list = Object.values(snap.agents || {})
  if (list.length > 0) parts.push('agents ' + list.filter((a) => a.state !== 'done').length + '/' + list.length)
  const taskList = Object.values(snap.tasks || {})
  if (taskList.length > 0) parts.push('tasks ' + taskList.filter((t) => t.done).length + '/' + taskList.length)
  if (snap.tokens && snap.tokens.input + snap.tokens.output > 0) parts.push(fmtTokens(snap.tokens.input + snap.tokens.output) + ' tok')
  if (snap.worktree) parts.push('wt ' + snap.worktree)
  if (snap.diff && snap.diff.files > 0) parts.push('+' + snap.diff.plus + ' −' + snap.diff.minus + ' (' + snap.diff.files + ' files)')
  return parts.length > 0 ? parts.join(' · ') : 'no activity yet'
}
