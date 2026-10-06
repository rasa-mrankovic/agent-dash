import type { PaneCloseOrigin, SessionContextUsage, SessionRateLimit } from 'claude-code'

export type FilesDiff = {
  files: number,
  plus: number,
  minus: number,
}

export type Tokens = {
  input: number,
  output: number,
}

export type WorkingAgent = {
  state: 'working',
  type: string,
  startedAt: number,
}

export type DoneAgent = {
  state: 'done',
  type: string,
  startedAt: number,
  endedAt: number,
  result: string,
}

export type AgentEntry = WorkingAgent | DoneAgent

export type TaskEntry = {
  subject: string,
  owner: string,
  done: boolean,
}

export type ToolUse = {
  tool: string,
  detail: string,
  at: number,
}

export type LastTurn = {
  agentId: string | null,
  durationMs: number,
  at: number,
}

export type SnapshotUsage = {
  context: SessionContextUsage | null,
  rateLimits: SessionRateLimit[],
}

export type Snapshot = {
  id: string,
  cwd: string,
  model: string,
  worktree: string,
  pinned: boolean,
  updatedAt: number,
  ended: boolean,
  usage: SnapshotUsage | null,
  tokens: Tokens,
  diff: FilesDiff | null,
  agents: Record<string, AgentEntry>,
  tasks: Record<string, TaskEntry>,
  idleTeammates: Record<string, number>,
  lastTools: ToolUse[],
  lastTurn: LastTurn | null,
}

export type BackgroundSession = {
  kind: 'background',
  id: string,
  sessionId: string,
  cwd: string,
  name: string,
  startedAt: number,
  state: 'working' | 'blocked' | 'done' | 'stopped',
  waitingFor?: string,
}

export type InteractiveSession = {
  kind: 'interactive',
  pid: number,
  sessionId: string,
  cwd: string,
  name: string,
  startedAt: number,
  status: 'busy' | 'idle' | 'waiting',
  waitingFor?: string,
}

export type ListedSession = BackgroundSession | InteractiveSession

export type Group = 'Needs input' | 'Working' | 'Done'

export type Row = {
  key: string,
  id: string | null,
  sessionId: string | null,
  name: string,
  group: Group,
  summary: string,
  startedAt: number,
  snap: Snapshot | null,
}

export type View = 'list' | 'detail'

export type CloseKind = PaneCloseOrigin['kind'] | 'unknown'

export type MessageTarget = {
  sessionId: string,
  name: string,
}

export type Actions = {
  open: (r: Row) => void,
  back: () => void,
  toggleMessage: (r: Row) => void,
  stop: (r: Row) => Promise<void>,
  copyAttach: (r: Row) => Promise<void>,
  submit: (value: string) => Promise<void>,
}

export type ScreenModel = {
  w: number,
  rows: Row[],
  view: View,
  target: Row | null,
  limits: SessionRateLimit[],
  agentsError: string,
  messageTo: MessageTarget | null,
  note: string,
}
