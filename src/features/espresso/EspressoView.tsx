import { useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import { flagEmoji } from '../../lib/flags'
import { relativeTime, restLabel, restStage } from '../../lib/format'
import { vibrate } from '../../lib/haptics'
import { CoffeeForm, type CoffeeDraft } from './CoffeeForm'
import { GrindSheet } from './GrindSheet'
import { CoffeeDetail } from './CoffeeDetail'
import type { Coffee } from '../../store/schema'

type Modal =
  | { kind: 'new' }
  | { kind: 'edit'; id: string }
  | { kind: 'grind'; id: string }
  | { kind: 'detail'; id: string }
  | null

export function EspressoView() {
  const { store, actions } = useStore()
  const [tab, setTab] = useState<'active' | 'finished'>('active')
  const [modal, setModal] = useState<Modal>(null)
  const [undo, setUndo] = useState<{ coffeeId: string; entryId: string; label: string } | null>(null)

  const { active, finished } = useMemo(() => {
    const byRecent = (a: Coffee, b: Coffee) => b.updatedAt.localeCompare(a.updatedAt)
    return {
      active: store.coffees.filter((c) => c.status === 'active').sort(byRecent),
      finished: store.coffees.filter((c) => c.status === 'finished').sort(byRecent),
    }
  }, [store.coffees])

  const find = (id: string) => store.coffees.find((c) => c.id === id)
  const list = tab === 'active' ? active : finished

  const saveGrind = (coffee: Coffee, value: number, note: string) => {
    actions.setGrind(coffee.id, 'espresso', value, note)
    if (store.settings.haptics) vibrate('tap')
    // El id de la entrada nueva se resuelve al deshacer: siempre es la primera.
    setUndo({ coffeeId: coffee.id, entryId: '', label: `${coffee.brand}: ${value}` })
    window.setTimeout(() => setUndo(null), 5000)
  }

  const doUndo = () => {
    if (!undo) return
    const coffee = find(undo.coffeeId)
    const latest = coffee?.grind.espresso?.history[0]
    if (latest) actions.deleteGrindEntry(undo.coffeeId, 'espresso', latest.id)
    setUndo(null)
  }

  return (
    <>
      <div className="header">
        <div>
          <h1 className="header__title">Espresso</h1>
          <div className="subtitle">Settings de molinillo por café</div>
        </div>
        <button type="button" className="btn btn--primary btn--icon" onClick={() => setModal({ kind: 'new' })}>
          + Café
        </button>
      </div>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className="tabs__item"
          aria-selected={tab === 'active'}
          onClick={() => setTab('active')}
        >
          En curso ({active.length})
        </button>
        <button
          type="button"
          role="tab"
          className="tabs__item"
          aria-selected={tab === 'finished'}
          onClick={() => setTab('finished')}
        >
          Finalizados ({finished.length})
        </button>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <span className="empty__icon">☕</span>
          {tab === 'active' ? (
            <>
              <div>No tenés cafés en curso.</div>
              <div style={{ marginTop: 4 }}>Dalos de alta con “+ Café”.</div>
            </>
          ) : (
            <div>Los cafés que se te acaben quedan acá, con todo su historial.</div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {list.map((coffee) => (
            <CoffeeCard
              key={coffee.id}
              coffee={coffee}
              onOpen={() => setModal({ kind: 'detail', id: coffee.id })}
              onAdjust={() => setModal({ kind: 'grind', id: coffee.id })}
            />
          ))}
        </div>
      )}

      {modal?.kind === 'new' && (
        <CoffeeForm
          onClose={() => setModal(null)}
          onSubmit={(draft: CoffeeDraft, initialGrind) => actions.addCoffee(draft, initialGrind)}
        />
      )}

      {modal?.kind === 'edit' && find(modal.id) && (
        <CoffeeForm
          coffee={find(modal.id)}
          onClose={() => setModal({ kind: 'detail', id: modal.id })}
          onSubmit={(draft) => actions.updateCoffee(modal.id, draft)}
        />
      )}

      {modal?.kind === 'grind' && find(modal.id) && (
        <GrindSheet
          coffee={find(modal.id)!}
          current={find(modal.id)!.grind.espresso?.current ?? null}
          haptics={store.settings.haptics}
          onClose={() => setModal(null)}
          onSave={(value, note) => saveGrind(find(modal.id)!, value, note)}
        />
      )}

      {modal?.kind === 'detail' && find(modal.id) && (
        <CoffeeDetail
          coffee={find(modal.id)!}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ kind: 'edit', id: modal.id })}
          onAdjust={() => setModal({ kind: 'grind', id: modal.id })}
        />
      )}

      {undo && (
        <div className="toast">
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Registrado {undo.label}
          </span>
          <button type="button" className="toast__action" onClick={doUndo}>
            Deshacer
          </button>
        </div>
      )}
    </>
  )
}

function CoffeeCard({
  coffee,
  onOpen,
  onAdjust,
}: {
  coffee: Coffee
  onOpen: () => void
  onAdjust: () => void
}) {
  const track = coffee.grind.espresso
  const stage = restStage(coffee.roastDate)
  const rest = restLabel(coffee.roastDate)
  const lastChange = track?.history[0]
  // Un café finalizado es de solo lectura: el número abre la ficha, no ajusta.
  const finished = coffee.status === 'finished'

  return (
    <div className="coffee">
      <button type="button" className="coffee__main" onClick={onOpen}>
        <span className="coffee__flag">{flagEmoji(coffee.countryCode)}</span>
        <span className="coffee__info">
          <span className="coffee__name">
            {coffee.brand}
            {coffee.type && <span style={{ fontWeight: 400, color: 'var(--muted)' }}> · {coffee.type}</span>}
          </span>
          <span className="coffee__meta">
            {rest && <span className={`badge${stage ? ` badge--${stage}` : ''}`}>{rest}</span>}
            {lastChange && <span>ajustado {relativeTime(lastChange.at)}</span>}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="coffee__setting"
        onClick={finished ? onOpen : onAdjust}
        aria-label={finished ? `Ver ${coffee.brand}` : `Cambiar setting de ${coffee.brand}`}
      >
        <span className={`coffee__value tnum${track ? '' : ' coffee__value--empty'}`}>
          {track ? track.current : '—'}
        </span>
        <span className="coffee__hint">{finished ? 'último' : track ? 'ajustar' : 'cargar'}</span>
      </button>
    </div>
  )
}
