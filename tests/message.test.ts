import type { ProcessRunResult } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const DASH = { command: 'dash', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const

const exited = (exitCode: number, stdout: string): { value: ProcessRunResult } => ({
  value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a message keeps its recipient after the session finishes (${surface})`, async ($, on) => {
    mock.clock(on, { now: Date.now() })
    const listed = [{ id: 'aaaa1111', cwd: '/tmp/x', kind: 'background', startedAt: Date.now(), sessionId: 'sess-x', name: 'story', state: 'working', status: 'busy' }]
    const started: string[] = []
    const sent: { to: string; text: string }[] = []
    on('process.run', async (_$, e) => {
      if (e.argv.join(' ') === 'claude agents --json --all') return exited(0, JSON.stringify(listed))
      if (e.argv[0] === 'claude' && e.argv[1] === '--bg') {
        started.push(e.argv.join(' '))
        return exited(0, 'backgrounded · bbbb2222\n')
      }
      return exited(1, '')
    })
    on('session.send', async (_$, e) => {
      sent.push({ to: e.to, text: e.text })
      return { isDelivered: true }
    })
    const ui = await $.ui.mount({
      plugin: 'agent-dash',
      surface,
      component: 'Pane',
      requestId: 'dash',
      props: { title: 'Agents', isFocused: true, bodyColumns: 62, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
    })
    const label = async () => (await ui.find({ type: 'Input', key: 'cmd' }))?.props.label

    await $.command.run(DASH)
    await ui.press({ key: 'row-sess-x' })
    await ui.press({ key: 'msg-sess-x' })
    expect(await label(), 'the message button addresses the Input to the session').toBe('msg story')

    listed[0] = { ...listed[0], state: 'done', status: 'idle' }
    await $.command.run(DASH)
    expect(await label(), 'the Input still addresses the session after it finishes').toBe('msg story')

    await ui.input({ key: 'cmd', text: 'reply from the pane', kind: 'submit' })
    expect(sent, 'the reply reaches the session it was typed for').toEqual([{ to: 'sess-x', text: 'reply from the pane' }])
    expect(started, 'the reply starts no background session').toEqual([])
    expect((await ui.find({ type: 'Text', text: 'sent to ' }))?.text, 'the note names the recipient').toBe('sent to story')
    expect(await label(), 'the Input starts sessions again after one message').toBe('new')
  })
}
