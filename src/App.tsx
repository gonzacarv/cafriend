import { useState } from 'react'
import { EspressoView } from './features/espresso/EspressoView'
import { V60View } from './features/v60/V60View'
import { SettingsView } from './features/settings/SettingsView'

type Tab = 'espresso' | 'v60' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'espresso', label: 'Espresso', icon: '☕' },
  { id: 'v60', label: 'V60', icon: '🌀' },
  { id: 'settings', label: 'Ajustes', icon: '⚙️' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('espresso')

  return (
    <div className="app">
      <main className="app__body">
        {tab === 'espresso' && <EspressoView />}
        {tab === 'v60' && <V60View />}
        {tab === 'settings' && <SettingsView />}
      </main>

      <nav className="nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="nav__item"
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            <span className="nav__icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
