# agent-dash — execution plan

A Claude Code mod that shows sessions, subagents and agent teams in a terminal side pane.
Open with `/dash`. Requires Claude Code v2.1.287+ with agent view available (`claude agents`).

## Run it now (no model tokens)

```bash
claude plugin validate ./agent-dash        # static check: hooks and API calls
cd <a repo>
claude --plugin-dir /path/to/agent-dash     # loads the mod for this session
/dash                                       # inside the session
```

Keep developing against `--plugin-dir`. An installed copy is cached by version until you bump `version` in `.claude-plugin/plugin.json`.

## Pane layout (≈ 60 columns, docked beside the transcript)

Main screen: active sessions only (working or waiting on you), one mini-info line each.
Accent color #574AE2 (`hooks/lib/theme.js`).

```
 _ __ __ _ ___  __ _
| '__/ _` / __|/ _` |
| | | (_| \__ \ (_| |
|_|  \__,_|___/\__,_|
============================================================
✻ 1 need input ✽ 2 working
5h          ████░░░░░░  41% resets in 2h 13m
week        ████████░░  82% resets in 3d 3h
✻ 1: auth-token-refresh                              4m
  agents 0/1 · 18k tok · wt main
✽ 2: flow-validation-v2                              18m
  agents 1/3 · 1.9M tok · wt flows-v2 · +412 −96 (9 files)
new: task for a new background session      ⏎ start
```

Detail screen (digit or Enter on a row): same title, separator and limits, then the session line, mini info, model/context, agents, tasks, recent tools, and `b: back  m: message  x: stop  a: copy attach`.

The pane is pinned once `/dash` runs: Esc only returns focus to the prompt, and if anything else closes it (a dialog, a reload) it reopens within 3s. Ctrl+X then X closes it for good. A pane the mod reopens by itself needs a terminal at least 110 columns wide; narrower, it waits until you run `/dash` again or widen the window.

## Files

- `hooks/register.ts`: entry module. Every hook and every mods API call (the validator rejects passing `$` into imported functions).
- `hooks/lib/views.js`: list and detail screens, header and stacked limits.
- `hooks/lib/title.js`: rasa ASCII title and the `=` separator.
- `hooks/lib/rows.js`: joins `claude agents --json` with snapshots; mini-info line.
- `hooks/lib/format.js`, `hooks/lib/theme.js`: text helpers, colors and glyphs.

## Budget rules (every phase)

- Before any Claude Code work run `/usage`. Stop if the 5-hour window is above 80% or the weekly limit above 85%. The pane's `limit` number shows the same figure while a session is open.
- Default worker is `dash-builder` (Sonnet). Use `dash-architect` (Opus) only for items marked **Opus**.
- One subagent at a time, in the foreground. No agent teams for this build.
- One fix iteration per task. If it still fails, the worker writes NOTES.md and stops.
- On any rate-limit message, stop immediately. Resume later with: "continue PLAN.md from phase N".
- Extra usage is an account setting, not something a session can spend; keep it off in your account.

## Phases

### Phase 1 — Sonnet — validate and smoke test
1. Run `claude plugin validate ./agent-dash`; fix any static-analysis error in `hooks/register.ts`.
2. Load with `--plugin-dir`, run `/dash`. Accept: this session appears under Working or Done.
3. Ask Claude to spawn an Explore subagent on something trivial. Accept: it appears under the session within ~2s, flips to `∙` with a result when it stops.
4. Dispatch a tiny task from the pane input. Accept: a new row appears; `x` stops it.

### Phase 2 — Sonnet — fit the pane
1. Truncation and widths at 40, 60 and 90 `bodyColumns`; nothing wraps.
2. Done group collapsed to 5 rows with "… N more"; newest first.
3. Replace `$.ui.copy` fallback text when the clipboard is unavailable.
4. `ui.close` clears `paneOpen` so polling stops when the pane is closed.

### Phase 3 — **Opus** — the hard parts
1. Teammate identity: `SubagentStart` gives `agent_id`/`agent_type`, while `TaskCreated`/`TeammateIdle` give names. Map them (try `$.agent.list()`), so teammates show by name under a `◇ team` node.
2. Split-pane teams: teammates run as separate processes and publish their own snapshots. Group them under the lead (shared cwd + spawn time, or a team marker written by the lead's `agent.spawn` hook).
3. Store safety: one key per session, re-read before write, prune snapshots older than 24h on `/dash` open, stay well under the 4 MiB store limit.
4. PR status: watch Bash `tool.call` for `gh pr create` / `git push` output and show `#1234` on the row.

### Phase 4 — Sonnet — tests and release
1. `tests/dash.test.ts` with `claude plugin test`: a `tool.call` updates the snapshot; `/dash` opens the pane. Docs: https://code.claude.com/docs/en/plugins/mods/test
2. README with the Claude Code version tested, install steps, keys.
3. Bump to 0.2.0; optional: add to a team marketplace.

## Kick-off prompt (paste at the repo root)

```
Read PLAN.md. Run /usage first and stop if we are over the budget thresholds.
Work through the phases in order using the dash-builder subagent, one task at a time in the foreground.
Use dash-architect only for Phase 3 items. After each phase run `claude plugin validate ./agent-dash`
and report in 5 lines or fewer. If you see any rate-limit message, stop and tell me where you are.
```

## Known gaps

- `team_name` in hook inputs is deprecated; don't rely on it.
- Interactive sessions have no short id, so `stop` works only for background sessions.
- Panes draw only in the terminal and the Desktop app's Code tab, not in the VS Code extension or `claude -p`.
