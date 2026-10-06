import type { ButtonProps, RenderElement, SessionRateLimit } from 'claude-code'
import { ACCENT, WAITING, WARN, DANGER, glyphOf, colorOf } from './theme'
import { fit, ago, bar, kindLabel, untilText } from './format'
import { titleRows } from './title'
import { miniInfo } from './rows'
import type { Actions, PaneElements, Row, ScreenModel } from './types'

// Drawing code. No mods API calls in this file: `el` holds the element functions
// from $.ui.resolve(e), and `actions` holds callbacks built in register.ts.

export function screen(el: PaneElements, model: ScreenModel, actions: Actions): RenderElement {
  const { Box, Text } = el
  const { w, rows, view, target, limits, agentsError, note } = model
  const children = [...titleRows(Text, w), ...statusRows(el, rows, limits, w)]

  if (view === 'detail' && target)
    children.push(...detailRows(el, target, w, actions))
  else children.push(...listRows(el, rows, w, actions, agentsError))

  children.push(...newSessionRows(el, w, model, actions));

  if (note) children.push(Text({ dimColor: true, children: [fit(note, w)] }))

  return Box({ flexDirection: 'column', children })
}

// Counts on the first line, then one line per plan limit
function statusRows(el: PaneElements, rows: Row[], limits: SessionRateLimit[], w: number): RenderElement[] {
  const { Box, Text } = el
  const needInput = rows.filter((r) => r.group === 'Needs input').length
  const sessionLines = [
    lineSeparator(el, w),
    Box({
      flexDirection: 'column',
      children: [
        Text({ bold: true, children: ['Sessions breakdown:'] }),
        Box({
          flexDirection: "row",
          children: [
            Text({ color: WAITING, children: ['✻ '] }),
            Text({ children: [needInput + ' need input'] }),
            Text({ dimColor: true, children: [' • ']}),
            Text({ color: ACCENT, children: ['✽ '] }),
            Text({ children: [rows.length - needInput + ' working'] }),
          ],
        }),

      ],
    }),
    lineSeparator(el, w, true)
  ]

  const limitLines = [Text({ bold: true, children: ['Usage limits:'] })]
  for (const l of limits) {
    const pct = Math.round(Number(l.percentUsed) || 0)
    const b = bar(pct, 10)
    const tone = pct >= 95 ? DANGER : pct >= 80 ? WARN : ACCENT
    limitLines.push(
      Box({
        flexDirection: 'row',
        children: [
          Text({ dimColor: true, children: [kindLabel(l.kind).padEnd(11)] }),
          Box({ flexDirection: 'row', children: [Text({ color: tone, children: [b.filled] }), Text({ dimColor: true, children: [b.empty] })] }),
          Text({ children: [String(pct).padStart(3) + '% '] }),
          Text({ dimColor: true, children: [fit(untilText(l.resetsAt), Math.max(0, w - 29))] }),
        ],
      }),
    )
  }
  return [lineSeparator(el, w),...limitLines, ...sessionLines]
}

function listRows(el: PaneElements, rows: Row[], w: number, actions: Actions, agentsError: string): RenderElement[] {
  const { Box, Text, Button } = el
  const out: RenderElement[] = []
  if (rows.length === 0) out.push(Text({ dimColor: true, children: ['No active sessions. Type a task below to start one.'] }))
  rows.forEach((r, i) => {
    const button: ButtonProps = { key: 'row-' + r.key, plain: true, label: fit(r.name, Math.max(10, w - 10)), onPress: () => actions.open(r) }
    if (i < 9) button.hotkey = String(i + 1)
    out.push(
      Box({
        flexDirection: 'row',
        columnGap: 1,
        children: [Text({ color: colorOf(r.group), children: [glyphOf(r.group)] }), Button(button), Text({ dimColor: true, children: [ago(r.startedAt)] })],
      }),
    )
    out.push(Text({ dimColor: true, children: [fit('  ' + miniInfo(r), w)] }))
  })
  if (agentsError) out.push(Text({ dimColor: true, children: [fit(agentsError, w)] }))
  return out
}

function detailRows(el: PaneElements, r: Row, w: number, actions: Actions): RenderElement[] {
  const { Box, Text, Button } = el
  const out: RenderElement[] = []
  const snap = r.snap
  out.push(
    Box({
      flexDirection: 'row',
      columnGap: 1,
      children: [
        Text({ color: colorOf(r.group), children: [glyphOf(r.group)] }),
        Text({ bold: true, children: [fit(r.name, Math.max(10, w - 20))] }),
        Text({ dimColor: true, children: [fit(r.summary, 24)] }),
        Text({ dimColor: true, children: [ago(r.startedAt)] }),
      ],
    }),
  )
  out.push(Text({ dimColor: true, children: [fit('  ' + miniInfo(r), w)] }))
  if (snap) {
    const ctx = snap.usage && snap.usage.context ? snap.usage.context.percent : null
    out.push(Text({ dimColor: true, children: [fit('  ' + [snap.model, ctx === null ? null : 'ctx ' + ctx + '%'].filter(Boolean).join(' · '), w)] }))
    const list = Object.entries(snap.agents || {}).sort((x, y) => (x[1].startedAt || 0) - (y[1].startedAt || 0))
    if (list.length > 0) out.push(Text({ bold: true, children: ['  agents ' + list.length] }))
    list.forEach(([id, a], i) => {
      const tee = i === list.length - 1 ? '└' : '├'
      const glyph = a.state === 'done' ? '∙' : '✽'
      const tail = a.state === 'done' ? a.result || 'done' : 'running'
      out.push(Text({ children: [fit('  ' + tee + ' ' + glyph + ' ' + (a.type || id) + ' · ' + tail, w)] }))
    })
    const taskList = Object.values(snap.tasks || {})
    if (taskList.length > 0) {
      const done = taskList.filter((t) => t.done).length
      out.push(Text({ bold: true, children: ['  tasks ' + done + '/' + taskList.length] }))
      for (const t of taskList.slice(0, 8)) {
        out.push(Text({ dimColor: t.done, children: [fit('  [' + (t.done ? 'x' : ' ') + '] ' + t.subject + (t.owner ? ' · ' + t.owner : ''), w)] }))
      }
    }
  }
  out.push(
    Box({
      flexDirection: 'row',
      columnGap: 2,
      children: [
        Button({ key: 'back-' + r.key, plain: true, hotkey: 'b', label: 'back', onPress: () => actions.back() }),
        Button({ key: 'msg-' + r.key, plain: true, hotkey: 'm', label: 'message', onPress: () => actions.toggleMessage(r) }),
        Button({ key: 'stop-' + r.key, plain: true, hotkey: 'x', label: 'stop', onPress: () => actions.stop(r) }),
        Button({ key: 'attach-' + r.key, plain: true, hotkey: 'a', label: 'copy attach', onPress: () => actions.copyAttach(r) }),
      ],
    }),
  )
  return out
}

function newSessionRows(el: PaneElements, w: number, model: ScreenModel, actions: Actions): RenderElement[] {
  const { Text } = el;
  return [
    lineSeparator(el, w),
    Text({ bold: true, children: ["Spawn new session:"]}),
    inputRow(el, model, actions)
  ]
}

function inputRow(el: PaneElements, model: ScreenModel, actions: Actions): RenderElement {
  const { Input } = el
  const to = model.messageTo
  return Input({
    key: 'cmd',
    label: to ? fit('msg ' + to.name, 24) : 'new',
    placeholder: to ? 'message, Enter to send' : 'task for a new background session',
    value: '',
    submitLabel: to ? 'send' : 'start',
    onSubmit: (value) => actions.submit(value),
  })
}

function lineSeparator(el: PaneElements, w: number, dim = false): RenderElement {
  const { Box, Text } = el;

  return Box({
    flexDirection: 'row',
    children: [
      Text({
        dimColor: dim,
        children: ["_".repeat(w)]
      })
    ],
  })
}
