import { describe, expect, it } from 'vitest'
import { countryName, flagEmoji, PRODUCERS, searchCountries } from './flags'

describe('flagEmoji', () => {
  it('arma la bandera con regional indicators', () => {
    expect(flagEmoji('AR')).toBe('🇦🇷')
    expect(flagEmoji('br')).toBe('🇧🇷')
    expect(flagEmoji('ET')).toBe('🇪🇹')
  })

  it('cae a la taza cuando el código no sirve', () => {
    for (const bad of ['', 'X', 'ARG', '12', '  ']) expect(flagEmoji(bad)).toBe('☕')
  })
})

describe('countryName', () => {
  it('devuelve el nombre en español', () => {
    expect(countryName('AR')).toBe('Argentina')
    expect(countryName('ET')).toBe('Etiopía')
    expect(countryName('br')).toBe('Brasil')
  })

  it('con un código sin asignar devuelve el código, no vacío', () => {
    // 'ZZ' no entra acá: ISO lo define como "región desconocida" y tiene
    // traducción propia. Los que no existen caen al código.
    expect(countryName('QQ')).toBe('QQ')
    expect(countryName('')).toBe('')
  })
})

describe('searchCountries', () => {
  it('sin búsqueda ofrece solo los países productores', () => {
    const results = searchCountries('')
    expect(results).toEqual(PRODUCERS)
    expect(results[0].code).toBe('BR')
    expect(results.some((c) => c.code === 'JP')).toBe(false)
  })

  it('encuentra países que no son productores', () => {
    // Este era el límite viejo: la lista tenía 43 países y nada más.
    for (const [query, code] of [
      ['japon', 'JP'],
      ['italia', 'IT'],
      ['nueva zelanda', 'NZ'],
      ['islandia', 'IS'],
      ['noruega', 'NO'],
    ] as const) {
      expect(searchCountries(query).some((c) => c.code === code)).toBe(true)
    }
  })

  it('ignora acentos y mayúsculas', () => {
    expect(searchCountries('peru')[0].code).toBe('PE')
    expect(searchCountries('PERÚ')[0].code).toBe('PE')
    expect(searchCountries('etiopia')[0].code).toBe('ET')
  })

  it('busca también por código exacto', () => {
    expect(searchCountries('jp').some((c) => c.code === 'JP')).toBe(true)
    expect(searchCountries('KE').some((c) => c.code === 'KE')).toBe(true)
  })

  it('cubre los 249 códigos asignados, sin repetidos', () => {
    // 'a' aparece en casi todos los nombres, pero para contar el total se usa
    // la unión de todas las búsquedas por código.
    const all = new Set<string>()
    for (const c of searchCountries('')) all.add(c.code)
    for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
      for (const c of searchCountries(letter)) all.add(c.code)
    }
    expect(all.size).toBe(249)
  })

  it('todo país listado produce una bandera real, nunca la taza', () => {
    for (const c of searchCountries('a')) expect(flagEmoji(c.code)).not.toBe('☕')
  })

  it('devuelve vacío cuando no hay coincidencias', () => {
    expect(searchCountries('zzzzz')).toEqual([])
  })
})
