import { describe, expect, it } from 'vitest'
import { seedRecipes } from '../store/seed'
import { blockingIssues, resolveSpec, resolveSteps, splitPour, validateRecipe, cupYieldFrom } from './scaling'
import { MAX_FLOW_RATE, type Recipe } from '../store/schema'

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

  it('Kasuya ya NO sigue la tabla vieja: es el 4:6 canónico', () => {
    // Deliberadamente distinto de las notas. La tabla original tenía 4 pulsos
    // cada 15 s, que no le da tiempo a drenar a nada entre medio — eso es un
    // vertido continuo disfrazado de pulsos. Se reemplazó por el método real:
    // 5 vertidos separados ~45 s, 40 % inicial (dulzor/acidez) y 60 % restante
    // en tres partes iguales (fuerza).
    const r = byName('Kasuya 4:6')
    expect(targets(r, 20)).toEqual([50, 120, 180, 240, 300])
    expect(targets(r, 16)).toEqual([40, 96, 144, 192, 240])
    expect(targets(r, 24)).toEqual([60, 144, 216, 288, 360])
    expect(times(r)).toEqual([
      [0, 45],
      [45, 90],
      [90, 130],
      [130, 170],
      [170, 185],
      [185, 210],
    ])
  })

  it('las desviaciones de Rao respecto de la tabla vieja son las esperadas', () => {
    // La tabla original no era internamente consistente: el mismo estilo daba
    // porcentajes distintos según el tamaño. Estas son las únicas diferencias,
    // ambas en un pour intermedio — el objetivo final siempre cierra exacto.
    const rao = byName('Rao')
    expect(targets(rao, 20)[1] - 220).toBe(5) // notas 220 → 225 (0.75 fijo)
    expect(targets(rao, 24)[1] - 260).toBe(10) // notas 260 → 270
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

describe('splitPour — vertido vs. espera', () => {
  it('un paso continuo llena su ventana y no deja espera', () => {
    expect(splitPour(30, 75, 120, 'continuous', 6)).toEqual({
      pourEndSec: 75,
      waitSec: 0,
      flowRequired: 120 / 45,
    })
  })

  it('un pulso tarda agua/caudal y espera el resto', () => {
    const { pourEndSec, waitSec } = splitPour(0, 45, 40, 'pulse', 6)
    expect(pourEndSec).toBe(7) // 40 g / 6 g/s ≈ 7 s
    expect(waitSec).toBe(38)
  })

  it('al subir la dosis el vertido crece y la espera se acorta', () => {
    // Es la razón de definir el vertido por caudal y no por segundos fijos.
    const chico = splitPour(0, 45, 40, 'pulse', 6) // bloom a 16 g
    const grande = splitPour(0, 45, 60, 'pulse', 6) // bloom a 24 g
    expect(grande.pourEndSec).toBeGreaterThan(chico.pourEndSec)
    expect(grande.waitSec).toBeLessThan(chico.waitSec)
    expect(grande.pourEndSec).toBe(10)
    expect(grande.waitSec).toBe(35)
  })

  it('un pulso que no entra en su ventana se acota y queda continuo de hecho', () => {
    const { pourEndSec, waitSec, flowRequired } = splitPour(0, 10, 200, 'pulse', 6)
    expect(pourEndSec).toBe(10)
    expect(waitSec).toBe(0)
    expect(flowRequired).toBe(20) // absurdo, y por eso validateRecipe avisa
  })

  it('nunca produce una espera negativa ni un vertido de 0 s', () => {
    for (const water of [1, 5, 40, 120, 400]) {
      for (const [start, end] of [
        [0, 5],
        [0, 45],
        [30, 130],
      ]) {
        const { pourEndSec, waitSec } = splitPour(start, end, water, 'pulse', 6)
        expect(waitSec).toBeGreaterThanOrEqual(0)
        expect(pourEndSec).toBeGreaterThan(start)
        expect(pourEndSec).toBeLessThanOrEqual(end)
      }
    }
  })
})

describe('estilos en las recetas semilla', () => {
  it('el bloom es pulsado en las tres — se vierte rápido y se espera', () => {
    for (const r of recipes) {
      const bloom = r.steps.find((s) => s.kind === 'bloom')
      expect(bloom && 'style' in bloom && bloom.style).toBe('pulse')
    }
  })

  it('Rao vierte continuo después del bloom; Kasuya pulsa todo', () => {
    const rao = byName('Rao').steps.filter((s) => s.kind === 'pour')
    expect(rao.every((s) => 'style' in s && s.style === 'continuous')).toBe(true)

    const kasuya = byName('Kasuya 4:6').steps.filter((s) => s.kind === 'pour')
    expect(kasuya.every((s) => 'style' in s && s.style === 'pulse')).toBe(true)
  })

  it('los pulsos de Kasuya dejan espera suficiente para drenar, en todo el rango de dosis', () => {
    // El último pulso se excluye a propósito: su espera es el drenado final,
    // que viene como paso aparte. Los intermedios sí tienen que dar tiempo a
    // que el lecho baje antes del vertido siguiente.
    const r = byName('Kasuya 4:6')
    for (const dose of [15, 20, 25]) {
      const pours = resolveSteps(r, dose * r.ratio).filter((s) => s.targetWater !== null)
      for (const s of pours.slice(0, -1)) {
        expect(s.waitSec).toBeGreaterThanOrEqual(15)
      }
      // Y el último tiene que caber en su ventana sin desbordar.
      expect(pours[pours.length - 1].waitSec).toBeGreaterThanOrEqual(0)
    }
  })

  it('ninguna receta semilla exige un caudal impracticable', () => {
    for (const r of recipes) {
      for (const s of resolveSteps(r, 25 * r.ratio)) {
        if (s.flowRequired === null) continue
        expect(s.flowRequired).toBeLessThanOrEqual(MAX_FLOW_RATE)
      }
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
  it('acepta las tres recetas semilla sin un solo aviso', () => {
    for (const r of recipes) expect(validateRecipe(r)).toEqual([])
  })

  it('avisa —sin bloquear— cuando un paso exige un caudal imposible', () => {
    const r = byName('Hoffmann')
    // Todo el vertido comprimido en 3 s: ninguna pava hace eso.
    const imposible: Recipe = {
      ...r,
      steps: r.steps.map((s) => (s.label === 'Pour 1' ? { ...s, endSec: s.startSec + 3 } : s)),
    }
    const issues = validateRecipe(imposible)
    expect(issues.some((i) => i.severity === 'warn' && i.message.includes('g/s'))).toBe(true)
    expect(blockingIssues(issues)).toEqual([])
  })

  it('avisa —sin bloquear— cuando un pulso no deja espera', () => {
    const r = byName('Kasuya 4:6')
    const sinEspera: Recipe = {
      ...r,
      steps: r.steps.map((s) => (s.label === 'Pour 3' ? { ...s, endSec: s.startSec + 4 } : s)),
    }
    const issues = validateRecipe(sinEspera)
    expect(issues.some((i) => i.severity === 'warn')).toBe(true)
    expect(blockingIssues(issues)).toEqual([])
  })

  it('un caudal inválido sí bloquea', () => {
    const r = byName('Rao')
    expect(blockingIssues(validateRecipe({ ...r, flowRate: 0 })).length).toBeGreaterThan(0)
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
    // 0.10 queda por debajo del bloom (1/6), así que el acumulado retrocede.
    const broken: Recipe = {
      ...r,
      steps: r.steps.map((s) => (s.kind === 'pour' && s.label === 'Pour 2' ? { ...s, cumulative: 0.1 } : s)),
    }
    expect(blockingIssues(validateRecipe(broken)).some((i) => i.message.includes('acumulado'))).toBe(true)
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
