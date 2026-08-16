import { useEffect, useMemo, useRef, useState } from 'react'
import { grams, mmss } from '../../lib/format'
import { resolveSteps, totalDurationSec, type ResolvedStep } from '../../lib/scaling'
import { closeAudio, playDoneCue, playPourCue, playTick, playWaitCue, unlockAudio } from '../../lib/audio'
import { stopVibration, vibrate } from '../../lib/haptics'
import { useWakeLock } from '../../lib/wakelock'
import { useBackDismiss } from '../../ui/useBackDismiss'
import type { Recipe, Settings } from '../../store/schema'

export type BrewParams = {
  recipe: Recipe
  dose: number
  totalWater: number
  coffeeName?: string
}

/** Espera mínima para que valga la pena hablar de drenado del lecho. */
const MEANINGFUL_WAIT_SEC = 12

type Phase = 'pour' | 'wait'

/**
 * Asistente de brewing. Una vez que arranca corre solo de punta a punta: no
 * hay ningún paso que dependa de que el usuario toque algo, porque el tiempo
 * total de la receta tiene que cumplirse tal cual está definida.
 *
 * Cada paso se muestra en dos tramos, vertido y espera, porque salvo en los
 * vertidos continuos uno no vierte durante toda la ventana: vierte y espera a
 * que el lecho drene.
 */
export function BrewAssistant({
  params,
  settings,
  onExit,
}: {
  params: BrewParams
  settings: Settings
  onExit: () => void
}) {
  const { recipe, dose, totalWater } = params
  const steps = useMemo(() => resolveSteps(recipe, totalWater), [recipe, totalWater])
  const duration = useMemo(() => totalDurationSec(recipe), [recipe])

  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)

  // El reloj se deriva siempre del reloj de pared, nunca de acumular ticks:
  // si Android suspende la pestaña, al volver el tiempo sigue siendo correcto.
  const startedAt = useRef(performance.now())
  const pausedTotal = useRef(0)
  const pausedAt = useRef<number | null>(null)

  const finished = elapsed >= duration

  useWakeLock(!finished)
  // El asistente ocupa toda la pantalla: "volver" tiene que sacarte de acá,
  // igual que el ✕, y no cerrar la app.
  useBackDismiss(onExit)

  useEffect(() => {
    unlockAudio()
    return () => {
      closeAudio()
      stopVibration()
    }
  }, [])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      if (pausedAt.current === null) {
        const ms = performance.now() - startedAt.current - pausedTotal.current
        setElapsed(Math.min(duration, ms / 1000))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [duration])

  const currentIndex = steps.findIndex((s) => elapsed < s.endSec)
  const current: ResolvedStep | undefined = currentIndex === -1 ? undefined : steps[currentIndex]
  const next = currentIndex === -1 ? undefined : steps[currentIndex + 1]

  useCues(steps, elapsed, finished, settings)

  const togglePause = () => {
    if (pausedAt.current === null) {
      pausedAt.current = performance.now()
      setPaused(true)
    } else {
      pausedTotal.current += performance.now() - pausedAt.current
      pausedAt.current = null
      setPaused(false)
    }
  }

  if (finished || !current) {
    return <BrewSummary params={params} onExit={onExit} />
  }

  const pouring = current.targetWater !== null && elapsed < current.pourEndSec

  // La barra mide el tramo en curso, no el paso entero: es lo que el usuario
  // está haciendo ahora.
  const phaseStart = pouring ? current.startSec : current.pourEndSec
  const phaseEnd = pouring ? current.pourEndSec : current.endSec
  const phaseLength = Math.max(0.001, phaseEnd - phaseStart)
  const remaining = Math.max(0, phaseEnd - elapsed)
  const progress = (elapsed - phaseStart) / phaseLength

  const kind = pouring ? current.step.kind : current.step.kind === 'drawdown' ? 'drawdown' : 'wait'

  return (
    <div className={`brew brew--${kind}`}>
      <div className="brew__top">
        <button type="button" className="btn btn--icon btn--ghost" onClick={onExit}>
          ✕ Cancelar
        </button>
        <div className="brew__elapsed tnum">
          {mmss(elapsed)} / {mmss(duration)}
        </div>
      </div>

      <div className="brew__stage">
        <div className="brew__ring">
          <Ring progress={progress} />
          <div className="brew__ring-inner">
            <div className="brew__label">{pouring ? 'Verté' : 'Esperá'}</div>
            <div className="brew__remaining tnum">{mmss(remaining)}</div>
            <PhaseDetail step={current} pouring={pouring} />
          </div>
        </div>

        <div className="brew__next">{describeNext(current, next, pouring)}</div>
      </div>

      <div className="brew__controls">
        <button type="button" className="btn btn--lg" onClick={togglePause}>
          {paused ? '▶ Reanudar' : '❚❚ Pausar'}
        </button>
      </div>
      <div className="subtitle" style={{ textAlign: 'center', marginTop: 10 }}>
        {params.coffeeName ? `${params.coffeeName} · ` : ''}
        {grams(dose)} g · {totalWater} ml · {recipe.name}
      </div>
    </div>
  )
}

/** El bloque grande de abajo del reloj: qué hacer, o qué debería estar pasando. */
function PhaseDetail({ step, pouring }: { step: ResolvedStep; pouring: boolean }) {
  if (pouring && step.targetWater !== null) {
    const pourSec = step.pourEndSec - step.startSec
    return (
      <>
        <div className="brew__target tnum">{step.targetWater} g</div>
        <div className="brew__target-label">objetivo en balanza</div>
        <div className="brew__pour-hint">
          {step.pourWater} g en {mmss(pourSec)}
          {step.flowRequired !== null && ` · ${step.flowRequired.toFixed(1)} g/s`}
        </div>
      </>
    )
  }

  if (step.step.kind === 'drawdown') {
    return (
      <>
        <div className="brew__target-label" style={{ marginTop: 10 }}>
          no viertas más
        </div>
        <div className="brew__pour-hint">el filtro debería quedar seco al terminar</div>
      </>
    )
  }

  // Espera entre pulsos: lo que se mira es el nivel del agua en el cono.
  return (
    <>
      {step.targetWater !== null && (
        <>
          <div className="brew__target tnum" style={{ opacity: 0.55 }}>
            {step.targetWater} g
          </div>
          <div className="brew__target-label">ya vertido</div>
        </>
      )}
      <div className="brew__pour-hint">
        {step.waitSec >= MEANINGFUL_WAIT_SEC
          ? 'debería quedar casi drenado, no seco'
          : 'dejá que baje el nivel'}
      </div>
    </>
  )
}

function describeNext(current: ResolvedStep, next: ResolvedStep | undefined, pouring: boolean) {
  // Dentro del mismo paso, lo que viene es la espera: hay que anticiparla para
  // que el usuario no siga vertiendo por inercia.
  if (pouring && current.waitSec > 0) {
    return (
      <>
        Después: <strong>esperar {mmss(current.waitSec)}</strong>
      </>
    )
  }
  if (!next) return 'Último tramo'
  return (
    <>
      Sigue: <strong>{next.step.label}</strong>
      {next.targetWater !== null && ` hasta ${next.targetWater} g`} · {mmss(next.startSec)}
    </>
  )
}

/**
 * Dispara sonido y vibración en cada transición, más tres ticks de cuenta
 * regresiva antes. Los tramos de vertido y de espera cuentan por separado:
 * el punto de todo esto es saber cuándo dejar de verter sin mirar la pantalla.
 */
function useCues(steps: ResolvedStep[], elapsed: number, finished: boolean, settings: Settings) {
  const fired = useRef(new Set<string>())

  useEffect(() => {
    const fire = (key: string, fn: () => void) => {
      if (fired.current.has(key)) return
      fired.current.add(key)
      fn()
    }

    /** Cada momento en que el usuario tiene que hacer algo distinto. */
    const cues: { at: number; key: string; phase: Phase }[] = []
    for (const s of steps) {
      const pours = s.targetWater !== null
      cues.push({ at: s.startSec, key: `${s.index}-pour`, phase: pours ? 'pour' : 'wait' })
      if (s.waitSec > 0) cues.push({ at: s.pourEndSec, key: `${s.index}-wait`, phase: 'wait' })
    }

    for (const cue of cues) {
      if (cue.at > 0) {
        for (let t = 3; t >= 1; t--) {
          const at = cue.at - t
          if (elapsed >= at && elapsed < at + 0.9) {
            fire(`tick-${cue.key}-${t}`, () => {
              if (settings.sound) playTick()
              if (settings.haptics) vibrate('tick')
            })
          }
        }
      }

      if (elapsed >= cue.at && elapsed < cue.at + 1) {
        fire(`cue-${cue.key}`, () => {
          if (settings.sound) (cue.phase === 'pour' ? playPourCue : playWaitCue)()
          if (settings.haptics) vibrate(cue.phase === 'pour' ? 'pour' : 'wait')
        })
      }
    }

    if (finished) {
      fire('done', () => {
        if (settings.sound) playDoneCue()
        if (settings.haptics) vibrate('done')
      })
    }
  }, [elapsed, finished, steps, settings])
}

function Ring({ progress }: { progress: number }) {
  const r = 46
  const circumference = 2 * Math.PI * r
  const clamped = Math.min(1, Math.max(0, progress))
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle className="brew__ring-track" cx="50" cy="50" r={r} fill="none" strokeWidth="6" />
      <circle
        className="brew__ring-fill"
        cx="50"
        cy="50"
        r={r}
        fill="none"
        strokeWidth="6"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped)}
      />
    </svg>
  )
}

/**
 * Cierre del brew. El drenado es diagnóstico: si al llegar al tiempo objetivo
 * todavía gotea, la molienda está muy fina; si drenó mucho antes, muy gruesa.
 */
function BrewSummary({ params, onExit }: { params: BrewParams; onExit: () => void }) {
  const { recipe, dose, totalWater } = params
  const duration = totalDurationSec(recipe)
  const drawdown = recipe.steps.find((s) => s.kind === 'drawdown')
  const pulsed = recipe.steps.some((s) => (s.kind === 'bloom' || s.kind === 'pour') && s.style === 'pulse')

  return (
    <div className="brew brew--done">
      <div className="brew__top">
        <div className="brew__elapsed">Listo</div>
      </div>

      <div className="brew__stage">
        <div style={{ fontSize: 64 }}>☕</div>
        <div className="header__title" style={{ marginTop: 8 }}>
          {recipe.name}
        </div>
        <div className="subtitle" style={{ marginBottom: 18 }}>
          {params.coffeeName ? `${params.coffeeName} · ` : ''}
          {grams(dose)} g · {totalWater} ml · {mmss(duration)}
        </div>

        <div className="card" style={{ width: '100%', maxWidth: 420 }}>
          <div className="section-label" style={{ margin: '0 0 8px' }}>
            Lectura del drenado
          </div>
          <div style={{ fontSize: 15 }}>
            {drawdown ? (
              <>
                El filtro tenía que quedar seco justo en <strong>{mmss(drawdown.maxEndSec)}</strong>.
              </>
            ) : (
              <>Esta receta no define un tiempo de drenado.</>
            )}
            <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: 'var(--muted)' }}>
              <li>
                Todavía goteaba → molienda <strong>muy fina</strong>, abrí el molinillo.
              </li>
              <li>
                Drenó bastante antes → molienda <strong>muy gruesa</strong>, cerralo.
              </li>
              <li>Terminó cerca del objetivo → estás en punto.</li>
            </ul>
            {pulsed && (
              <div className="subtitle" style={{ marginTop: 12 }}>
                Los pulsos tardíos drenan más lento que los primeros: los finos migran y el filtro se carga.
                Eso es normal. La comparación que vale es contra el tiempo total; el drenado de cada pulso es
                una señal direccional, y la agitación al verter lo mueve tanto como la molienda.
              </div>
            )}
          </div>
        </div>
      </div>

      <button type="button" className="btn btn--primary btn--block btn--lg" onClick={onExit}>
        Terminar
      </button>
    </div>
  )
}
