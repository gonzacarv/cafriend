import {
  DEFAULT_FLOW_RATE,
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
  type Recipe,
  type Store,
} from './schema'
import { seedRecipes } from './seed'

// v2 cambió la estructura de los pasos (vertido vs. espera). No se migra: la
// clave nueva hace que lo guardado con v1 se ignore y el store arranque limpio.
const KEY = 'cafriend.v2'

export function emptyStore(): Store {
  return {
    schemaVersion: SCHEMA_VERSION,
    coffees: [],
    recipes: seedRecipes(),
    settings: { ...DEFAULT_SETTINGS },
  }
}

/**
 * Normaliza cualquier objeto que diga ser un store: completa lo que falte y
 * descarta lo que no tenga forma válida. Se usa tanto al leer localStorage
 * como al importar un JSON de afuera, así que asume entrada hostil.
 */
export function normalize(raw: unknown): Store {
  const base = emptyStore()
  if (!raw || typeof raw !== 'object') return base
  const input = raw as Partial<Store>

  return {
    schemaVersion: SCHEMA_VERSION,
    coffees: Array.isArray(input.coffees) ? input.coffees.filter(isCoffeeish).map(fixCoffee) : [],
    // Un import sin recetas se queda sin recetas: si el usuario las borró a
    // propósito, no queremos que reaparezcan las semillas.
    recipes: Array.isArray(input.recipes)
      ? input.recipes.filter(isRecipeish).map(fixRecipe)
      : base.recipes,
    settings: { ...DEFAULT_SETTINGS, ...(input.settings ?? {}) },
  }
}

function isCoffeeish(c: unknown): boolean {
  return !!c && typeof c === 'object' && typeof (c as { id?: unknown }).id === 'string'
}

function isRecipeish(r: unknown): boolean {
  return (
    !!r &&
    typeof r === 'object' &&
    typeof (r as { id?: unknown }).id === 'string' &&
    Array.isArray((r as { steps?: unknown }).steps)
  )
}

/**
 * Completa los campos que un JSON importado puede no traer. `continuous`
 * reproduce el comportamiento previo al split de vertido/espera, así que una
 * receta vieja se comporta igual que antes en vez de cambiar sola.
 */
function fixRecipe(r: unknown): Recipe {
  const recipe = r as Recipe
  return {
    ...recipe,
    flowRate: Number.isFinite(recipe.flowRate) && recipe.flowRate > 0 ? recipe.flowRate : DEFAULT_FLOW_RATE,
    steps: recipe.steps.map((step) =>
      step.kind === 'bloom' || step.kind === 'pour' ? { ...step, style: step.style ?? 'continuous' } : step,
    ),
  }
}

/** El `current` es un espejo del historial: se recalcula, nunca se confía. */
function fixCoffee(c: unknown) {
  const coffee = c as Store['coffees'][number]
  const grind = { ...(coffee.grind ?? {}) }
  for (const method of Object.keys(grind) as (keyof typeof grind)[]) {
    const track = grind[method]
    if (!track) continue
    const history = Array.isArray(track.history) ? track.history : []
    grind[method] = { history, current: history[0]?.value ?? track.current ?? 0 }
  }
  return { ...coffee, status: coffee.status === 'finished' ? 'finished' : 'active', grind } as typeof coffee
}

export function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyStore()
    return normalize(JSON.parse(raw))
  } catch {
    // Antes que arrancar en blanco y que el usuario crea que perdió todo,
    // preferimos un store vacío pero dejando el original intacto en la key.
    return emptyStore()
  }
}

export function save(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch (err) {
    console.error('CaFriend: no se pudo guardar', err)
  }
}

/** Pide almacenamiento persistente para que Android no evicte los datos. */
export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    /* no es crítico */
  }
}
