import { useEffect } from 'react'

/**
 * Mantiene la pantalla encendida mientras `active` sea true.
 *
 * Android suelta el wake lock al pasar la app a segundo plano y no lo devuelve
 * solo, así que hay que re-adquirirlo en cada visibilitychange.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return
      try {
        sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void sentinel.release().catch(() => {})
          sentinel = null
        }
      } catch {
        /* batería baja o permiso denegado: seguimos sin wake lock */
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinel) void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => {})
      sentinel = null
    }
  }, [active])
}
