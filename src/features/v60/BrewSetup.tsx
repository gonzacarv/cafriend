import { useState } from 'react'
import { Sheet } from '../../ui/Sheet'
import { grams, mmss } from '../../lib/format'
import { flagEmoji } from '../../lib/flags'
import { resolveSpec, resolveSteps, totalDurationSec, type BasisMode } from '../../lib/scaling'
import { useStore } from '../../store/useStore'
import type { Recipe } from '../../store/schema'

const MODES: { id: BasisMode; label: string; unit: string; hint: string }[] = [
  { id: 'cup', label: 'En taza', unit: 'ml', hint: 'lo que querés tomar' },
  { id: 'water', label: 'Agua total', unit: 'ml', hint: 'lo que vierte la balanza' },
  { id: 'dose', label: 'Café', unit: 'g', hint: 'lo que tenés molido' },
]

/**
 * Elegida la receta, define el tamaño del brew desde cualquiera de las tres
 * magnitudes y muestra el plan resuelto antes de arrancar.
 */
export function BrewSetup({
  recipe,
  onStart,
  onClose,
}: {
  recipe: Recipe
  onStart: (dose: number, totalWater: number, coffeeId?: string) => void
  onClose: () => void
}) {
  const { store } = useStore()
  const absorption = store.settings.absorptionMlPerG
  const [mode, setMode] = useState<BasisMode>('cup')
  const [value, setValue] = useState(250)
  const [coffeeId, setCoffeeId] = useState<string>('')

  const spec = resolveSpec(recipe, mode, value, absorption)
  const steps = resolveSteps(recipe, spec.totalWater)
  const activeCoffees = store.coffees.filter((c) => c.status === 'active')
  const unit = MODES.find((m) => m.id === mode)!.unit

  const bump = (delta: number) => setValue((v) => Math.max(1, Math.round((v + delta) * 10) / 10))

  return (
    <Sheet title={recipe.name} subtitle={`Ratio 1:${recipe.ratio} · ${mmss(totalDurationSec(recipe))} de brew`} onClose={onClose}>
      <div className="section-label" style={{ marginTop: 4 }}>
        Elegí el tamaño por…
      </div>
      <div className="tabs" role="tablist">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            className="tabs__item"
            aria-selected={mode === m.id}
            onClick={() => {
              // Al cambiar de modo, arrastramos la magnitud equivalente para
              // que el número no salte a algo sin sentido.
              setValue(m.id === 'dose' ? spec.dose : m.id === 'water' ? spec.totalWater : spec.cupYield)
              setMode(m.id)
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="stepper" style={{ margin: '6px 0 2px' }}>
        <button type="button" className="stepper__btn" aria-label="Menos" onClick={() => bump(mode === 'dose' ? -0.5 : -10)}>
          −
        </button>
        <div style={{ textAlign: 'center', minWidth: 132 }}>
          <input
            className="stepper__value tnum"
            style={{ width: 132, fontSize: 44 }}
            type="number"
            inputMode="decimal"
            value={value}
            aria-label="Cantidad"
            onChange={(e) => setValue(Math.max(0, Number(e.target.value)))}
          />
          <div className="spec__label">{unit}</div>
        </div>
        <button type="button" className="stepper__btn" aria-label="Más" onClick={() => bump(mode === 'dose' ? 0.5 : 10)}>
          +
        </button>
      </div>

      <div className="spec" style={{ marginTop: 18 }}>
        <div className={`spec__cell${mode === 'dose' ? ' spec__cell--active' : ''}`}>
          <div className="spec__value tnum">{grams(spec.dose)}</div>
          <div className="spec__label">g de café</div>
        </div>
        <div className={`spec__cell${mode === 'water' ? ' spec__cell--active' : ''}`}>
          <div className="spec__value tnum">{spec.totalWater}</div>
          <div className="spec__label">ml de agua</div>
        </div>
        <div className={`spec__cell${mode === 'cup' ? ' spec__cell--active' : ''}`}>
          <div className="spec__value tnum">{spec.cupYield}</div>
          <div className="spec__label">ml en taza</div>
        </div>
      </div>
      <div className="subtitle" style={{ marginTop: 8 }}>
        El lecho retiene ~{absorption} ml por gramo, por eso en la taza caen {spec.totalWater - spec.cupYield} ml
        menos que el agua vertida. Durante el brew los objetivos son los de la <strong>balanza</strong>.
      </div>

      {activeCoffees.length > 0 && (
        <label className="field" style={{ marginTop: 18 }}>
          <span className="field__label">Café (opcional)</span>
          <select className="select" value={coffeeId} onChange={(e) => setCoffeeId(e.target.value)}>
            <option value="">Sin especificar</option>
            {activeCoffees.map((c) => (
              <option key={c.id} value={c.id}>
                {flagEmoji(c.countryCode)} {c.brand} {c.type}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="section-label">Plan</div>
      <table className="plan">
        <thead>
          <tr>
            <th>Paso</th>
            <th>Tiempo</th>
            <th>Balanza</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.step.id}>
              <td>{s.step.label}</td>
              <td className="plan__dim tnum">
                {mmss(s.startSec)} – {mmss(s.endSec)}
              </td>
              <td className="tnum">
                {s.targetWater === null ? <span className="plan__dim">—</span> : `${s.targetWater} g`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        className="btn btn--primary btn--block btn--lg"
        style={{ marginTop: 20 }}
        disabled={spec.dose <= 0}
        onClick={() => onStart(spec.dose, spec.totalWater, coffeeId || undefined)}
      >
        ▶ Iniciar
      </button>
    </Sheet>
  )
}
