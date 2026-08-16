import { useState } from 'react'
import { Sheet } from '../../ui/Sheet'
import { GrindStepper } from '../../ui/GrindStepper'
import { flagEmoji } from '../../lib/flags'
import type { Coffee } from '../../store/schema'

/** Registra un cambio de setting: valor nuevo + nota opcional. */
export function GrindSheet({
  coffee,
  current,
  haptics,
  onSave,
  onClose,
}: {
  coffee: Coffee
  current: number | null
  haptics: boolean
  onSave: (value: number, note: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(current ?? 40)
  const [note, setNote] = useState('')

  const delta = current === null ? null : value - current

  return (
    <Sheet
      title={`${flagEmoji(coffee.countryCode)} ${coffee.brand}`}
      subtitle={
        current === null
          ? 'Primer setting de este café'
          : `Setting actual: ${current}${delta ? ` → cambio de ${delta > 0 ? '+' : ''}${delta}` : ''}`
      }
      onClose={onClose}
    >
      <div style={{ padding: '8px 0 4px' }}>
        <GrindStepper value={value} onChange={setValue} haptics={haptics} />
      </div>

      <label className="field" style={{ marginTop: 18 }}>
        <span className="field__label">Nota (opcional)</span>
        <input
          className="input"
          value={note}
          placeholder="Salió amargo y lento, cierro un punto"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={delta === 0 && !note.trim()}
          onClick={() => {
            onSave(value, note)
            onClose()
          }}
        >
          Registrar
        </button>
      </div>
    </Sheet>
  )
}
