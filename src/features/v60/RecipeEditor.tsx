import { useState } from 'react'
import { Sheet } from '../../ui/Sheet'
import { mmss, parseMmss } from '../../lib/format'
import { validateRecipe } from '../../lib/scaling'
import { newId, stepEnd, type Recipe, type Step } from '../../store/schema'

const KIND_LABEL: Record<Step['kind'], string> = {
  bloom: 'Bloom',
  pour: 'Pour',
  wait: 'Espera',
  drawdown: 'Drenado',
}

/** Dosis de referencia solo para mostrar los objetivos en ml mientras se edita. */
const REFERENCE_DOSE = 16

export function RecipeEditor({
  recipe,
  onSave,
  onDelete,
  onClose,
}: {
  recipe: Recipe
  onSave: (recipe: Recipe) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Recipe>(recipe)
  const [showIssues, setShowIssues] = useState(false)

  const issues = validateRecipe(draft)
  const totalWater = Math.round(REFERENCE_DOSE * draft.ratio)

  const patchStep = (index: number, patch: Partial<Step>) =>
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s, i) => (i === index ? ({ ...s, ...patch } as Step) : s)),
    }))

  const changeKind = (index: number, kind: Step['kind']) =>
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s, i) => {
        if (i !== index) return s
        const start = s.startSec
        const end = stepEnd(s)
        const label = KIND_LABEL[kind]
        if (kind === 'drawdown') return { id: s.id, kind, label, startSec: start, maxEndSec: end }
        if (kind === 'wait') return { id: s.id, kind, label, startSec: start, endSec: end }
        const cumulative = 'cumulative' in s ? s.cumulative : 1
        return { id: s.id, kind, label, startSec: start, endSec: end, cumulative }
      }),
    }))

  const addStep = () =>
    setDraft((d) => {
      const last = d.steps[d.steps.length - 1]
      const start = last ? stepEnd(last) : 0
      const step: Step = {
        id: newId(),
        kind: 'pour',
        label: `Pour ${d.steps.filter((s) => s.kind === 'pour').length + 1}`,
        startSec: start,
        endSec: start + 30,
        cumulative: 1,
      }
      return { ...d, steps: [...d.steps, step] }
    })

  const removeStep = (index: number) =>
    setDraft((d) => ({ ...d, steps: d.steps.filter((_, i) => i !== index) }))

  const save = () => {
    if (issues.length > 0) return setShowIssues(true)
    onSave(draft)
    onClose()
  }

  return (
    <Sheet title={recipe.name ? `Editar ${recipe.name}` : 'Nueva receta'} onClose={onClose}>
      {showIssues && issues.length > 0 && (
        <div className="issues">
          <strong>Revisá esto antes de guardar:</strong>
          <ul>
            {issues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="row">
        <label className="field">
          <span className="field__label">Nombre</span>
          <input
            className="input"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label className="field" style={{ maxWidth: 130 }}>
          <span className="field__label">Ratio 1:</span>
          <input
            className="input tnum"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="5"
            max="25"
            value={draft.ratio}
            onChange={(e) => setDraft({ ...draft, ratio: Number(e.target.value) })}
          />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Notas</span>
        <textarea
          className="textarea"
          value={draft.notes ?? ''}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </label>

      <div className="section-label">
        Pasos · objetivos en ml para {REFERENCE_DOSE} g ({totalWater} ml)
      </div>

      {draft.steps.map((step, index) => (
        <div className="step-edit" key={step.id}>
          <div className="step-edit__head">
            <select
              className="select"
              value={step.kind}
              onChange={(e) => changeKind(index, e.target.value as Step['kind'])}
            >
              {Object.entries(KIND_LABEL).map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
            </select>
            <input
              className="input"
              style={{ minHeight: 40, padding: '6px 10px', flex: 1 }}
              value={step.label}
              onChange={(e) => patchStep(index, { label: e.target.value })}
            />
            <button
              type="button"
              className="btn btn--icon btn--ghost"
              aria-label="Quitar paso"
              onClick={() => removeStep(index)}
            >
              ✕
            </button>
          </div>

          <div className="step-edit__grid">
            <label>
              <span className="field__label">Desde</span>
              <TimeInput
                seconds={step.startSec}
                onChange={(sec) => patchStep(index, { startSec: sec })}
              />
            </label>
            <label>
              <span className="field__label">Hasta</span>
              <TimeInput
                seconds={stepEnd(step)}
                onChange={(sec) =>
                  patchStep(index, step.kind === 'drawdown' ? { maxEndSec: sec } : { endSec: sec })
                }
              />
            </label>
            {'cumulative' in step ? (
              <label>
                <span className="field__label">Acumulado</span>
                <input
                  className="input tnum"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={totalWater}
                  value={Math.round(step.cumulative * totalWater)}
                  onChange={(e) => patchStep(index, { cumulative: Number(e.target.value) / totalWater })}
                />
              </label>
            ) : (
              <div style={{ alignSelf: 'end', color: 'var(--muted)', fontSize: 12, paddingBottom: 12 }}>
                sin agua
              </div>
            )}
          </div>
        </div>
      ))}

      <button type="button" className="btn btn--block" onClick={addStep}>
        + Agregar paso
      </button>

      <div className="row" style={{ marginTop: 18 }}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="btn btn--primary" onClick={save}>
          Guardar
        </button>
      </div>

      {onDelete && (
        <button
          type="button"
          className="btn btn--block btn--danger btn--ghost"
          style={{ marginTop: 10 }}
          onClick={() => {
            onDelete()
            onClose()
          }}
        >
          Borrar receta
        </button>
      )}
    </Sheet>
  )
}

/** Entrada de tiempo tolerante: acepta "1:45" o "105". */
function TimeInput({ seconds, onChange }: { seconds: number; onChange: (seconds: number) => void }) {
  const [text, setText] = useState(mmss(seconds))
  const [focused, setFocused] = useState(false)

  // Mientras se escribe mandamos el texto; al salir, se normaliza a m:ss.
  if (!focused && text !== mmss(seconds)) setText(mmss(seconds))

  return (
    <input
      className="input tnum"
      inputMode="numeric"
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        setText(e.target.value)
        const parsed = parseMmss(e.target.value)
        if (parsed !== null) onChange(parsed)
      }}
      onBlur={() => {
        setFocused(false)
        setText(mmss(seconds))
      }}
    />
  )
}
