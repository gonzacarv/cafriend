import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  GRIND_MAX,
  GRIND_MIN,
  newId,
  type BrewMethod,
  type Coffee,
  type GrindEntry,
  type Recipe,
  type Settings,
  type Store,
} from './schema'
import { load, requestPersistence, save } from './persist'

type Actions = {
  addCoffee: (data: Omit<Coffee, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'grind'>, initialGrind?: number) => Coffee
  updateCoffee: (id: string, patch: Partial<Coffee>) => void
  finishCoffee: (id: string) => void
  reactivateCoffee: (id: string) => void
  deleteCoffee: (id: string) => void
  setGrind: (coffeeId: string, method: BrewMethod, value: number, note?: string) => void
  updateGrindEntry: (coffeeId: string, method: BrewMethod, entryId: string, patch: Partial<GrindEntry>) => void
  deleteGrindEntry: (coffeeId: string, method: BrewMethod, entryId: string) => void
  saveRecipe: (recipe: Recipe) => void
  deleteRecipe: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  replaceStore: (next: Store) => void
}

const StoreContext = createContext<{ store: Store; actions: Actions } | null>(null)

const stamp = () => new Date().toISOString()
const clampGrind = (v: number) => Math.min(GRIND_MAX, Math.max(GRIND_MIN, Math.round(v)))
/** El historial se mantiene ordenado por fecha, más reciente primero. */
const sortHistory = (h: GrindEntry[]) => [...h].sort((a, b) => b.at.localeCompare(a.at))

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(() => load())
  const first = useRef(true)

  useEffect(() => {
    void requestPersistence()
  }, [])

  useEffect(() => {
    // El primer render solo refleja lo que ya está en disco.
    if (first.current) {
      first.current = false
      return
    }
    save(store)
  }, [store])

  const actions = useMemo<Actions>(() => {
    /** Aplica un cambio a un café y le refresca updatedAt. */
    const mapCoffee = (id: string, fn: (c: Coffee) => Coffee) =>
      setStore((s) => ({
        ...s,
        coffees: s.coffees.map((c) => (c.id === id ? { ...fn(c), updatedAt: stamp() } : c)),
      }))

    /** Reescribe un track de molienda recalculando `current` desde el historial. */
    const mapTrack = (id: string, method: BrewMethod, fn: (h: GrindEntry[]) => GrindEntry[]) =>
      mapCoffee(id, (c) => {
        const history = sortHistory(fn(c.grind[method]?.history ?? []))
        return {
          ...c,
          grind: { ...c.grind, [method]: { history, current: history[0]?.value ?? 0 } },
        }
      })

    return {
      addCoffee(data, initialGrind) {
        const t = stamp()
        const coffee: Coffee = {
          ...data,
          id: newId(),
          status: 'active',
          createdAt: t,
          updatedAt: t,
          grind:
            initialGrind === undefined
              ? {}
              : {
                  espresso: {
                    current: clampGrind(initialGrind),
                    history: [{ id: newId(), value: clampGrind(initialGrind), at: t, note: 'Setting inicial' }],
                  },
                },
        }
        setStore((s) => ({ ...s, coffees: [coffee, ...s.coffees] }))
        return coffee
      },

      updateCoffee: (id, patch) => mapCoffee(id, (c) => ({ ...c, ...patch })),
      finishCoffee: (id) => mapCoffee(id, (c) => ({ ...c, status: 'finished', finishedAt: stamp() })),
      reactivateCoffee: (id) => mapCoffee(id, (c) => ({ ...c, status: 'active', finishedAt: undefined })),
      deleteCoffee: (id) => setStore((s) => ({ ...s, coffees: s.coffees.filter((c) => c.id !== id) })),

      setGrind: (coffeeId, method, value, note) =>
        mapTrack(coffeeId, method, (h) => [
          { id: newId(), value: clampGrind(value), at: stamp(), note: note?.trim() || undefined },
          ...h,
        ]),

      updateGrindEntry: (coffeeId, method, entryId, patch) =>
        mapTrack(coffeeId, method, (h) =>
          h.map((e) =>
            e.id === entryId
              ? { ...e, ...patch, value: patch.value === undefined ? e.value : clampGrind(patch.value) }
              : e,
          ),
        ),

      deleteGrindEntry: (coffeeId, method, entryId) =>
        mapTrack(coffeeId, method, (h) => h.filter((e) => e.id !== entryId)),

      saveRecipe: (recipe) =>
        setStore((s) => {
          const next = { ...recipe, updatedAt: stamp() }
          const exists = s.recipes.some((r) => r.id === recipe.id)
          return {
            ...s,
            recipes: exists ? s.recipes.map((r) => (r.id === recipe.id ? next : r)) : [...s.recipes, next],
          }
        }),

      deleteRecipe: (id) => setStore((s) => ({ ...s, recipes: s.recipes.filter((r) => r.id !== id) })),
      updateSettings: (patch) => setStore((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
      replaceStore: (next) => setStore(next),
    }
  }, [])

  return <StoreContext.Provider value={{ store, actions }}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore fuera de StoreProvider')
  return ctx
}
