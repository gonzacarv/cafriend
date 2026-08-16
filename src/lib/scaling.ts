import { hasTarget, MAX_FLOW_RATE, stepEnd, type Recipe, type Step } from '../store/schema'

/**
 * Escalado de recetas y resolución del timeline.
 *
 * Tres magnitudes que conviene no confundir:
 *   dose        gramos de café molido
 *   totalWater  ml (= g) de agua vertida en total — es lo que marca la balanza
 *   cupYield    ml que caen en la taza = totalWater − dose × absorption
 *
 * En las notas originales la columna "ml finales" era en realidad totalWater.
 */

export type BasisMode = 'dose' | 'water' | 'cup'

export type BrewSpec = {
  dose: number
  totalWater: number
  cupYield: number
}

/** ml retenidos por gramo de café molido. Valor típico 2.0. */
export type Absorption = number

export function cupYieldFrom(dose: number, totalWater: number, absorption: Absorption): number {
  return Math.max(0, totalWater - dose * absorption)
}

/**
 * Resuelve las tres magnitudes a partir de la que ingresó el usuario.
 *
 * Por taza: totalWater = dose × ratio y cup = totalWater − dose × absorption,
 * entonces cup = dose × (ratio − absorption) → dose = cup / (ratio − absorption).
 */
export function resolveSpec(
  recipe: Recipe,
  mode: BasisMode,
  value: number,
  absorption: Absorption,
): BrewSpec {
  const ratio = recipe.ratio
  let dose: number

  switch (mode) {
    case 'dose':
      dose = value
      break
    case 'water':
      dose = ratio > 0 ? value / ratio : 0
      break
    case 'cup': {
      const net = ratio - absorption
      // Con absorción >= ratio el café absorbería todo: no hay taza posible.
      dose = net > 0 ? value / net : 0
      break
    }
  }

  dose = roundTo(Math.max(0, dose), 1)
  const totalWater = Math.round(dose * ratio)
  return { dose, totalWater, cupYield: Math.round(cupYieldFrom(dose, totalWater, absorption)) }
}

export type ResolvedStep = {
  step: Step
  index: number
  startSec: number
  endSec: number
  durationSec: number
  /** Objetivo acumulado en balanza al terminar el paso, en g. null si el paso no vierte. */
  targetWater: number | null
  /** Agua vertida durante este paso, en g. null si el paso no vierte. */
  pourWater: number | null
  /** Segundo en que termina el vertido; desde acá hasta endSec se espera. */
  pourEndSec: number
  /** Segundos de espera al final del paso. 0 si es continuo o no entra. */
  waitSec: number
  /** g/s que exige el vertido tal como quedó resuelto. */
  flowRequired: number | null
}

/**
 * Parte la ventana de un vertido en vertido propiamente dicho + espera.
 *
 * Un pulso tarda lo que tarda: `agua / caudal`. Por eso el caudal escala bien
 * con la dosis — subir de 16 a 24 g alarga el vertido y acorta la espera, que
 * es lo que pasa en la realidad. Si el vertido no entra en la ventana se acota
 * a ella y el paso queda continuo de hecho.
 */
export function splitPour(
  startSec: number,
  endSec: number,
  pourWater: number,
  style: 'pulse' | 'continuous',
  flowRate: number,
): { pourEndSec: number; waitSec: number; flowRequired: number } {
  const window = Math.max(0, endSec - startSec)

  const pourSec =
    style === 'continuous' || !(flowRate > 0)
      ? window
      : Math.min(window, Math.max(1, Math.round(pourWater / flowRate)))

  const pourEndSec = startSec + pourSec
  return {
    pourEndSec,
    waitSec: endSec - pourEndSec,
    flowRequired: pourSec > 0 ? pourWater / pourSec : 0,
  }
}

/**
 * Convierte una receta + dosis en la secuencia concreta que ejecuta el
 * asistente: segundos absolutos y gramos absolutos, ya redondeados.
 *
 * Los objetivos se redondean sobre el ACUMULADO, no sobre cada pour, para que
 * la suma de los parciales siempre cierre exactamente en totalWater.
 */
export function resolveSteps(recipe: Recipe, totalWater: number): ResolvedStep[] {
  let prevTarget = 0
  return recipe.steps.map((step, index) => {
    const startSec = step.startSec
    const endSec = stepEnd(step)
    let targetWater: number | null = null
    let pourWater: number | null = null

    // Los pasos que no vierten ocupan toda su ventana "vertiendo nada": así el
    // asistente los trata como una sola fase sin tener que distinguirlos.
    let pourEndSec = endSec
    let waitSec = 0
    let flowRequired: number | null = null

    if (hasTarget(step)) {
      targetWater = Math.round(step.cumulative * totalWater)
      pourWater = targetWater - prevTarget
      prevTarget = targetWater

      const split = splitPour(startSec, endSec, pourWater, step.style, recipe.flowRate)
      pourEndSec = split.pourEndSec
      waitSec = split.waitSec
      flowRequired = split.flowRequired
    }

    return {
      step,
      index,
      startSec,
      endSec,
      durationSec: Math.max(0, endSec - startSec),
      targetWater,
      pourWater,
      pourEndSec,
      waitSec,
      flowRequired,
    }
  })
}

export function totalDurationSec(recipe: Recipe): number {
  return recipe.steps.reduce((max, step) => Math.max(max, stepEnd(step)), 0)
}

export type RecipeIssue = {
  stepIndex: number | null
  message: string
  /**
   * 'error' impide guardar (la receta no se puede ejecutar). 'warn' es una
   * advertencia física — la receta corre igual, pero puede ser impracticable.
   * No bloqueamos por eso: la receta es del usuario.
   */
  severity: 'error' | 'warn'
}

/** Dosis de referencia para chequear el caudal: el extremo alto del uso normal. */
const FLOW_CHECK_DOSE = 24

/** Valida una receta antes de guardarla. Devuelve [] si está todo bien. */
export function validateRecipe(recipe: Recipe): RecipeIssue[] {
  const issues: RecipeIssue[] = []
  const error = (message: string, stepIndex: number | null = null) =>
    issues.push({ stepIndex, message, severity: 'error' })
  const warn = (message: string, stepIndex: number | null = null) =>
    issues.push({ stepIndex, message, severity: 'warn' })

  if (!recipe.name.trim()) error('La receta necesita un nombre.')
  if (!(recipe.ratio > 0)) error('El ratio debe ser mayor a 0.')
  if (!(recipe.flowRate > 0)) error('El caudal debe ser mayor a 0.')
  if (recipe.steps.length === 0) {
    error('Agregá al menos un paso.')
    return issues
  }

  let prevEnd = -1
  let prevCumulative = 0

  recipe.steps.forEach((step, i) => {
    const end = stepEnd(step)
    if (step.startSec < prevEnd) {
      error(`"${step.label}" empieza antes de que termine el paso anterior.`, i)
    }
    if (end <= step.startSec) {
      error(`"${step.label}" tiene que durar más de 0 s.`, i)
    }
    if (hasTarget(step)) {
      if (step.cumulative <= prevCumulative) {
        error(`"${step.label}" debe superar el objetivo acumulado del pour anterior.`, i)
      }
      if (step.cumulative > 1) {
        error(`"${step.label}" supera el 100 % del agua total.`, i)
      }

      // El caudal se chequea contra la dosis alta: si a 24 g es impracticable,
      // el usuario se va a topar con eso el día que prepare una jarra grande.
      const water = (step.cumulative - prevCumulative) * FLOW_CHECK_DOSE * recipe.ratio
      const { waitSec, flowRequired } = splitPour(step.startSec, end, water, step.style, recipe.flowRate)

      if (flowRequired > MAX_FLOW_RATE) {
        warn(
          `"${step.label}" exige ${flowRequired.toFixed(1)} g/s a ${FLOW_CHECK_DOSE} g de café. ` +
            'Ninguna pava vierte tan rápido de forma controlada: alargá la ventana.',
          i,
        )
      } else if (step.style === 'pulse' && waitSec <= 0) {
        warn(
          `"${step.label}" es un pulso pero el vertido llena toda su ventana a ${FLOW_CHECK_DOSE} g: ` +
            'no queda espera y en la práctica es continuo.',
          i,
        )
      }

      prevCumulative = step.cumulative
    }
    prevEnd = end
  })

  const pours = recipe.steps.filter(hasTarget)
  if (pours.length === 0) {
    error('La receta necesita al menos un pour con objetivo.')
  } else if (Math.abs(pours[pours.length - 1].cumulative - 1) > 1e-6) {
    error('El último pour tiene que llegar al 100 % del agua total.')
  }

  return issues
}

/** Solo los problemas que impiden guardar. */
export function blockingIssues(issues: RecipeIssue[]): RecipeIssue[] {
  return issues.filter((i) => i.severity === 'error')
}

export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}
