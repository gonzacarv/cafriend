import { useState } from 'react'
import { Sheet } from '../../ui/Sheet'
import { mmss, parseMmss } from '../../lib/format'
import { blockingIssues, splitPour, validateRecipe } from '../../lib/scaling'
import { DEFAULT_HINT, newId, stepEnd, type PourStyle, type Recipe, type Step } from '../../store/schema'

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
        const style: PourStyle = 'style' in s ? s.style : 'pulse'
        return { id: s.id, kind, label, startSec: start, endSec: end, cumulative, style }
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
        style: 'pulse',
      }
      return { ...d, steps: [...d.steps, step] }
    })

  const removeStep = (index: number) =>
    setDraft((d) => ({ ...d, steps: d.steps.filter((_, i) => i !== index) }))

  const errors = blockingIssues(issues)
  const warnings = issues.filter((i) => i.severity === 'warn')

  const save = () => {
    // Las advertencias de caudal no bloquean: la receta es del usuario.
    if (errors.length > 0) return setShowIssues(true)
    onSave(draft)
    onClose()
  }

  return (
    <Sheet title={recipe.name ? `Editar ${recipe.name}` : 'Nueva receta'} onClose={onClose}>
      {showIssues && errors.length > 0 && (
        <div className="issues">
          <strong>Revisá esto antes de guardar:</strong>
          <ul>
            {errors.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="issues issues--warn">
          <strong>Se puede guardar, pero ojo:</strong>
          <ul>
            {warnings.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      <label className="field">
        <span className="field__label">Nombre</span>
        <input
          className="input"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </label>

      <div className="row">
        <label className="field">
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
        <label className="field">
          <span className="field__label">Caudal (g/s)</span>
          <input
            className="input tnum"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="1"
            max="12"
            value={draft.flowRate}
            onChange={(e) => setDraft({ ...draft, flowRate: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="subtitle" style={{ marginTop: -6, marginBottom: 14 }}>
        A qué velocidad vertés. Define cuánto dura cada pulso: 60 g a 6 g/s son 10 s de vertido, y el resto
        de la ventana es espera. No afecta a los vertidos continuos.
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

          {'style' in step && (
            <StyleRow
              step={step}
              previousCumulative={previousCumulative(draft.steps, index)}
              totalWater={totalWater}
              flowRate={draft.flowRate}
              onChange={(style) => patchStep(index, { style })}
            />
          )}

          {hasWaitPhase(step) && (
            <label style={{ display: 'block', marginTop: 10 }}>
              <span className="field__label">Qué mirar durante la espera</span>
              <input
                className="input"
                style={{ minHeight: 42, padding: '8px 10px' }}
                value={step.hint ?? ''}
                placeholder={step.kind === 'drawdown' ? DEFAULT_HINT.drawdown : DEFAULT_HINT.pulse}
                onChange={(e) => patchStep(index, { hint: e.target.value })}
              />
            </label>
          )}
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

/**
 * Solo tiene sentido pedir una pista en los pasos donde el usuario está
 * mirando el cono en vez de la balanza: pulsos con espera, esperas y drenado.
 * Un vertido continuo no tiene ese momento.
 */
function hasWaitPhase(step: Step): boolean {
  if (step.kind === 'drawdown' || step.kind === 'wait') return true
  return step.style === 'pulse'
}

/** El acumulado del vertido anterior, para saber cuánta agua lleva este paso. */
function previousCumulative(steps: Step[], index: number): number {
  for (let i = index - 1; i >= 0; i--) {
    const step = steps[i]
    if ('cumulative' in step) return step.cumulative
  }
  return 0
}

/**
 * Elige pulso o continuo y muestra en vivo en qué se traduce. Sin esta lectura
 * el usuario no tiene forma de saber cuánta espera le queda al paso.
 */
function StyleRow({
  step,
  previousCumulative,
  totalWater,
  flowRate,
  onChange,
}: {
  step: Extract<Step, { cumulative: number }>
  previousCumulative: number
  totalWater: number
  flowRate: number
  onChange: (style: PourStyle) => void
}) {
  const water = Math.round((step.cumulative - previousCumulative) * totalWater)
  const { pourEndSec, waitSec } = splitPour(step.startSec, step.endSec, water, step.style, flowRate)
  const pourSec = pourEndSec - step.startSec

  return (
    <div style={{ marginTop: 10 }}>
      <div className="tabs" style={{ marginBottom: 8 }}>
        {(['pulse', 'continuous'] as const).map((style) => (
          <button
            key={style}
            type="button"
            role="tab"
            className="tabs__item"
            aria-selected={step.style === style}
            onClick={() => onChange(style)}
          >
            {style === 'pulse' ? 'Pulso' : 'Continuo'}
          </button>
        ))}
      </div>
      <div className="subtitle">
        {step.style === 'continuous' ? (
          <>
            Vertés {water} g durante los {mmss(step.endSec - step.startSec)} enteros, sin pausa.
          </>
        ) : waitSec > 0 ? (
          <>
            Vertés {water} g en {mmss(pourSec)} y esperás {mmss(waitSec)}.
          </>
        ) : (
          <>Vertés {water} g y no queda espera: a esta dosis es continuo de hecho.</>
        )}
      </div>
    </div>
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
