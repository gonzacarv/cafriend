/** Segundos → "m:ss". Los tiempos de receta nunca pasan de unos minutos. */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** "1:45" | "105" | "1:45.5" → segundos. null si no se entiende. */
export function parseMmss(input: string): number | null {
  const text = input.trim()
  if (!text) return null
  const parts = text.split(':')
  if (parts.length === 1) {
    const n = Number(parts[0])
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  if (parts.length !== 2) return null
  const [m, s] = parts.map(Number)
  if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0 || s >= 60) return null
  return m * 60 + s
}

const DAY = 86_400_000

export function daysSince(isoDate: string): number | null {
  if (!isoDate) return null
  const then = new Date(`${isoDate}T00:00:00`).getTime()
  if (!Number.isFinite(then)) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - then) / DAY)
}

/** Etiqueta de reposo desde la fecha de tueste. */
export function restLabel(isoDate: string): string | null {
  const d = daysSince(isoDate)
  if (d === null) return null
  if (d < 0) return 'tueste futuro'
  if (d === 0) return 'tostado hoy'
  if (d === 1) return '1 día de tueste'
  return `${d} días de tueste`
}

/**
 * Ventana de reposo para espresso: antes de ~5 días todavía desgasifica y el
 * shot canaliza; después de ~30 empieza a apagarse.
 */
export function restStage(isoDate: string): 'fresh' | 'ready' | 'old' | null {
  const d = daysSince(isoDate)
  if (d === null || d < 0) return null
  if (d < 5) return 'fresh'
  if (d <= 30) return 'ready'
  return 'old'
}

const RELATIVE_STEPS: [limit: number, div: number, unit: Intl.RelativeTimeFormatUnit][] = [
  [60_000, 1000, 'second'],
  [3_600_000, 60_000, 'minute'],
  [DAY, 3_600_000, 'hour'],
  [30 * DAY, DAY, 'day'],
  [365 * DAY, 30 * DAY, 'month'],
  [Infinity, 365 * DAY, 'year'],
]

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diff)) return ''
  const abs = Math.abs(diff)
  const [, div, unit] = RELATIVE_STEPS.find(([limit]) => abs < limit)!
  return rtf.format(-Math.round(diff / div), unit)
}

const dateFmt = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: '2-digit' })
const dateTimeFmt = new Intl.DateTimeFormat('es', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  return Number.isFinite(d.getTime()) ? dateFmt.format(d) : ''
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? dateTimeFmt.format(d) : ''
}

export function todayIso(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

/** 16 y 16.5 se muestran "16 g" y "16.5 g", nunca "16.0 g". */
export function grams(value: number): string {
  return `${Number(value.toFixed(1))}`
}
