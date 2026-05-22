/**
 * Mapeo oficial de códigos de equipo a códigos de FlagCDN (ISO 3166-1 alpha-2)
 * Cubre los 48 equipos del Mundial 2026.
 */
const FLAG_MAPPING: Record<string, string> = {
  // Grupo A
  'MEX': 'mx',
  'RSA': 'za',
  'KOR': 'kr',
  'CZE': 'cz',
  // Grupo B
  'CAN': 'ca',
  'BIH': 'ba',
  'QAT': 'qa',
  'SUI': 'ch',
  // Grupo C
  'BRA': 'br',
  'MAR': 'ma',
  'HAI': 'ht',
  'SCO': 'gb-sct',
  // Grupo D
  'USA': 'us',
  'PAR': 'py',
  'AUS': 'au',
  'TUR': 'tr',
  // Grupo E
  'GER': 'de',
  'CUW': 'cw',
  'CIV': 'ci',
  'ECU': 'ec',
  // Grupo F
  'NED': 'nl',
  'JPN': 'jp',
  'SWE': 'se',
  'TUN': 'tn',
  // Grupo G
  'BEL': 'be',
  'EGY': 'eg',
  'IRN': 'ir',
  'NZL': 'nz',
  // Grupo H
  'ESP': 'es',
  'CPV': 'cv',
  'KSA': 'sa',
  'URU': 'uy',
  // Grupo I
  'FRA': 'fr',
  'SEN': 'sn',
  'IRQ': 'iq',
  'NOR': 'no',
  // Grupo J
  'ARG': 'ar',
  'ALG': 'dz',
  'AUT': 'at',
  'JOR': 'jo',
  // Grupo K
  'POR': 'pt',
  'COD': 'cd',
  'UZB': 'uz',
  'COL': 'co',
  // Grupo L
  'ENG': 'gb-eng',
  'CRO': 'hr',
  'GHA': 'gh',
  'PAN': 'pa',
};

/**
 * Retorna la URL de la bandera para un código de equipo dado.
 * Usa imágenes SVG de FlagCDN para máxima nitidez en cualquier resolución.
 * @param code Código de 3 letras (ej: 'ESP', 'ARG')
 * @returns URL de la imagen en FlagCDN
 */
export function getFlagUrl(code: string | null | undefined): string {
  if (!code) return '/logo26.png';
  const cleanCode = code.toUpperCase().trim();
  const iso = FLAG_MAPPING[cleanCode];
  
  if (!iso) {
    // Si no está en el mapa pero es un código ISO 2 letras válido, usarlo
    if (cleanCode.length === 2) {
      return `https://flagcdn.com/w160/${cleanCode.toLowerCase()}.png`;
    }
    // En cualquier otro caso (TBD, 1A, etc.), retornar placeholder
    return '/logo26.png';
  }
  
  return `https://flagcdn.com/w160/${iso}.png`;
}
