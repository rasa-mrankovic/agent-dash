import type { ProcessRunResult } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const BG_STDOUT =
  'backgrounded · \x1b[36meb4f32d5\x1b[39m\n' +
  '\x1b[2m  claude agents             list sessions\x1b[22m\n' +
  '\x1b[2m  claude attach eb4f32d5    open in this terminal\x1b[22m\n' +
  '\x1b[2m  claude logs eb4f32d5      show recent output\x1b[22m\n' +
  '\x1b[2m  claude stop eb4f32d5      stop this session\x1b[22m\n'

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/

const exited = (exitCode: number, stdout: string): { value: ProcessRunResult } => ({
  value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})

function strings(node: unknown): string[] {
  if (typeof node === 'string') return [node]
  if (node && typeof node === 'object') return Object.values(node).flatMap(strings)
  return []
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the pane stays drawn after a dispatch with coloured CLI output (${surface})`, async ($, on) => {
    on('process.run', async (_$, e) => {
      if (e.argv[0] === 'claude' && e.argv[1] === '--bg') return exited(0, BG_STDOUT)
      if (e.argv.join(' ') === 'claude agents --json --all') return exited(0, '[]')
      return exited(1, '')
    })
    const ui = await $.ui.mount({
      plugin: 'agent-dash',
      surface,
      component: 'Pane',
      requestId: 'dash',
      props: { title: 'Agents', isFocused: true, bodyColumns: 62, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
    })

    await ui.input({ key: 'cmd', text: '/pstack:poteto-mode say hi', kind: 'submit' })

    const refusal = await ui.drawn().then(() => '', (err) => String(err))
    expect(refusal, 'the engine draws the pane tree after the dispatch').toBe('')
    const tree = await ui.drawn()
    expect(strings(tree).filter((s) => CONTROL.test(s)), 'no drawn string holds a control character').toEqual([])
    const note = await ui.find({ type: 'Text', text: 'started: ' })
    expect(note?.text, 'the note names the dispatched session').toBe('started: backgrounded · eb4f32d5')
  })
}
