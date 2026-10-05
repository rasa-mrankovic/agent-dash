// Colors and glyphs shared by every screen of the pane.
// ACCENT recolors the title, the separator, working rows and limit bars.
export const ACCENT = '#574AE2'
export const WAITING = 'yellow'
export const DONE = 'green'
export const WARN = 'yellow'
export const DANGER = 'red'

export function glyphOf(group) {
  return group === 'Needs input' ? '✻' : group === 'Working' ? '✽' : '∙'
}

export function colorOf(group) {
  return group === 'Needs input' ? WAITING : group === 'Working' ? ACCENT : DONE
}
