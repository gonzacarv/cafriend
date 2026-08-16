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

/** Países productores primero — son el 99 % de las altas. */
export const PRODUCERS: Country[] = [
  { code: 'BR', name: 'Brasil' },
  { code: 'CO', name: 'Colombia' },
  { code: 'ET', name: 'Etiopía' },
  { code: 'KE', name: 'Kenia' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'PE', name: 'Perú' },
  { code: 'HN', name: 'Honduras' },
  { code: 'MX', name: 'México' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'PA', name: 'Panamá' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'DO', name: 'República Dominicana' },
  { code: 'CU', name: 'Cuba' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'IN', name: 'India' },
  { code: 'PG', name: 'Papúa Nueva Guinea' },
  { code: 'TL', name: 'Timor Oriental' },
  { code: 'YE', name: 'Yemen' },
  { code: 'RW', name: 'Ruanda' },
  { code: 'BI', name: 'Burundi' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'UG', name: 'Uganda' },
  { code: 'CD', name: 'Congo (RDC)' },
  { code: 'CI', name: "Costa de Marfil" },
  { code: 'CM', name: 'Camerún' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'MW', name: 'Malaui' },
  { code: 'ZW', name: 'Zimbabue' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'HT', name: 'Haití' },
  { code: 'PH', name: 'Filipinas' },
  { code: 'TH', name: 'Tailandia' },
  { code: 'LA', name: 'Laos' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'CN', name: 'China' },
  { code: 'AR', name: 'Argentina' },
  { code: 'US', name: 'Estados Unidos (Hawái)' },
]

export function searchCountries(query: string): Country[] {
  const q = normalizeText(query)
  if (!q) return PRODUCERS
  return PRODUCERS.filter((c) => normalizeText(c.name).includes(q) || c.code.toLowerCase() === q)
}

/** Sin acentos y en minúsculas, para que "peru" encuentre "Perú". */
function normalizeText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function countryName(code: string): string {
  return PRODUCERS.find((c) => c.code === code.toUpperCase())?.name ?? code.toUpperCase()
}
