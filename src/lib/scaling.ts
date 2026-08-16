import { hasTarget, stepEnd, type Recipe, type Step } from '../store/schema'

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

    if (hasTarget(step)) {
      targetWater = Math.round(step.cumulative * totalWater)
      pourWater = targetWater - prevTarget
      prevTarget = targetWater
    }

    return {
      step,
      index,
      startSec,
      endSec,
      durationSec: Math.max(0, endSec - startSec),
      targetWater,
      pourWater,
    }
  })
}

export function totalDurationSec(recipe: Recipe): number {
  return recipe.steps.reduce((max, step) => Math.max(max, stepEnd(step)), 0)
}

export type RecipeIssue = { stepIndex: number | null; message: string }

/** Valida una receta antes de guardarla. Devuelve [] si está bien. */
export function validateRecipe(recipe: Recipe): RecipeIssue[] {
  const issues: RecipeIssue[] = []

  if (!recipe.name.trim()) issues.push({ stepIndex: null, message: 'La receta necesita un nombre.' })
  if (!(recipe.ratio > 0)) issues.push({ stepIndex: null, message: 'El ratio debe ser mayor a 0.' })
  if (recipe.steps.length === 0) {
    issues.push({ stepIndex: null, message: 'Agregá al menos un paso.' })
    return issues
  }

  let prevEnd = -1
  let prevCumulative = 0

  recipe.steps.forEach((step, i) => {
    const end = stepEnd(step)
    if (step.startSec < prevEnd) {
      issues.push({ stepIndex: i, message: `"${step.label}" empieza antes de que termine el paso anterior.` })
    }
    if (end <= step.startSec) {
      issues.push({ stepIndex: i, message: `"${step.label}" tiene que durar más de 0 s.` })
    }
    if (hasTarget(step)) {
      if (step.cumulative <= prevCumulative) {
        issues.push({
          stepIndex: i,
          message: `"${step.label}" debe superar el objetivo acumulado del pour anterior.`,
        })
      }
      if (step.cumulative > 1) {
        issues.push({ stepIndex: i, message: `"${step.label}" supera el 100 % del agua total.` })
      }
      prevCumulative = step.cumulative
    }
    prevEnd = end
  })

  const pours = recipe.steps.filter(hasTarget)
  if (pours.length === 0) {
    issues.push({ stepIndex: null, message: 'La receta necesita al menos un pour con objetivo.' })
  } else if (Math.abs(pours[pours.length - 1].cumulative - 1) > 1e-6) {
    issues.push({ stepIndex: null, message: 'El último pour tiene que llegar al 100 % del agua total.' })
  }

  return issues
}

export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}
