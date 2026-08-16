import { useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { downloadBackup, mergeStores, parseBackup, serialize, type ParsedBackup } from '../../lib/backup'
import { relativeTime } from '../../lib/format'
import { Sheet } from '../../ui/Sheet'
import { seedRecipes } from '../../store/seed'

export function SettingsView() {
  const { store, actions } = useStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<ParsedBackup | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const lastExport = store.settings.lastExportAt
  const daysSinceExport = lastExport
    ? Math.floor((Date.now() - new Date(lastExport).getTime()) / 86_400_000)
    : null

  const exportNow = () => {
    downloadBackup(store)
    actions.updateSettings({ lastExportAt: new Date().toISOString() })
    setMessage('Backup descargado.')
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(serialize(store))
      actions.updateSettings({ lastExportAt: new Date().toISOString() })
      setMessage('Backup copiado al portapapeles.')
    } catch {
      setError('No se pudo copiar. Usá "Descargar backup".')
    }
  }

  const pickFile = async (file: File) => {
    setError(null)
    try {
      setPending(parseBackup(await file.text()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    }
  }

  return (
    <>
      <div className="header">
        <div>
          <h1 className="header__title">Ajustes</h1>
          <div className="subtitle">CaFriend · datos guardados en este teléfono</div>
        </div>
      </div>

      <div className="section-label" style={{ marginTop: 0 }}>
        Respaldo
      </div>

      {daysSinceExport === null ? (
        <div className="notice notice--warn" style={{ marginBottom: 12 }}>
          Nunca exportaste. Los datos viven solo en este teléfono: si borrás los datos del navegador o cambiás de
          equipo, se pierden.
        </div>
      ) : (
        daysSinceExport > 30 && (
          <div className="notice notice--warn" style={{ marginBottom: 12 }}>
            Tu último backup es de hace {daysSinceExport} días. Conviene exportar de nuevo.
          </div>
        )
      )}

      <div className="card">
        <div style={{ marginBottom: 12 }}>
          <strong>
            {store.coffees.length} {store.coffees.length === 1 ? 'café' : 'cafés'}
          </strong>{' '}
          · {store.recipes.length} recetas
          {lastExport && (
            <div className="subtitle">Último export {relativeTime(lastExport)}</div>
          )}
        </div>
        <button type="button" className="btn btn--primary btn--block" onClick={exportNow}>
          ⬇ Descargar backup JSON
        </button>
        <button type="button" className="btn btn--block" style={{ marginTop: 10 }} onClick={copyToClipboard}>
          Copiar JSON al portapapeles
        </button>
        <button
          type="button"
          className="btn btn--block"
          style={{ marginTop: 10 }}
          onClick={() => fileInput.current?.click()}
        >
          ⬆ Importar backup
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void pickFile(file)
            e.target.value = ''
          }}
        />
      </div>

      {error && (
        <div className="issues" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
      {message && (
        <div className="notice" style={{ marginTop: 12 }}>
          {message}
        </div>
      )}

      <div className="section-label">Durante el brewing</div>
      <div className="card">
        <label className="switch">
          <span className="switch__text">
            Sonido
            <div className="switch__desc">Beeps en cada transición y cuenta regresiva</div>
          </span>
          <input
            type="checkbox"
            checked={store.settings.sound}
            onChange={(e) => actions.updateSettings({ sound: e.target.checked })}
          />
        </label>
        <label className="switch">
          <span className="switch__text">
            Vibración
            <div className="switch__desc">Patrón distinto para vertir y para esperar</div>
          </span>
          <input
            type="checkbox"
            checked={store.settings.haptics}
            onChange={(e) => actions.updateSettings({ haptics: e.target.checked })}
          />
        </label>
      </div>

      <div className="section-label">Cálculo</div>
      <div className="card">
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field__label">Absorción del café (ml por gramo)</span>
          <input
            className="input tnum"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            max="4"
            value={store.settings.absorptionMlPerG}
            onChange={(e) => actions.updateSettings({ absorptionMlPerG: Number(e.target.value) })}
          />
          <span className="subtitle" style={{ display: 'block', marginTop: 8 }}>
            Cuánta agua retiene el lecho y no llega a la taza. 2.0 es el valor típico para V60. Solo afecta la
            conversión entre “agua total” y “ml en taza”.
          </span>
        </label>
      </div>

      <div className="section-label">Recetas</div>
      <button
        type="button"
        className="btn btn--block"
        onClick={() => {
          const existing = new Set(store.recipes.map((r) => r.name))
          const missing = seedRecipes().filter((r) => !existing.has(r.name))
          missing.forEach(actions.saveRecipe)
          setMessage(
            missing.length ? `Restauradas: ${missing.map((r) => r.name).join(', ')}.` : 'Ya tenés las tres.',
          )
        }}
      >
        Restaurar recetas originales (Hoffmann, Rao, Kasuya)
      </button>

      {pending && (
        <ImportSheet
          parsed={pending}
          onClose={() => setPending(null)}
          onReplace={() => {
            actions.replaceStore(pending.store)
            setMessage('Datos reemplazados desde el backup.')
            setPending(null)
          }}
          onMerge={() => {
            actions.replaceStore(mergeStores(store, pending.store))
            setMessage('Backup fusionado con los datos actuales.')
            setPending(null)
          }}
        />
      )}
    </>
  )
}

function ImportSheet({
  parsed,
  onReplace,
  onMerge,
  onClose,
}: {
  parsed: ParsedBackup
  onReplace: () => void
  onMerge: () => void
  onClose: () => void
}) {
  const [confirmReplace, setConfirmReplace] = useState(false)

  return (
    <Sheet
      title="Importar backup"
      subtitle={`El archivo trae ${parsed.coffees} cafés y ${parsed.recipes} recetas.`}
      onClose={onClose}
    >
      <button type="button" className="btn btn--primary btn--block" onClick={onMerge}>
        Fusionar
      </button>
      <div className="subtitle" style={{ margin: '8px 0 18px' }}>
        Conserva lo que tenés y agrega lo del archivo. Si un café está en los dos lados, gana la versión modificada
        más recientemente.
      </div>

      <button
        type="button"
        className={`btn btn--block${confirmReplace ? ' btn--danger' : ''}`}
        onClick={() => (confirmReplace ? onReplace() : setConfirmReplace(true))}
      >
        {confirmReplace ? 'Confirmar: borrar todo y reemplazar' : 'Reemplazar todo'}
      </button>
      <div className="subtitle" style={{ marginTop: 8 }}>
        Borra los datos actuales de este teléfono y deja solo los del archivo.
      </div>
    </Sheet>
  )
}
