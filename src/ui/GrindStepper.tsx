import { useEffect, useRef, useState } from 'react'
import { GRIND_MAX, GRIND_MIN } from '../store/schema'
import { vibrate } from '../lib/haptics'

const clamp = (v: number) => Math.min(GRIND_MAX, Math.max(GRIND_MIN, Math.round(v)))

/**
 * Selector del setting de molinillo: entero 0 (más fino) .. 100 (más grueso).
 * −/+ de a 1, con repetición al mantener apretado, y el número es editable
 * a mano para saltar lejos sin 20 taps.
 */
export function GrindStepper({
  value,
  onChange,
  haptics = true,
}: {
  value: number
  onChange: (value: number) => void
  haptics?: boolean
}) {
  const [text, setText] = useState(String(value))
  const timers = useRef<{ delay?: number; repeat?: number }>({})

  useEffect(() => setText(String(value)), [value])

  const bump = (delta: number) => {
    const next = clamp(value + delta)
    if (next === value) return
    if (haptics) vibrate('tap')
    onChange(next)
  }

  const stopRepeat = () => {
    clearTimeout(timers.current.delay)
    clearInterval(timers.current.repeat)
    timers.current = {}
  }

  useEffect(() => stopRepeat, [])

  // El intervalo necesita el valor fresco en cada tick sin re-armarse.
  const valueRef = useRef(value)
  valueRef.current = value

  // Mantener apretado acelera: 400 ms de espera y después 1 paso cada 70 ms.
  const holdStart = (delta: number) => {
    bump(delta)
    stopRepeat()
    timers.current.delay = window.setTimeout(() => {
      timers.current.repeat = window.setInterval(() => {
        const next = clamp(valueRef.current + delta)
        if (next === valueRef.current) return stopRepeat()
        if (haptics) vibrate('tap')
        onChange(next)
      }, 70)
    }, 400)
  }

  const commitText = () => {
    const n = Number(text)
    if (Number.isFinite(n)) onChange(clamp(n))
    else setText(String(value))
  }

  return (
    <div>
      <div className="stepper">
        <button
          type="button"
          className="stepper__btn"
          aria-label="Más fino"
          onPointerDown={() => holdStart(-1)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
          onPointerCancel={stopRepeat}
        >
          −
        </button>
        <input
          className="stepper__value tnum"
          type="number"
          inputMode="numeric"
          min={GRIND_MIN}
          max={GRIND_MAX}
          value={text}
          aria-label="Setting de molinillo"
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <button
          type="button"
          className="stepper__btn"
          aria-label="Más grueso"
          onPointerDown={() => holdStart(1)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
          onPointerCancel={stopRepeat}
        >
          +
        </button>
      </div>
      <div className="stepper__scale">
        <span>← {GRIND_MIN} más fino</span>
        <span>más grueso {GRIND_MAX} →</span>
      </div>
    </div>
  )
}
