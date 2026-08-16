/**
 * Beeps sintetizados con WebAudio — sin archivos, funciona offline.
 *
 * Android bloquea el audio hasta que hay un gesto del usuario, así que el
 * AudioContext se crea en el tap de ▶ (unlock) y se reutiliza todo el brew.
 */

let ctx: AudioContext | null = null

export function unlockAudio(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    ctx ??= new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    // Un buffer mudo termina de habilitar la salida en algunos Android.
    const source = ctx.createBufferSource()
    source.buffer = ctx.createBuffer(1, 1, 22050)
    source.connect(ctx.destination)
    source.start(0)
  } catch {
    ctx = null
  }
}

export function closeAudio(): void {
  void ctx?.close().catch(() => {})
  ctx = null
}

function beep(freq: number, durationMs: number, gainValue = 0.25, delayMs = 0): void {
  if (!ctx || ctx.state === 'closed') return
  if (ctx.state === 'suspended') void ctx.resume()
  const start = ctx.currentTime + delayMs / 1000
  const end = start + durationMs / 1000

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  // Rampas cortas en vez de cortes secos: sin ellas se escucha un click.
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(gainValue, start + 0.012)
  gain.gain.setValueAtTime(gainValue, end - 0.03)
  gain.gain.linearRampToValueAtTime(0, end)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(end + 0.02)
}

/** Tick corto y discreto de la cuenta regresiva (3-2-1). */
export function playTick(): void {
  beep(880, 70, 0.15)
}

/** Empieza un vertido: dos notas ascendentes, se distingue sin mirar. */
export function playPourCue(): void {
  beep(660, 130, 0.3)
  beep(990, 180, 0.3, 140)
}

/** Empieza una espera: nota grave, opuesta al cue de vertido. */
export function playWaitCue(): void {
  beep(400, 240, 0.25)
}

/** Fin del brew: tres notas ascendentes. */
export function playDoneCue(): void {
  beep(660, 150, 0.3)
  beep(880, 150, 0.3, 160)
  beep(1320, 320, 0.3, 320)
}
