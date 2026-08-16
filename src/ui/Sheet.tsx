import { useEffect, type ReactNode } from 'react'
import { useBackDismiss } from './useBackDismiss'

/**
 * Panel inferior modal. Se cierra con el botón ✕, tocando el fondo, con Escape
 * o con el botón "volver" de Android.
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  useBackDismiss(onClose)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Evita que el fondo scrollee detrás del sheet.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__grip" />
        <div className="sheet__head">
          <div>
            <div className="sheet__title">{title}</div>
            {subtitle && <div className="subtitle">{subtitle}</div>}
          </div>
          <button type="button" className="sheet__close" aria-label="Cerrar" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
