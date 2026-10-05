// agent-dash — Claude Code mod (entry module)
// Reporter: every session publishes a snapshot to $.store, which all sessions on the machine share.
// Viewer: /dash opens a pinned pane. Esc only returns focus to the prompt; the pane stays open
// (and reopens itself if something else closes it) until you press Ctrl+X then X.
// Every mods API call lives in this file. ./lib holds pure helpers and the drawing code,
// because `claude plugin validate` rejects passing `$` into imported functions.
// Requires Claude Code v2.1.287+. Develop with: claude --plugin-dir ./agent-dash  →  /dash
import type { Register } from 'claude-code';
import { mergeRows, toolDetail, addTokens, trimAgents, EDIT_TOOLS } from './lib/rows.js'
import { screen } from './lib/views.js'
import { fit } from './lib/format.js'

const PANE = 'dash'
const PANE_COLUMNS = 64
const PREFIX = 's:'
const PUBLISH_MS = 2000
const POLL_MS = 3000
const DIFF_MS = 10000
const MAX_TOOLS = 6

// ---------- reporter state (this session) ----------
let sessionId = null
let sessionCwd = ''
let sessionModel = ''
let worktree = ''
const agents = {} // agent_id -> { type, state, startedAt, endedAt, result }
const tasks = {} // task_id -> { subject, owner, done }
const idleTeammates = {} // teammate_name -> timestamp
let lastTools = [] // newest first
let lastTurn = null
let tokens = { input: 0, output: 0 }
let diff = null // { files, plus, minus }
let diffDirty = true
let lastDiffAt = 0
let dirty = false

// ---------- viewer state ----------
let pinned = false // set by /dash, cleared only by a deliberate close
let paneOpen = false
let paneWaiting = false // opened by the mod but waiting for a wider terminal
let lastCloseKind = ''
let sessions = [] // rows from `claude agents --json --all`
let snapshots = {} // sessionId -> snapshot from $.store
let limits = [] // plan rate limits: [{ kind, percentUsed, resetsAt }]
let agentsError = ''
let view = 'list' // 'list' | 'detail'
let selected = null // row key
let mode = 'dispatch' // 'dispatch' | 'message'
let note = ''

export  const register:Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'dash', description: 'Open the agent dashboard (stays open until Ctrl+X then X)', immediate: true })
    sessionId = String(await $.session.id())
    sessionCwd = String(await $.session.cwd())
    sessionModel = String(await $.session.model())
    worktree = await detectWorktree($)
    pinned = await wasPinned($)
    dirty = true
    $.clock.every(PUBLISH_MS, () => publish($, false))
    $.clock.every(POLL_MS, () => tick($))
    return next(e)
  })

  on('command.run', { command: 'dash' }, async ($) => {
    pinned = true
    dirty = true
    view = 'list'
    await openPane($, true)
    await refresh($)
    return {}
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      paneOpen = false
      lastCloseKind = e.origin && e.origin.kind ? e.origin.kind : 'unknown'
      // Ctrl+X then X is a person closing it on purpose; anything else is reopened by tick()
      if (lastCloseKind === 'person') pinned = false
      dirty = true
    }
    return next(e)
  })

  // ---------- reporter hooks ----------
  on('classic.SubagentStart', async ($, e, next) => {
    const prev = agents[e.agent_id] || {}
    agents[e.agent_id] = { ...prev, type: e.agent_type, state: 'working', startedAt: prev.startedAt || Date.now() }
    dirty = true
    return next(e)
  })

  on('classic.SubagentStop', async ($, e, next) => {
    const prev = agents[e.agent_id] || { type: e.agent_type, startedAt: Date.now() }
    agents[e.agent_id] = {
      ...prev,
      state: 'done',
      endedAt: Date.now(),
      result: String(e.last_assistant_message || '').replace(/\s+/g, ' ').slice(0, 160),
    }
    dirty = true
    return next(e)
  })

  on('classic.TaskCreated', async ($, e, next) => {
    tasks[e.task_id] = { subject: e.task_subject || e.task_id, owner: e.teammate_name || '', done: false }
    dirty = true
    return next(e)
  })

  on('classic.TaskCompleted', async ($, e, next) => {
    const prev = tasks[e.task_id] || { subject: e.task_subject || e.task_id, owner: e.teammate_name || '' }
    tasks[e.task_id] = { ...prev, done: true }
    dirty = true
    return next(e)
  })

  on('classic.TeammateIdle', async ($, e, next) => {
    idleTeammates[e.teammate_name] = Date.now()
    dirty = true
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    lastTools = [{ tool: e.tool, detail: toolDetail(e), at: Date.now() }, ...lastTools].slice(0, MAX_TOOLS)
    if (EDIT_TOOLS.includes(e.tool)) diffDirty = true
    dirty = true
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    tokens = addTokens(tokens, e.usage)
    lastTurn = { agentId: e.agentId || null, durationMs: e.durationMs || 0, at: Date.now() }
    dirty = true
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    dirty = true
    await publish($, true)
    return next(e)
  })

  // ---------- viewer ----------
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    paneOpen = true
    paneWaiting = false
    const el = $.ui.resolve(e)
    const w = Math.max(32, Number(e.props.bodyColumns) || 60)
    const rows = mergeRows(sessions, snapshots).filter((r) => r.group !== 'Done')
    const target = rows.find((r) => r.key === selected) || null
    if (view === 'detail' && !target) view = 'list'
    const actions = {
      open: (r) => {
        selected = r.key
        view = 'detail'
        mode = 'dispatch'
        $.ui.invalidate('ui.render')
      },
      back: () => {
        view = 'list'
        selected = null
        mode = 'dispatch'
        $.ui.invalidate('ui.render')
      },
      toggleMessage: () => {
        mode = mode === 'message' ? 'dispatch' : 'message'
        $.ui.invalidate('ui.render')
      },
      stop: async (r) => {
        note = await stopSession($, r)
        await refresh($)
      },
      copyAttach: async (r) => {
        note = await copyAttach($, r)
        $.ui.invalidate('ui.render')
      },
      submit: async (value) => {
        note = await submitInput($, value, target)
        await refresh($)
      },
    }
    return screen(el, { w, rows, view, target, limits, agentsError, mode, note }, actions)
  })
}

// ---------- pane lifecycle ----------

async function openPane($, focus) {
  const pane = { id: PANE, title: 'Agents', columns: PANE_COLUMNS }
  try {
    const r = await $.ui.open(focus ? { ...pane, focus: true } : pane)
    paneOpen = !r || r.isPlaced !== false
    paneWaiting = !paneOpen
  } catch (err) {
    paneOpen = false
    paneWaiting = false
  }
}

// Runs every POLL_MS: reopen a pinned pane that something closed, then refresh the data
async function tick($) {
  if (pinned && !paneOpen && !paneWaiting) {
    await openPane($, false)
    if (paneOpen && lastCloseKind) note = 'reopened after a ' + lastCloseKind + ' close'
  }
  if (paneOpen) await refresh($)
}

async function wasPinned($) {
  try {
    const prev = await $.store.get(PREFIX + sessionId)
    return Boolean(prev && prev.pinned)
  } catch (err) {
    return false
  }
}

// ---------- reporter ----------

async function publish($, force) {
  if (!dirty && !force) return
  dirty = false
  if (!sessionId) return
  if (diffDirty && Date.now() - lastDiffAt > DIFF_MS) {
    diffDirty = false
    lastDiffAt = Date.now()
    diff = await readDiff($)
  }
  let usage = null
  try {
    usage = await $.session.usage()
  } catch (err) {
    usage = null
  }
  await $.store.set(PREFIX + sessionId, {
    id: sessionId,
    cwd: sessionCwd,
    model: sessionModel,
    worktree,
    pinned,
    updatedAt: Date.now(),
    ended: Boolean(force),
    usage: usage ? { context: usage.context || null, rateLimits: usage.rateLimits || [] } : null,
    tokens,
    diff,
    agents: trimAgents(agents),
    tasks,
    idleTeammates,
    lastTools,
    lastTurn,
  })
}

async function detectWorktree($) {
  const m = /\.claude\/worktrees\/([^/]+)/.exec(sessionCwd)
  if (m) return m[1]
  try {
    const r = await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])
    return r.exitCode === 0 ? r.stdout.trim() : ''
  } catch (err) {
    return ''
  }
}

async function readDiff($) {
  try {
    const r = await $.process.run(['git', 'diff', '--shortstat', 'HEAD'])
    if (r.exitCode !== 0) return null
    const files = /(\d+) files? changed/.exec(r.stdout)
    const plus = /(\d+) insertions?/.exec(r.stdout)
    const minus = /(\d+) deletions?/.exec(r.stdout)
    if (!files) return { files: 0, plus: 0, minus: 0 }
    return { files: Number(files[1]), plus: plus ? Number(plus[1]) : 0, minus: minus ? Number(minus[1]) : 0 }
  } catch (err) {
    return null
  }
}

// ---------- viewer data and actions ----------

async function refresh($) {
  try {
    const r = await $.process.run(['claude', 'agents', '--json', '--all'])
    if (r.exitCode === 0) {
      sessions = JSON.parse(r.stdout)
      agentsError = ''
    } else {
      agentsError = 'claude agents: ' + r.stderr.trim()
    }
  } catch (err) {
    agentsError = 'claude agents unavailable: ' + err.message
  }
  try {
    const usage = await $.session.usage()
    limits = usage && Array.isArray(usage.rateLimits) ? usage.rateLimits : []
  } catch (err) {
    limits = []
  }
  const found = {}
  try {
    const keys = await $.store.keys()
    for (const k of keys) {
      if (!String(k).startsWith(PREFIX)) continue
      const snap = await $.store.get(k)
      if (snap && snap.id) found[snap.id] = snap
    }
  } catch (err) {
    Object.assign(found, snapshots)
  }
  snapshots = found
  $.ui.invalidate('ui.render')
}

async function stopSession($, r) {
  if (!r.id) return 'interactive session: stop it from its own terminal'
  try {
    const res = await $.process.run(['claude', 'stop', r.id])
    return res.exitCode === 0 ? 'stopped ' + r.name : 'stop failed: ' + fit(res.stderr.trim(), 40)
  } catch (err) {
    return 'stop failed: ' + err.message
  }
}

async function copyAttach($, r) {
  const cmd = r.id ? 'claude attach ' + r.id : r.sessionId ? 'claude --resume ' + r.sessionId : ''
  if (!cmd) return 'nothing to attach to'
  await $.ui.copy(cmd)
  return 'copied: ' + cmd
}

async function submitInput($, value, target) {
  const text = String(value || '').trim()
  if (!text) return note
  if (mode === 'message' && target && target.sessionId) {
    mode = 'dispatch'
    const sent = await $.session.send({ to: { sessionId: target.sessionId }, text })
    return sent.isDelivered ? 'sent to ' + target.name : 'not delivered: ' + sent.reason
  }
  try {
    const r = await $.process.run(['claude', '--bg', text])
    return r.exitCode === 0 ? 'started: ' + fit(r.stdout.trim().split('\n')[0], 40) : 'start failed: ' + fit(r.stderr.trim(), 40)
  } catch (err) {
    return 'start failed: ' + err.message
  }
}
