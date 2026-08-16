import { useState } from 'react'
import { Sheet } from '../../ui/Sheet'
import { flagEmoji, countryName } from '../../lib/flags'
import { formatDate, formatDateTime, relativeTime, restLabel } from '../../lib/format'
import { useStore } from '../../store/useStore'
import type { Coffee, GrindEntry } from '../../store/schema'

/** Ficha del café: datos, historial completo y acciones de archivo. */
export function CoffeeDetail({
  coffee,
  onEdit,
  onAdjust,
  onClose,
}: {
  coffee: Coffee
  onEdit: () => void
  onAdjust: () => void
  onClose: () => void
}) {
  const { actions } = useStore()
  const readOnly = coffee.status === 'finished'
  const history = coffee.grind.espresso?.history ?? []
  const [confirmDelete, setConfirmDelete] = useState(false)

  const name = [coffee.brand, coffee.type].filter(Boolean).join(' · ')
  const rest = restLabel(coffee.roastDate)

  return (
    <Sheet
      title={`${flagEmoji(coffee.countryCode)} ${name}`}
      subtitle={
        <>
          {coffee.countryCode && `${countryName(coffee.countryCode)} · `}
          {coffee.roastDate ? `tostado el ${formatDate(coffee.roastDate)}${rest ? ` (${rest})` : ''}` : 'sin fecha de tueste'}
          {coffee.finishedAt && ` · finalizado ${relativeTime(coffee.finishedAt)}`}
        </>
      }
      onClose={onClose}
    >
      {!readOnly && (
        <div className="row" style={{ marginBottom: 6 }}>
          <button type="button" className="btn btn--primary" onClick={onAdjust}>
            Cambiar setting
          </button>
          <button type="button" className="btn" onClick={onEdit}>
            Editar datos
          </button>
        </div>
      )}

      <div className="section-label">Historial de molienda ({history.length})</div>

      {history.length === 0 ? (
        <div className="notice">Todavía no registraste ningún setting para este café.</div>
      ) : (
        <div>
          {history.map((entry, i) => (
            <HistoryRow
              key={entry.id}
              entry={entry}
              previous={history[i + 1]}
              readOnly={readOnly}
              onDelete={() => actions.deleteGrindEntry(coffee.id, 'espresso', entry.id)}
              onEditNote={(note) => actions.updateGrindEntry(coffee.id, 'espresso', entry.id, { note })}
            />
          ))}
        </div>
      )}

      <div className="section-label">Café</div>
      {readOnly ? (
        <button type="button" className="btn btn--block" onClick={() => actions.reactivateCoffee(coffee.id)}>
          Reactivar — volvió a haber stock
        </button>
      ) : (
        <button
          type="button"
          className="btn btn--block"
          onClick={() => {
            actions.finishCoffee(coffee.id)
            onClose()
          }}
        >
          Se me acabó — pasar a Finalizados
        </button>
      )}

      <button
        type="button"
        className="btn btn--block btn--danger btn--ghost"
        style={{ marginTop: 10 }}
        onClick={() => {
          if (!confirmDelete) return setConfirmDelete(true)
          actions.deleteCoffee(coffee.id)
          onClose()
        }}
      >
        {confirmDelete ? 'Tocá de nuevo para borrar definitivamente' : 'Borrar café y su historial'}
      </button>
    </Sheet>
  )
}

function HistoryRow({
  entry,
  previous,
  readOnly,
  onDelete,
  onEditNote,
}: {
  entry: GrindEntry
  previous?: GrindEntry
  readOnly: boolean
  onDelete: () => void
  onEditNote: (note: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(entry.note ?? '')
  const delta = previous ? entry.value - previous.value : null

  // Menor número = más fino. La flecha describe el cambio, no el signo.
  const deltaClass = delta === null || delta === 0 ? 'delta--same' : delta < 0 ? 'delta--finer' : 'delta--coarser'
  const deltaText =
    delta === null ? 'inicial' : delta === 0 ? '=' : `${delta < 0 ? '↓' : '↑'} ${Math.abs(delta)}`

  return (
    <div className="history__item">
      <div className="history__value tnum">{entry.value}</div>
      <div className={`history__delta ${deltaClass}`}>{deltaText}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="history__when">
          {relativeTime(entry.at)} · {formatDateTime(entry.at)}
        </div>
        {editing ? (
          <div className="row" style={{ marginTop: 6 }}>
            <input className="input" value={note} autoFocus onChange={(e) => setNote(e.target.value)} />
            <button
              type="button"
              className="btn btn--icon"
              style={{ flex: '0 0 auto' }}
              onClick={() => {
                onEditNote(note.trim())
                setEditing(false)
              }}
            >
              OK
            </button>
          </div>
        ) : (
          entry.note && <div className="history__note">{entry.note}</div>
        )}
      </div>
      {!readOnly && !editing && (
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" className="btn btn--icon btn--ghost" aria-label="Editar nota" onClick={() => setEditing(true)}>
            ✎
          </button>
          <button type="button" className="btn btn--icon btn--ghost" aria-label="Borrar entrada" onClick={onDelete}>
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
