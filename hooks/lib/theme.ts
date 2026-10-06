import type { Group } from './types'

// Colors and glyphs shared by every screen of the pane.
// ACCENT recolors the title, the separator, working rows and limit bars.
export const ACCENT = '#E75B91'
export const WAITING = 'yellow'
export const DONE = 'green'
export const WARN = 'yellow'
export const DANGER = 'red'

export function glyphOf(group: Group): string {
  return group === 'Needs input' ? '✻' : group === 'Working' ? '✽' : '∙'
}

export function colorOf(group: Group): string {
  return group === 'Needs input' ? WAITING : group === 'Working' ? ACCENT : DONE
}
