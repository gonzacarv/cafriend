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
    expect(screen.getByText(/Tetsu Kasuya · 1:15 · 5 vertidos · 3:30/)).toBeTruthy()
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
    expect(rows.map((r) => r.querySelectorAll('td')[3].textContent)).toEqual(['48 g', '192 g', '288 g', '—'])

    // Y separa vertido de espera: el bloom de Hoffmann es pulsado, los pours
    // continuos (columnas: paso, verté, esperá, balanza).
    expect([...rows[0].querySelectorAll('td')].map((td) => td.textContent)).toEqual([
      'Bloomdesde 0:00',
      '0:08', // 48 g a 6 g/s
      '0:22',
      '48 g',
    ])
    expect(rows[1].querySelectorAll('td')[2].textContent).toBe('—') // continuo: sin espera
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

    // Arranca vertiendo, no esperando.
    expect(screen.getByText('Verté')).toBeTruthy()
    expect(screen.getByText('48 g')).toBeTruthy() // Rao.1: bloom 48 ml
    expect(screen.getByText(/48 g en 0:08/)).toBeTruthy()
    // Bloom pulsado: 48 g a 6 g/s son 8 s de vertido, y quedan 37 s de espera.
    expect(screen.getByText('esperar 0:37')).toBeTruthy()
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
      const card = screen.getByText('Kasuya 4:6').closest('.card') as HTMLElement
      await user.click(within(card).getByRole('button', { name: 'Preparar Kasuya 4:6' }))

      const dialog = screen.getByRole('dialog')
      await user.click(within(dialog).getByRole('tab', { name: 'Café' }))
      const input = within(dialog).getByLabelText('Cantidad')
      await user.clear(input)
      await user.type(input, '20')
      await user.click(within(dialog).getByRole('button', { name: '▶ Iniciar' }))

      const jump = async (seconds: number) => {
        await act(async () => {
          vi.advanceTimersByTime(seconds * 1000)
        })
      }

      // Kasuya 4:6 a 20 g / 300 ml: 50 → 120 → 180 → 240 → 300 g, todos pulsados.
      // Cada pulso alterna vertido corto y espera larga.
      const target = () => screen.getByText(/^\d+ g$/).textContent

      expect(screen.getByText('Verté')).toBeTruthy()
      expect(target()).toBe('50 g') // bloom: 50 g en ~8 s

      await jump(20) // dentro de la espera del bloom
      expect(screen.getByText('Esperá')).toBeTruthy()
      // El bloom tiene su propia pista: ahí lo que pasa es la desgasificación.
      expect(screen.getByText(/libera CO₂/)).toBeTruthy()

      await jump(30) // 0:50 → segundo pulso
      expect(screen.getByText('Verté')).toBeTruthy()
      expect(target()).toBe('120 g')

      await jump(25) // 1:15 → espera del segundo pulso: ahí sí la pista de drenado
      expect(screen.getByText('Esperá')).toBeTruthy()
      expect(screen.getByText('debería quedar casi drenado, no seco')).toBeTruthy()

      await jump(20) // 1:35 → tercer pulso
      expect(screen.getByText('Verté')).toBeTruthy()
      expect(target()).toBe('180 g')

      await jump(40) // 2:15 → cuarto pulso
      expect(target()).toBe('240 g')

      await jump(40) // 2:55 → quinto y último pulso
      expect(target()).toBe('300 g')

      await jump(20) // 3:15 → drenado, sin verter
      expect(screen.getByText(/no viertas más/)).toBeTruthy()
      expect(screen.getByText('el filtro debería quedar seco al terminar')).toBeTruthy()

      await jump(20) // 3:35 → pasó el fin (3:30): resumen
      expect(screen.getByText('Lectura del drenado')).toBeTruthy()
      expect(screen.getByText(/quedar seco justo en/)).toBeTruthy()
      expect(screen.getByText(/pulsos tardíos drenan más lento/)).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('la pista de la espera se edita en la receta y aparece en el asistente', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /V60/ }))

    // Rao: el bloom es pulsado, así que tiene pista editable.
    await user.click(screen.getByRole('button', { name: 'Editar Rao' }))
    const hints = within(screen.getByRole('dialog')).getAllByLabelText(/Qué mirar durante la espera/)
    await user.clear(hints[0])
    await user.type(hints[0], 'mirá la cúpula, no la balanza')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    const card = screen.getByText('Rao').closest('.card') as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Preparar Rao' }))
    await user.click(screen.getByRole('button', { name: '▶ Iniciar' }))

    // Durante el vertido no se muestra; es una guía para cuando no vertés.
    expect(screen.getByText('Verté')).toBeTruthy()
    expect(screen.queryByText('mirá la cúpula, no la balanza')).toBeNull()
  })

  it('un vertido continuo no pide pista de espera: no tiene ese momento', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /V60/ }))
    await user.click(screen.getByRole('button', { name: 'Editar Rao' }))

    const dialog = screen.getByRole('dialog')
    // Rao tiene 4 pasos: bloom (pulso), 2 pours continuos y drenado.
    // Solo el bloom y el drenado tienen campo de pista.
    expect(within(dialog).getAllByLabelText(/Qué mirar durante la espera/)).toHaveLength(2)
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

/**
 * En Android, sin una entrada de historial propia, el gesto de volver cierra
 * la app entera. Cada overlay tiene que consumirlo.
 */
describe('volver atrás', () => {
  /** Lo que hace Android: retroceder en el historial del WebView. */
  const pressBack = async () => {
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    })
  }

  it('cierra el sheet de alta de café sin salir de la app', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: '+ Café' }))
    expect(screen.getByRole('dialog')).toBeTruthy()

    await pressBack()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: '+ Café' })).toBeTruthy()
  })

  it('cierra el editor de recetas', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /V60/ }))

    await user.click(screen.getByRole('button', { name: 'Editar Hoffmann' }))
    expect(screen.getByRole('dialog')).toBeTruthy()

    await pressBack()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('sale de la pantalla de preparar una receta', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /V60/ }))

    const card = screen.getByText('Rao').closest('.card') as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Preparar Rao' }))
    expect(screen.getByRole('button', { name: '▶ Iniciar' })).toBeTruthy()

    await pressBack()
    expect(screen.queryByRole('button', { name: '▶ Iniciar' })).toBeNull()
    expect(screen.getByText('Kasuya 4:6')).toBeTruthy()
  })

  it('sale del asistente con el brew en curso', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /V60/ }))

    const card = screen.getByText('Rao').closest('.card') as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Preparar Rao' }))
    await user.click(screen.getByRole('button', { name: '▶ Iniciar' }))
    expect(screen.getByText('Verté')).toBeTruthy()

    await pressBack()
    expect(screen.queryByText('Verté')).toBeNull()
    expect(screen.getByText('Hoffmann')).toBeTruthy()
  })

  it('sobrevive a que un sheet reemplace a otro en el mismo commit', async () => {
    // Ficha del café → "Editar datos" desmonta un sheet y monta otro en el
    // mismo commit. Si el descuento del historial no se difiriera, el sheet
    // nuevo recibiría el popstate del viejo y se cerraría solo.
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: '+ Café' }))
    await user.type(screen.getByLabelText('Marca'), 'KOPI')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await user.click(screen.getByText('KOPI'))
    await user.click(screen.getByRole('button', { name: 'Editar datos' }))

    // El formulario sigue abierto, no se cerró solo.
    await act(async () => {})
    expect(screen.getByLabelText('Marca')).toBeTruthy()

    // Y volver lo cierra a él.
    await pressBack()
    expect(screen.queryByLabelText('Marca')).toBeNull()
  })

  it('no deja entradas de historial acumuladas al abrir y cerrar', async () => {
    const user = userEvent.setup()
    renderApp()
    const before = history.length

    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: '+ Café' }))
      await user.click(screen.getByRole('button', { name: 'Cancelar' }))
      await act(async () => {})
    }

    expect(history.length).toBeLessThanOrEqual(before + 1)
  })

  it('todos los sheets tienen además un botón visible para cerrar', async () => {
    const user = userEvent.setup()
    renderApp()

    // El de preparar la receta era el que no tenía ninguna salida a la vista.
    await user.click(screen.getByRole('button', { name: /V60/ }))
    const card = screen.getByText('Hoffmann').closest('.card') as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Preparar Hoffmann' }))

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
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
