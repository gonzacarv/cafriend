export const SCHEMA_VERSION = 2

export type BrewMethod = 'espresso' | 'v60'

export type GrindEntry = {
  id: string
  /** Entero 0 (más fino) .. 100 (más grueso). */
  value: number
  /** ISO datetime del cambio. */
  at: string
  note?: string
}

export type GrindTrack = {
  /** Espejo de history[0].value. Se recalcula al editar/borrar entradas. */
  current: number
  /** Más reciente primero. */
  history: GrindEntry[]
}

export type Coffee = {
  id: string
  brand: string
  type: string
  /** ISO-3166 alpha-2, en mayúsculas. '' si no se especificó. */
  countryCode: string
  /** ISO date (YYYY-MM-DD). '' si no se especificó. */
  roastDate: string
  status: 'active' | 'finished'
  createdAt: string
  updatedAt: string
  finishedAt?: string
  grind: Partial<Record<BrewMethod, GrindTrack>>
}

/**
 * Cómo se ocupa la ventana de tiempo de un vertido.
 *
 * No es un detalle de presentación: es la diferencia entre las escuelas. Rao
 * vierte continuo a propósito después del bloom; Kasuya pulsa y espera a que
 * el lecho casi drene. El bloom es pulsado siempre, en las tres.
 */
export type PourStyle = 'pulse' | 'continuous'

export type Step =
  | {
      id: string
      kind: 'bloom' | 'pour'
      label: string
      startSec: number
      endSec: number
      /** Fracción acumulada del agua total al terminar el paso (0..1). */
      cumulative: number
      /** 'pulse' vierte a `flowRate` y espera el resto; 'continuous' llena la ventana. */
      style: PourStyle
    }
  | { id: string; kind: 'wait'; label: string; startSec: number; endSec: number }
  | { id: string; kind: 'drawdown'; label: string; startSec: number; maxEndSec: number }

export type Recipe = {
  id: string
  name: string
  author?: string
  /** ml de agua total por gramo de café. 15 = ratio 1:15. */
  ratio: number
  /** g/s de referencia para los pasos pulsados. */
  flowRate: number
  steps: Step[]
  notes?: string
  createdAt: string
  updatedAt: string
}

/** Caudal cómodo de una pava de cuello de ganso. */
export const DEFAULT_FLOW_RATE = 6

/** Por encima de esto ninguna pava vierte de forma controlada. */
export const MAX_FLOW_RATE = 8

export type Settings = {
  sound: boolean
  haptics: boolean
  /** ml de agua retenidos por gramo de café molido. */
  absorptionMlPerG: number
  /** ISO datetime del último export, para el aviso de respaldo. */
  lastExportAt?: string
}

export type Store = {
  schemaVersion: number
  coffees: Coffee[]
  recipes: Recipe[]
  settings: Settings
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  haptics: true,
  absorptionMlPerG: 2,
}

export const GRIND_MIN = 0
export const GRIND_MAX = 100

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Los pasos con objetivo de peso; los `wait`/`drawdown` no lo tienen. */
export function hasTarget(step: Step): step is Extract<Step, { cumulative: number }> {
  return step.kind === 'bloom' || step.kind === 'pour'
}

export function stepEnd(step: Step): number {
  return step.kind === 'drawdown' ? step.maxEndSec : step.endSec
}
