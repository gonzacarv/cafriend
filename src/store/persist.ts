import { DEFAULT_SETTINGS, SCHEMA_VERSION, type Store } from './schema'
import { seedRecipes } from './seed'

const KEY = 'cafriend.v1'

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
    recipes: Array.isArray(input.recipes) ? input.recipes.filter(isRecipeish) : base.recipes,
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
