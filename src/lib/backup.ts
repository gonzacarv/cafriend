import { normalize } from '../store/persist'
import type { Coffee, Recipe, Store } from '../store/schema'

export function serialize(store: Store): string {
  return JSON.stringify(store, null, 2)
}

export function backupFilename(): string {
  return `cafriend-${new Date().toISOString().slice(0, 10)}.json`
}

/** Dispara la descarga del JSON en el teléfono. */
export function downloadBackup(store: Store): void {
  const blob = new Blob([serialize(store)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFilename()
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Sin el timeout Chrome a veces cancela la descarga al revocar el blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export type ParsedBackup = { store: Store; coffees: number; recipes: number }

/** Parsea y valida un backup. Lanza con un mensaje legible si no sirve. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }
  if (!raw || typeof raw !== 'object' || !('coffees' in raw || 'recipes' in raw)) {
    throw new Error('El archivo no parece un backup de CaFriend.')
  }
  const store = normalize(raw)
  return { store, coffees: store.coffees.length, recipes: store.recipes.length }
}

/**
 * Fusiona un backup con el store actual. Gana el registro con `updatedAt` más
 * nuevo; lo que solo existe de un lado se conserva. Los ajustes quedan como
 * están en el dispositivo — son preferencias locales, no datos.
 */
export function mergeStores(current: Store, incoming: Store): Store {
  return {
    ...current,
    coffees: mergeById(current.coffees, incoming.coffees),
    recipes: mergeById(current.recipes, incoming.recipes),
  }
}

function mergeById<T extends Coffee | Recipe>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) {
    const existing = byId.get(item.id)
    if (!existing || (item.updatedAt ?? '') > (existing.updatedAt ?? '')) byId.set(item.id, item)
  }
  return [...byId.values()]
}
