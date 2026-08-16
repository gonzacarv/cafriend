import { describe, expect, it } from 'vitest'
import { seedRecipes } from '../store/seed'
import { resolveSpec, resolveSteps, validateRecipe, cupYieldFrom } from './scaling'
import type { Recipe } from '../store/schema'

const recipes = seedRecipes()
const byName = (name: string): Recipe => {
  const r = recipes.find((x) => x.name === name)
  if (!r) throw new Error(`receta ${name} no encontrada`)
  return r
}

/** Objetivos acumulados en g que produce la receta para una dosis dada. */
const targets = (recipe: Recipe, dose: number): number[] =>
  resolveSteps(recipe, dose * recipe.ratio)
    .filter((s) => s.targetWater !== null)
    .map((s) => s.targetWater as number)

/** Tiempos [inicio, fin] de cada paso, en segundos. */
const times = (recipe: Recipe): [number, number][] =>
  resolveSteps(recipe, 240).map((s) => [s.startSec, s.endSec])

describe('regresión contra la tabla de las notas', () => {
  // Las 9 filas originales: [receta, dosis, ml finales, objetivos acumulados].
  // Ver el bloque de desviaciones conocidas más abajo para Rao y Kasuya.
  it('Hoffmann reproduce exactamente Hoff.1 / Hoff.2 / Hoff.3', () => {
    const r = byName('Hoffmann')
    expect(targets(r, 16)).toEqual([40, 160, 240])
    expect(targets(r, 20)).toEqual([50, 200, 300])
    expect(targets(r, 24)).toEqual([60, 240, 360])
    expect(times(r)).toEqual([
      [0, 30],
      [30, 75],
      [75, 105],
      [105, 150],
    ])
  })

  it('Rao reproduce Rao.1 exacto y el bloom (3x dosis) en los tres tamaños', () => {
    const r = byName('Rao')
    expect(targets(r, 16)).toEqual([48, 180, 240])
    expect(targets(r, 20)[0]).toBe(60)
    expect(targets(r, 24)[0]).toBe(72)
    // El objetivo final siempre cierra exacto en el agua total.
    expect(targets(r, 20)[2]).toBe(300)
    expect(targets(r, 24)[2]).toBe(360)
    expect(times(r)).toEqual([
      [0, 45],
      [45, 90],
      [90, 120],
      [120, 165],
    ])
  })

  it('Kasuya reproduce Kasu.2 exacto y el corte 4:6 en los tres tamaños', () => {
    const r = byName('Kasuya 4:6')
    expect(targets(r, 20)).toEqual([50, 120, 200, 300])
    expect(targets(r, 16)).toEqual([40, 96, 160, 240])
    expect(targets(r, 24)).toEqual([60, 144, 240, 360])
    expect(times(r)).toEqual([
      [0, 30],
      [30, 45],
      [45, 60],
      [60, 75],
      [75, 165],
    ])
  })

  it('las desviaciones respecto de la tabla vieja son las esperadas y solo en pours intermedios', () => {
    // La tabla original no era internamente consistente: el mismo estilo daba
    // porcentajes distintos según el tamaño. Estas son las únicas diferencias,
    // todas en un pour intermedio y de pocos ml — el objetivo final siempre cierra.
    const rao = byName('Rao')
    expect(targets(rao, 20)[1] - 220).toBe(5) // notas 220 → 225 (0.75 fijo)
    expect(targets(rao, 24)[1] - 260).toBe(10) // notas 260 → 270

    const kasuya = byName('Kasuya 4:6')
    expect(targets(kasuya, 16)[1] - 100).toBe(-4) // notas 100 → 96 (40 % exacto)
    expect(targets(kasuya, 24)[1] - 150).toBe(-6) // notas 150 → 144
  })
})

describe('escalado a dosis arbitrarias', () => {
  it('el último objetivo siempre iguala el agua total', () => {
    for (const r of recipes) {
      for (let dose = 10; dose <= 40; dose += 0.5) {
        const total = Math.round(dose * r.ratio)
        const t = targets(r, dose)
        expect(t[t.length - 1]).toBe(total)
      }
    }
  })

  it('los pours parciales suman exactamente el agua total', () => {
    for (const r of recipes) {
      const steps = resolveSteps(r, 317)
      const sum = steps.reduce((acc, s) => acc + (s.pourWater ?? 0), 0)
      expect(sum).toBe(317)
    }
  })

  it('los objetivos son estrictamente crecientes', () => {
    for (const r of recipes) {
      const t = targets(r, 18)
      for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1])
    }
  })
})

describe('resolveSpec', () => {
  const hoff = byName('Hoffmann')

  it('por dosis: 16 g a 1:15 son 240 ml de agua', () => {
    const spec = resolveSpec(hoff, 'dose', 16, 2)
    expect(spec).toEqual({ dose: 16, totalWater: 240, cupYield: 208 })
  })

  it('por agua total: 240 ml piden 16 g', () => {
    expect(resolveSpec(hoff, 'water', 240, 2).dose).toBe(16)
  })

  it('por taza: 208 ml en taza piden 16 g (ida y vuelta)', () => {
    const spec = resolveSpec(hoff, 'cup', 208, 2)
    expect(spec.dose).toBe(16)
    expect(spec.totalWater).toBe(240)
    expect(spec.cupYield).toBe(208)
  })

  it('con absorción 0 la taza iguala el agua total', () => {
    expect(resolveSpec(hoff, 'dose', 16, 0).cupYield).toBe(240)
  })

  it('no explota con ratio o absorción degenerados', () => {
    expect(resolveSpec({ ...hoff, ratio: 0 }, 'water', 240, 2).dose).toBe(0)
    expect(resolveSpec(hoff, 'cup', 240, 15).dose).toBe(0)
    expect(cupYieldFrom(30, 100, 5)).toBe(0)
  })
})

describe('validateRecipe', () => {
  it('acepta las tres recetas semilla', () => {
    for (const r of recipes) expect(validateRecipe(r)).toEqual([])
  })

  it('rechaza objetivos que no cierran en 100 %', () => {
    const r = byName('Hoffmann')
    const broken: Recipe = {
      ...r,
      steps: r.steps.map((s) => (s.kind === 'pour' && s.label === 'Pour 2' ? { ...s, cumulative: 0.9 } : s)),
    }
    expect(validateRecipe(broken).some((i) => i.message.includes('100 %'))).toBe(true)
  })

  it('rechaza objetivos que retroceden', () => {
    const r = byName('Kasuya 4:6')
    const broken: Recipe = {
      ...r,
      steps: r.steps.map((s) => (s.kind === 'pour' && s.label === 'Pour 2' ? { ...s, cumulative: 0.2 } : s)),
    }
    expect(validateRecipe(broken).some((i) => i.message.includes('acumulado'))).toBe(true)
  })

  it('rechaza pasos solapados y de duración cero', () => {
    const r = byName('Hoffmann')
    const overlap: Recipe = {
      ...r,
      steps: r.steps.map((s, i) => (i === 1 ? { ...s, startSec: 10 } : s)),
    }
    expect(validateRecipe(overlap).some((i) => i.message.includes('antes de que termine'))).toBe(true)

    const zero: Recipe = {
      ...r,
      steps: r.steps.map((s, i) => (i === 0 ? { ...s, endSec: 0 } : s)),
    }
    expect(validateRecipe(zero).some((i) => i.message.includes('0 s'))).toBe(true)
  })
})
