import type { ProcessRunResult } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const DASH = { command: 'dash', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const
const POLL_MS = 3000

const exited = (exitCode: number, stdout: string): { value: ProcessRunResult } => ({
  value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})

const finished = (agentId: string | undefined, answer: string) => ({
  agentId,
  answer,
  durationMs: 1200,
  isAborted: false,
  turnId: 'turn-' + (agentId || 'main'),
  reason: 'answer' as const,
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a spawned subagent shows in its session's agent list (${surface})`, async ($, on) => {
    const clock = mock.clock(on, { now: Date.now() })
    mock.store(on)
    const sessionId = 'sess-x'
    const listed = [{ id: 'aaaa1111', cwd: '/tmp/x', kind: 'background', startedAt: Date.now(), sessionId, name: 'story', state: 'working', status: 'busy' }]
    on('process.run', async (_$, e) => {
      if (e.argv.join(' ') === 'claude agents --json --all') return exited(0, JSON.stringify(listed))
      return exited(1, '')
    })
    on('session.start', async (_$, e) => ({ cwd: e.cwd }))
    on('session.id', async () => ({ value: sessionId }))
    on('session.cwd', async () => ({ value: '/tmp/x' }))
    on('session.model', async () => ({ value: 'claude-haiku-4-5' }))
    on('command.register', async (_$, e) => ({ value: { command: e.name } }))
    on('agent.spawn', async () => ({ model: 'claude-haiku-4-5', agentId: 'agent-1' }))
    on('turn.complete', async (_$, e) => ({ text: e.answer }))
    const ui = await $.ui.mount({
      plugin: 'agent-dash',
      surface,
      component: 'Pane',
      requestId: 'dash',
      props: { title: 'Agents', isFocused: true, bodyColumns: 62, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
    })
    const agentRow = async () => (await ui.find({ type: 'Text', text: 'Explore · ' }))?.text

    await $.session.start({ cwd: '/tmp/x', surface, isInteractive: true })
    await $.command.run(DASH)
    await ui.press({ key: 'row-' + sessionId })

    await $.agent.spawn({
      tool_use_id: 'toolu_1',
      prompt: 'find the callers of publish',
      description: 'find callers',
      subagentType: 'Explore',
      provider: { plugin: 'engine', tier: 'core' },
      parentModel: 'claude-haiku-4-5',
      background: false,
      fork: false,
    })
    await clock.advance(POLL_MS)
    expect(await agentRow(), 'the detail pane lists the spawned subagent as running').toBe('  └ ✽ Explore · running')

    await $.turn.complete(finished('agent-1', 'Found three callers\n  in register.ts'))
    await $.turn.complete(finished('agent-unspawned', 'a fork nobody spawned through the Agent tool'))
    await $.turn.complete(finished(undefined, 'the main loop answered'))
    await clock.advance(POLL_MS)
    expect(await agentRow(), 'the finished subagent shows its answer on one line').toBe('  └ ∙ Explore · Found three callers in register.ts')
    expect((await ui.find({ type: 'Text', text: /^ {2}agents \d+$/ }))?.text, 'turns of loops nobody spawned add no rows').toBe('  agents 1')
  })
}
