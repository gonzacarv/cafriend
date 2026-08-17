/**
 * Bandera emoji desde un código ISO-3166 alpha-2, usando regional indicators.
 * Sin imágenes ni red: Android las renderiza de forma nativa.
 */
export function flagEmoji(countryCode: string): string {
  const code = countryCode.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return '☕'
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export type Country = { code: string; name: string }

/**
 * Países productores de café, en el orden en que conviene ofrecerlos. Son los
 * que aparecen sin buscar nada; el resto del mundo está disponible igual, pero
 * escribiendo.
 */
const PRODUCER_CODES = [
  'BR', 'CO', 'ET', 'KE', 'GT', 'CR', 'PE', 'HN', 'MX', 'NI',
  'SV', 'PA', 'EC', 'BO', 'VE', 'JM', 'DO', 'CU', 'ID', 'VN',
  'IN', 'PG', 'TL', 'YE', 'RW', 'BI', 'TZ', 'UG', 'CD', 'CI',
  'CM', 'ZM', 'MW', 'ZW', 'MG', 'HT', 'PH', 'TH', 'LA', 'MM',
  'CN', 'AR', 'US',
]

/** Los 249 códigos asignados de ISO-3166-1 alpha-2. */
const ALL_CODES = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL
BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV
CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD
GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM
IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK
LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW
MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR
PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS
ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY
UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
`
  .trim()
  .split(/\s+/)

/**
 * Los nombres salen de Intl en vez de una tabla propia: son ~250 países y el
 * navegador ya los tiene traducidos. Si el motor no soporta DisplayNames se
 * cae al código, que sigue siendo utilizable junto a la banderita.
 */
const displayNames = (() => {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' })
  } catch {
    return null
  }
})()

const nameCache = new Map<string, string>()

export function countryName(code: string): string {
  const key = code.trim().toUpperCase()
  if (!key) return ''
  const cached = nameCache.get(key)
  if (cached) return cached

  let name = key
  try {
    name = displayNames?.of(key) ?? key
  } catch {
    /* código inválido: se muestra tal cual */
  }
  nameCache.set(key, name)
  return name
}

const country = (code: string): Country => ({ code, name: countryName(code) })

/** Productores primero y después el resto, alfabético y sin repetir. */
const ALL_COUNTRIES: Country[] = (() => {
  const producers = PRODUCER_CODES.map(country)
  const seen = new Set(PRODUCER_CODES)
  const rest = ALL_CODES.filter((c) => !seen.has(c))
    .map(country)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return [...producers, ...rest]
})()

/** Sin buscar nada se ofrecen solo los productores: son el 99 % de las altas. */
export const PRODUCERS: Country[] = ALL_COUNTRIES.slice(0, PRODUCER_CODES.length)

export function searchCountries(query: string): Country[] {
  const q = normalizeText(query)
  if (!q) return PRODUCERS
  return ALL_COUNTRIES.filter(
    (c) => normalizeText(c.name).includes(q) || c.code.toLowerCase() === q,
  )
}

/** Sin acentos y en minúsculas, para que "peru" encuentre "Perú". */
function normalizeText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
