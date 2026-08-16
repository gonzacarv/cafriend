/** Patrones de vibración por tipo de transición. */
const PATTERNS = {
  tick: [20],
  pour: [90, 60, 90],
  wait: [220],
  done: [120, 80, 120, 80, 300],
  tap: [12],
} as const

export type HapticKind = keyof typeof PATTERNS

export function vibrate(kind: HapticKind): void {
  try {
    navigator.vibrate?.([...PATTERNS[kind]])
  } catch {
    /* el navegador puede no soportarlo */
  }
}

export function stopVibration(): void {
  try {
    navigator.vibrate?.(0)
  } catch {
    /* ídem */
  }
}
