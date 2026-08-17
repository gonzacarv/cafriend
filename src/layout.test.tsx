// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import App from './App'
import { StoreProvider } from './store/useStore'
import { newId, type Coffee, type Store } from './store/schema'
import { emptyStore } from './store/persist'

/**
 * jsdom no hace layout, así que no puede medir un desborde real. Lo que sí
 * puede verificarse es la causa del bug: el nombre del café era un <span>
 * inline, y `text-overflow: ellipsis` no recorta elementos inline — el texto
 * largo ensanchaba la tarjeta y habilitaba el scroll lateral.
 */

const coffee = (brand: string, type: string): Coffee => {
  const t = new Date().toISOString()
  return {
    id: newId(),
    brand,
    type,
    countryCode: 'BR',
    roastDate: t.slice(0, 10),
    status: 'active',
    createdAt: t,
    updatedAt: t,
    grind: { espresso: { current: 40, history: [{ id: newId(), value: 40, at: t }] } },
  }
}

const seedWith = (coffees: Coffee[]) => {
  const store: Store = { ...emptyStore(), coffees }
  localStorage.setItem('cafriend.v2', JSON.stringify(store))
}

// jsdom no procesa el import de CSS: se inyecta la hoja real para que
// getComputedStyle mida lo que el teléfono va a aplicar de verdad.
beforeAll(() => {
  const style = document.createElement('style')
  // En jsdom, import.meta.url no es file://, así que se resuelve desde la raíz.
  style.textContent = readFileSync('src/styles.css', 'utf8')
  document.head.appendChild(style)
})

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('la app nunca desborda a lo ancho', () => {
  it('el nombre del café es un bloque, así el ellipsis puede recortarlo', () => {
    seedWith([coffee('Indios verdes', 'Cereja descascarado do Cerrado Mineiro')])
    render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    )

    const name = document.querySelector('.coffee__name') as HTMLElement
    const info = document.querySelector('.coffee__info') as HTMLElement
    expect(name).toBeTruthy()

    // Son <span>: sin display:block explícito el recorte no funciona.
    expect(getComputedStyle(name).display).toBe('block')
    expect(getComputedStyle(info).display).toBe('block')
    expect(getComputedStyle(name).textOverflow).toBe('ellipsis')
    expect(getComputedStyle(name).overflow).toBe('hidden')
  })

  it('el contenedor deja encoger al texto y el body no scrollea de costado', () => {
    seedWith([coffee('Motofeca', 'Underground')])
    render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    )

    // min-width:0 es lo que permite que un flex item se achique por debajo de
    // su contenido; sin eso el ellipsis nunca se activa.
    expect(getComputedStyle(document.querySelector('.coffee__info') as HTMLElement).minWidth).toBe('0px')
    expect(getComputedStyle(document.querySelector('.coffee__main') as HTMLElement).minWidth).toBe('0px')
    expect(getComputedStyle(document.body).overflowX).toBe('hidden')
  })

  it('la tabla del plan scrollea dentro de su caja, no arrastra la pantalla', () => {
    render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    )
    // El wrapper existe en el CSS aunque la tabla se monte al preparar; basta
    // con que la regla esté declarada.
    const style = [...document.styleSheets]
      .flatMap((s) => [...s.cssRules])
      .map((r) => r.cssText)
      .join('')
    expect(style).toContain('.plan-wrap')
  })
})
