import { useEffect, useRef } from 'react'

/**
 * Hace que el botón "volver" de Android cierre el overlay en vez de la app.
 *
 * La app es una sola pantalla: sin esto, el WebView no tiene historial hacia
 * atrás y Android interpreta el gesto como "salir". La solución es empujar una
 * entrada de historial mientras hay un overlay abierto y escuchar `popstate`.
 *
 * Se mantiene UNA sola entrada aunque haya varios overlays encadenados, y el
 * descuento del cierre se difiere un microtask: cuando un sheet reemplaza a
 * otro, React desmonta el viejo y monta el nuevo en el mismo commit, y sin ese
 * diferimiento sacaríamos la entrada que el sheet nuevo acaba de necesitar
 * — el `popstate` resultante le llegaría a él y se cerraría solo.
 */

let openOverlays = 0

const STATE_KEY = 'cafriendOverlay'

function hasOverlayEntry(): boolean {
  return !!(history.state as { [STATE_KEY]?: boolean } | null)?.[STATE_KEY]
}

export function useBackDismiss(onDismiss: () => void): void {
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss

  useEffect(() => {
    openOverlays += 1
    if (openOverlays === 1 && !hasOverlayEntry()) {
      history.pushState({ [STATE_KEY]: true }, '')
    }

    const onPop = () => dismiss.current()
    window.addEventListener('popstate', onPop)

    return () => {
      window.removeEventListener('popstate', onPop)
      openOverlays -= 1
      queueMicrotask(() => {
        // Si se cerró con un botón la entrada sigue ahí y hay que consumirla;
        // si se cerró con "volver", el navegador ya la sacó.
        if (openOverlays === 0 && hasOverlayEntry()) history.back()
      })
    }
  }, [])
}
