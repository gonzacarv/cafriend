// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { StoreProvider } from './store/useStore'

const renderApp = () => render(<StoreProvider><App /></StoreProvider>)

beforeEach(() => localStorage.clear())
afterEach(cleanup)

/** El flujo real: alta de café → setting → historial → finalizar. */
describe('Espresso', () => {
  it('da de alta un café con bandera y setting inicial, y lo persiste', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(screen.getByText('No tenés cafés en curso.')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '+ Café' }))
    await user.type(screen.getByLabelText('Marca'), 'John&Joe')
    await user.type(screen.getByLabelText('Tipo'), 'Colombia')
    await user.click(screen.getByRole('button', { name: /Colombia$/ }))
    await user.type(screen.getByLabelText(/Setting de molinillo inicial/), '41')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(screen.getByText('John&Joe')).toBeTruthy()
    expect(screen.getByText('41')).toBeTruthy()
    expect(screen.getByText('🇨🇴')).toBeTruthy()

    // Lo guardado en localStorage sobrevive a un remount.
    cleanup()
    renderApp()
    expect(screen.getByText('John&Joe')).toBeTruthy()
    expect(screen.getByText('41')).toBeTruthy()
  })

  it('registra un cambio de setting con nota y lo muestra en el historial', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: '+ Café' }))
    await user.type(screen.getByLabelText('Marca'), 'KOPI')
    await user.type(screen.getByLabelText(/Setting de molinillo inicial/), '38')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await user.click(screen.getByRole('button', { name: 'Cambiar setting de KOPI' }))
    await user.click(screen.getByRole('button', { name: 'Más grueso' }))
    await user.click(screen.getByRole('button', { name: 'Más grueso' }))
    expect((screen.getByLabelText('Setting de molinillo') as HTMLInputElement).value).toBe('40')
    await user.type(screen.getByLabelText('Nota (opcional)'), 'salía muy lento')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(screen.getByText('40')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeTruthy()

    await user.click(screen.getByText('KOPI'))
    expect(screen.getByText('Historial de molienda (2)')).toBeTruthy()
    expect(screen.getByText('salía muy lento')).toBeTruthy()
    expect(screen.getByText('↑ 2')).toBeTruthy() // subió 2 = más grueso
  })

  it('deshacer revierte el último cambio', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: '+ Café' }))
    await user.type(screen.getByLabelText('Marca'), 'Cuervo')
    await user.type(screen.getByLabelText(/Setting de molinillo inicial/), '44')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await user.click(screen.getByRole('button', { name: 'Cambiar setting de Cuervo' }))
    await user.click(screen.getByRole('button', { name: 'Más fino' }))
    await user.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(screen.getByText('43')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(screen.getByText('44')).toBeTruthy()
  })

  it('finaliza un café y lo conserva con su historial', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: '+ Café' }))
    await user.type(screen.getByLabelText('Marca'), 'Puerto Blest')
    await user.type(screen.getByLabelText(/Setting de molinillo inicial/), '38')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await user.click(screen.getByText('Puerto Blest'))
    await user.click(screen.getByRole('button', { name: /Se me acabó/ }))

    expect(screen.getByRole('tab', { name: 'En curso (0)' })).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Finalizados (1)' }))
    expect(screen.getByText('Puerto Blest')).toBeTruthy()

    // En finalizados el número no ajusta: abre la ficha en solo lectura.
    await user.click(screen.getByRole('button', { name: 'Ver Puerto Blest' }))
    expect(screen.getByText('Historial de molienda (1)')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cambiar setting' })).toBeNull()
    expect(screen.getByRole('button', { name: /Reactivar/ })).toBeTruthy()
  })
})

describe('V60', () => {
  const goToV60 = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: /V60/ }))

  it('muestra las tres recetas semilla', async () => {
    const user = userEvent.setup()
    renderApp()
    await goToV60(user)

    expect(screen.getByText('Hoffmann')).toBeTruthy()
    expect(screen.getByText('Rao')).toBeTruthy()
    expect(screen.getByText('Kasuya 4:6')).toBeTruthy()
    expect(screen.getByText(/James Hoffmann · 1:15 · 3 vertidos · 2:30/)).toBeTruthy()
  })

  it('el setup calcula las tres magnitudes y arma el plan', async () => {
    const user = userEvent.setup()
    renderApp()
    await goToV60(user)

    const hoffCard = screen.getByText('Hoffmann').closest('.card') as HTMLElement
    await user.click(within(hoffCard).getByRole('button', { name: 'Preparar Hoffmann' }))

    // Por defecto entra por "en taza": 250 ml → 19.2 g y 288 ml de agua.
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('19.2')).toBeTruthy()
    expect(within(dialog).getByText('288')).toBeTruthy()

    // Cambiar a "Café" mantiene la magnitud equivalente.
    await user.click(within(dialog).getByRole('tab', { name: 'Café' }))
    expect((within(dialog).getByLabelText('Cantidad') as HTMLInputElement).value).toBe('19.2')

    // El plan lista los objetivos de balanza, cerrando en el agua total.
    const rows = within(dialog).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.querySelectorAll('td')[2].textContent)).toEqual(['48 g', '192 g', '288 g', '—'])
  })

  it('el asistente arranca en el bloom y muestra el objetivo en balanza', async () => {
    const user = userEvent.setup()
    renderApp()
    await goToV60(user)

    const raoCard = screen.getByText('Rao').closest('.card') as HTMLElement
    await user.click(within(raoCard).getByRole('button', { name: 'Preparar Rao' }))

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('tab', { name: 'Café' }))
    const input = within(dialog).getByLabelText('Cantidad')
    await user.clear(input)
    await user.type(input, '16')
    await user.click(within(dialog).getByRole('button', { name: '▶ Iniciar' }))

    expect(screen.getByText('Bloom')).toBeTruthy()
    expect(screen.getByText('48 g')).toBeTruthy() // Rao.1: bloom 48 ml
    expect(screen.getByText(/Sigue:/)).toBeTruthy()
    expect(screen.getByText(/16 g · 240 ml/)).toBeTruthy()
    // Sin botones de avance manual: la receta corre sola de punta a punta.
    expect(screen.queryByRole('button', { name: /Saltar|Ya drenó|\+5/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Pausar/ })).toBeTruthy()
  })

  it('el asistente avanza solo por todos los pasos hasta el resumen', async () => {
    // El reloj del asistente se deriva de performance.now(), así que los
    // timers falsos lo mueven igual que el reloj de pared del teléfono.
    vi.useFakeTimers({ toFake: ['performance', 'requestAnimationFrame', 'Date'] })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    try {
      renderApp()
      await user.click(screen.getByRole('button', { name: /V60/ }))
      const raoCard = screen.getByText('Rao').closest('.card') as HTMLElement
      await user.click(within(raoCard).getByRole('button', { name: 'Preparar Rao' }))

      const dialog = screen.getByRole('dialog')
      await user.click(within(dialog).getByRole('tab', { name: 'Café' }))
      const input = within(dialog).getByLabelText('Cantidad')
      await user.clear(input)
      await user.type(input, '16')
      await user.click(within(dialog).getByRole('button', { name: '▶ Iniciar' }))

      const jump = async (seconds: number) => {
        await act(async () => {
          vi.advanceTimersByTime(seconds * 1000)
        })
      }

      // Rao.1 (16 g / 240 ml): bloom→48 g, pour 1→180 g, pour 2→240 g, fin 2:45.
      expect(screen.getByText('Bloom')).toBeTruthy()
      expect(screen.getByText('48 g')).toBeTruthy()

      await jump(50) // 0:50 → Pour 1
      expect(screen.getByText('Pour 1')).toBeTruthy()
      expect(screen.getByText('180 g')).toBeTruthy()

      await jump(50) // 1:40 → Pour 2
      expect(screen.getByText('Pour 2')).toBeTruthy()
      expect(screen.getByText('240 g')).toBeTruthy()

      await jump(30) // 2:10 → Drenado, sin verter
      expect(screen.getByText('Drenado')).toBeTruthy()
      expect(screen.getByText(/no viertas más/)).toBeTruthy()

      await jump(40) // 2:50 → pasó el fin (2:45): resumen
      expect(screen.getByText('Lectura del drenado')).toBeTruthy()
      expect(screen.getByText(/quedar seco justo en/)).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('el editor rechaza una receta que no cierra en el 100 %', async () => {
    const user = userEvent.setup()
    renderApp()
    await goToV60(user)

    await user.click(screen.getByRole('button', { name: 'Editar Hoffmann' }))
    const dialog = screen.getByRole('dialog')
    const acumulados = within(dialog).getAllByLabelText('Acumulado')
    await user.clear(acumulados[acumulados.length - 1])
    await user.type(acumulados[acumulados.length - 1], '200')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(screen.getByText(/tiene que llegar al 100 %/)).toBeTruthy()
  })
})

describe('Ajustes', () => {
  it('exporta e importa reemplazando los datos', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: '+ Café' }))
    await user.type(screen.getByLabelText('Marca'), 'Violeta')
    await user.type(screen.getByLabelText(/Setting de molinillo inicial/), '42')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await user.click(screen.getByRole('button', { name: /Ajustes/ }))
    expect(screen.getByText('1 café')).toBeTruthy()
    expect(screen.getByText(/Nunca exportaste/)).toBeTruthy()
  })

  it('el toggle de sonido persiste', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /Ajustes/ }))

    const sound = screen.getByRole('checkbox', { name: /Sonido/ })
    expect((sound as HTMLInputElement).checked).toBe(true)
    await user.click(sound)

    cleanup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /Ajustes/ }))
    expect((screen.getByRole('checkbox', { name: /Sonido/ }) as HTMLInputElement).checked).toBe(false)
  })
})
