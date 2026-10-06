import type { RenderElement } from 'claude-code'
import { ACCENT } from './theme'
import type { PaneElements } from './types'

// figlet "standard" rendering of "rasa"
const ART = [
  ' _ __ __ _ ___  __ _ ',
  "| '__/ _` / __|/ _` |",
  '| | | (_| \\__ \\ (_| |',
  '|_|  \\__,_|___/\\__,_|',
] as const

// Title shared by the list and detail screens: the art (or plain "rasa" in a narrow pane),
// then a separator of "=" as wide as the pane
export function titleRows(Text: PaneElements['Text'], w: number): RenderElement[] {
  const art =
    w < ART[0].length + 2
      ? [Text({ bold: true, color: ACCENT, children: ['rasa'] })]
      : ART.map((line) => Text({ color: ACCENT, children: [line] }))
  return [...art, Text({ color: ACCENT, wrap: 'truncate', children: ['='.repeat(w)] })]
}
