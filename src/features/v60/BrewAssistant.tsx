import { useEffect, useMemo, useRef, useState } from 'react'
import { grams, mmss } from '../../lib/format'
import { resolveSteps, totalDurationSec, type ResolvedStep } from '../../lib/scaling'
import { closeAudio, playDoneCue, playPourCue, playTick, playWaitCue, unlockAudio } from '../../lib/audio'
import { stopVibration, vibrate } from '../../lib/haptics'
import { useWakeLock } from '../../lib/wakelock'
import type { Recipe, Settings } from '../../store/schema'

export type BrewParams = {
  recipe: Recipe
  dose: number
  totalWater: number
  coffeeName?: string
}

/**
 * Asistente de brewing. Una vez que arranca corre solo de punta a punta: no
 * hay ningún paso que dependa de que el usuario toque algo, porque el tiempo
 * total de la receta tiene que cumplirse tal cual está definida.
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

  if (finished) {
    return <BrewSummary params={params} onExit={onExit} />
  }

  const remaining = current ? Math.max(0, current.endSec - elapsed) : 0
  const progress = current && current.durationSec > 0 ? (elapsed - current.startSec) / current.durationSec : 0
  const kind = current?.step.kind ?? 'wait'

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
            <div className="brew__label">{current?.step.label}</div>
            <div className="brew__remaining tnum">{mmss(remaining)}</div>
            {current?.targetWater !== null && current !== undefined ? (
              <>
                <div className="brew__target tnum">{current.targetWater} g</div>
                <div className="brew__target-label">objetivo en balanza</div>
                {current.pourWater !== null && (
                  <div className="brew__pour-hint">
                    verté {current.pourWater} g en {mmss(current.durationSec)}
                  </div>
                )}
              </>
            ) : (
              <div className="brew__pour-hint">
                {kind === 'drawdown' ? 'no viertas más — dejá drenar' : 'esperá, sin verter'}
              </div>
            )}
          </div>
        </div>

        <div className="brew__next">
          {next ? (
            <>
              Sigue: <strong>{next.step.label}</strong>
              {next.targetWater !== null && ` hasta ${next.targetWater} g`} · {mmss(next.startSec)}
            </>
          ) : (
            'Último paso'
          )}
        </div>
      </div>

      <div className="brew__controls">
        <button type="button" className="btn btn--lg" onClick={togglePause}>
          {paused ? '▶ Reanudar' : '❚❚ Pausar'}
        </button>
      </div>
      <div className="subtitle" style={{ textAlign: 'center', marginTop: 10 }}>
        {grams(dose)} g · {totalWater} ml · {params.coffeeName ?? recipe.name}
      </div>
    </div>
  )
}

/**
 * Dispara sonido y vibración en cada transición de paso, más tres ticks de
 * cuenta regresiva antes. Cada señal se emite una sola vez.
 */
function useCues(steps: ResolvedStep[], elapsed: number, finished: boolean, settings: Settings) {
  const fired = useRef(new Set<string>())

  useEffect(() => {
    const fire = (key: string, fn: () => void) => {
      if (fired.current.has(key)) return
      fired.current.add(key)
      fn()
    }

    for (const s of steps) {
      // Ticks en los 3 s previos al comienzo de cada paso (salvo el primero).
      if (s.startSec > 0) {
        for (let t = 3; t >= 1; t--) {
          const at = s.startSec - t
          if (elapsed >= at && elapsed < at + 0.9) {
            fire(`tick-${s.index}-${t}`, () => {
              if (settings.sound) playTick()
              if (settings.haptics) vibrate('tick')
            })
          }
        }
      }

      if (elapsed >= s.startSec && elapsed < s.startSec + 1) {
        fire(`step-${s.index}`, () => {
          const pouring = s.step.kind === 'bloom' || s.step.kind === 'pour'
          if (settings.sound) (pouring ? playPourCue : playWaitCue)()
          if (settings.haptics) vibrate(pouring ? 'pour' : 'wait')
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
 * Cierre del brew. El punto del drenado es diagnóstico: si al llegar al tiempo
 * objetivo todavía gotea, la molienda está muy fina; si drenó mucho antes,
 * muy gruesa. Por eso el resumen dice qué debería haber pasado.
 */
function BrewSummary({ params, onExit }: { params: BrewParams; onExit: () => void }) {
  const { recipe, dose, totalWater } = params
  const duration = totalDurationSec(recipe)
  const drawdown = recipe.steps.find((s) => s.kind === 'drawdown')

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
          </div>
        </div>
      </div>

      <button type="button" className="btn btn--primary btn--block btn--lg" onClick={onExit}>
        Terminar
      </button>
    </div>
  )
}
