export interface Country {
  code: string
  name: string
  locale: string
  currency: string
  timeZone: string
}

export const COUNTRIES: Country[] = [
  { code: 'FR', name: 'France', locale: 'fr-FR', currency: 'EUR', timeZone: 'Europe/Paris' },
  { code: 'BE', name: 'Belgique', locale: 'fr-BE', currency: 'EUR', timeZone: 'Europe/Brussels' },
  { code: 'CH', name: 'Suisse', locale: 'fr-CH', currency: 'CHF', timeZone: 'Europe/Zurich' },
  { code: 'CA', name: 'Canada', locale: 'fr-CA', currency: 'CAD', timeZone: 'America/Toronto' },
  { code: 'LU', name: 'Luxembourg', locale: 'fr-LU', currency: 'EUR', timeZone: 'Europe/Luxembourg' },
  { code: 'MC', name: 'Monaco', locale: 'fr-MC', currency: 'EUR', timeZone: 'Europe/Monaco' },
  { code: 'MA', name: 'Maroc', locale: 'fr-MA', currency: 'MAD', timeZone: 'Africa/Casablanca' },
  { code: 'DZ', name: 'Algérie', locale: 'fr-DZ', currency: 'DZD', timeZone: 'Africa/Algiers' },
  { code: 'TN', name: 'Tunisie', locale: 'fr-TN', currency: 'TND', timeZone: 'Africa/Tunis' },
  { code: 'SN', name: 'Sénégal', locale: 'fr-SN', currency: 'XOF', timeZone: 'Africa/Dakar' },
  { code: 'CI', name: "Côte d'Ivoire", locale: 'fr-CI', currency: 'XOF', timeZone: 'Africa/Abidjan' },
  { code: 'GB', name: 'Royaume-Uni', locale: 'en-GB', currency: 'GBP', timeZone: 'Europe/London' },
  { code: 'US', name: 'États-Unis', locale: 'en-US', currency: 'USD', timeZone: 'America/New_York' },
  { code: 'DE', name: 'Allemagne', locale: 'de-DE', currency: 'EUR', timeZone: 'Europe/Berlin' },
  { code: 'ES', name: 'Espagne', locale: 'es-ES', currency: 'EUR', timeZone: 'Europe/Madrid' },
  { code: 'IT', name: 'Italie', locale: 'it-IT', currency: 'EUR', timeZone: 'Europe/Rome' },
  { code: 'PT', name: 'Portugal', locale: 'pt-PT', currency: 'EUR', timeZone: 'Europe/Lisbon' },
]

export function getCountry(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0]
}
