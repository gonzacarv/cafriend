import { useState } from 'react'
import { Sheet } from '../../ui/Sheet'
import { flagEmoji, searchCountries } from '../../lib/flags'
import { todayIso } from '../../lib/format'
import { GRIND_MAX, GRIND_MIN, type Coffee } from '../../store/schema'

export type CoffeeDraft = {
  brand: string
  type: string
  countryCode: string
  roastDate: string
}

/** Alta y edición de un café. `coffee` presente = edición. */
export function CoffeeForm({
  coffee,
  onSubmit,
  onClose,
}: {
  coffee?: Coffee
  onSubmit: (draft: CoffeeDraft, initialGrind?: number) => void
  onClose: () => void
}) {
  const [brand, setBrand] = useState(coffee?.brand ?? '')
  const [type, setType] = useState(coffee?.type ?? '')
  const [countryCode, setCountryCode] = useState(coffee?.countryCode ?? '')
  const [roastDate, setRoastDate] = useState(coffee?.roastDate ?? todayIso())
  const [grind, setGrind] = useState('')
  const [countryQuery, setCountryQuery] = useState('')

  const results = searchCountries(countryQuery)
  const canSave = brand.trim().length > 0

  const submit = () => {
    if (!canSave) return
    const n = Number(grind)
    const initial =
      grind.trim() && Number.isFinite(n) && n >= GRIND_MIN && n <= GRIND_MAX ? Math.round(n) : undefined
    onSubmit(
      { brand: brand.trim(), type: type.trim(), countryCode, roastDate },
      coffee ? undefined : initial,
    )
    onClose()
  }

  return (
    <Sheet title={coffee ? 'Editar café' : 'Nuevo café'} onClose={onClose}>
      <label className="field">
        <span className="field__label">Marca</span>
        <input
          className="input"
          value={brand}
          autoFocus={!coffee}
          placeholder="John&Joe"
          onChange={(e) => setBrand(e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field__label">Tipo</span>
        <input
          className="input"
          value={type}
          placeholder="Colombia / Goat / blend"
          onChange={(e) => setType(e.target.value)}
        />
      </label>

      <div className="field">
        <span className="field__label">
          País {countryCode && <span style={{ fontSize: 18 }}>{flagEmoji(countryCode)}</span>}
        </span>
        <input
          className="input"
          value={countryQuery}
          placeholder="Buscar país…"
          onChange={(e) => setCountryQuery(e.target.value)}
        />
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 10,
            maxHeight: 132,
            overflowY: 'auto',
          }}
        >
          {results.map((c) => (
            <button
              key={c.code}
              type="button"
              className="btn btn--icon"
              aria-pressed={countryCode === c.code}
              style={
                countryCode === c.code
                  ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' }
                  : undefined
              }
              onClick={() => setCountryCode(countryCode === c.code ? '' : c.code)}
            >
              {flagEmoji(c.code)} {c.name}
            </button>
          ))}
          {results.length === 0 && <span className="subtitle">Sin resultados.</span>}
        </div>
      </div>

      <label className="field">
        <span className="field__label">Fecha de tueste</span>
        <input
          className="input"
          type="date"
          value={roastDate}
          max={todayIso()}
          onChange={(e) => setRoastDate(e.target.value)}
        />
      </label>

      {!coffee && (
        <label className="field">
          <span className="field__label">Setting de molinillo inicial (opcional)</span>
          <input
            className="input tnum"
            type="number"
            inputMode="numeric"
            min={GRIND_MIN}
            max={GRIND_MAX}
            value={grind}
            placeholder="40"
            onChange={(e) => setGrind(e.target.value)}
          />
        </label>
      )}

      <div className="row" style={{ marginTop: 18 }}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="btn btn--primary" disabled={!canSave} onClick={submit}>
          Guardar
        </button>
      </div>
    </Sheet>
  )
}
