/* ============================================
   Porra Mundial - Datos del Torneo
   FIFA World Cup 2026 - 48 equipos, 12 grupos
   ============================================ */

export interface TeamData {
  name: string;
  code: string;
  group: string;
  fifaRanking: number;
  flagEmoji: string;
}

// 48 equipos clasificados al Mundial 2026 con sus grupos oficiales
export const TEAMS: TeamData[] = [
  // Grupo A
  { name: 'México', code: 'MEX', group: 'A', fifaRanking: 15, flagEmoji: '🇲🇽' },
  { name: 'Sudáfrica', code: 'RSA', group: 'A', fifaRanking: 59, flagEmoji: '🇿🇦' },
  { name: 'República de Corea', code: 'KOR', group: 'A', fifaRanking: 22, flagEmoji: '🇰🇷' },
  { name: 'República Checa', code: 'CZE', group: 'A', fifaRanking: 40, flagEmoji: '🇨🇿' },

  // Grupo B
  { name: 'Canadá', code: 'CAN', group: 'B', fifaRanking: 43, flagEmoji: '🇨🇦' },
  { name: 'Bosnia y Herzegovina', code: 'BIH', group: 'B', fifaRanking: 74, flagEmoji: '🇧🇦' },
  { name: 'Catar', code: 'QAT', group: 'B', fifaRanking: 37, flagEmoji: '🇶🇦' },
  { name: 'Suiza', code: 'SUI', group: 'B', fifaRanking: 19, flagEmoji: '🇨🇭' },

  // Grupo C
  { name: 'Brasil', code: 'BRA', group: 'C', fifaRanking: 5, flagEmoji: '🇧🇷' },
  { name: 'Marruecos', code: 'MAR', group: 'C', fifaRanking: 14, flagEmoji: '🇲🇦' },
  { name: 'Haití', code: 'HAI', group: 'C', fifaRanking: 90, flagEmoji: '🇭🇹' },
  { name: 'Escocia', code: 'SCO', group: 'C', fifaRanking: 39, flagEmoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },

  // Grupo D
  { name: 'Estados Unidos', code: 'USA', group: 'D', fifaRanking: 16, flagEmoji: '🇺🇸' },
  { name: 'Paraguay', code: 'PAR', group: 'D', fifaRanking: 56, flagEmoji: '🇵🇾' },
  { name: 'Australia', code: 'AUS', group: 'D', fifaRanking: 24, flagEmoji: '🇦🇺' },
  { name: 'Turquía', code: 'TUR', group: 'D', fifaRanking: 26, flagEmoji: '🇹🇷' },

  // Grupo E
  { name: 'Alemania', code: 'GER', group: 'E', fifaRanking: 11, flagEmoji: '🇩🇪' },
  { name: 'Curazao', code: 'CUW', group: 'E', fifaRanking: 91, flagEmoji: '🇨🇼' },
  { name: 'Costa de Marfil', code: 'CIV', group: 'E', fifaRanking: 38, flagEmoji: '🇨🇮' },
  { name: 'Ecuador', code: 'ECU', group: 'E', fifaRanking: 30, flagEmoji: '🇪🇨' },

  // Grupo F
  { name: 'Países Bajos', code: 'NED', group: 'F', fifaRanking: 7, flagEmoji: '🇳🇱' },
  { name: 'Japón', code: 'JPN', group: 'F', fifaRanking: 17, flagEmoji: '🇯🇵' },
  { name: 'Suecia', code: 'SWE', group: 'F', fifaRanking: 27, flagEmoji: '🇸🇪' },
  { name: 'Túnez', code: 'TUN', group: 'F', fifaRanking: 41, flagEmoji: '🇹🇳' },

  // Grupo G
  { name: 'Bélgica', code: 'BEL', group: 'G', fifaRanking: 3, flagEmoji: '🇧🇪' },
  { name: 'Egipto', code: 'EGY', group: 'G', fifaRanking: 36, flagEmoji: '🇪🇬' },
  { name: 'Irán', code: 'IRN', group: 'G', fifaRanking: 20, flagEmoji: '🇮🇷' },
  { name: 'Nueva Zelanda', code: 'NZL', group: 'G', fifaRanking: 103, flagEmoji: '🇳🇿' },

  // Grupo H
  { name: 'España', code: 'ESP', group: 'H', fifaRanking: 8, flagEmoji: '🇪🇸' },
  { name: 'Cabo Verde', code: 'CPV', group: 'H', fifaRanking: 65, flagEmoji: '🇨🇻' },
  { name: 'Arabia Saudí', code: 'KSA', group: 'H', fifaRanking: 53, flagEmoji: '🇸🇦' },
  { name: 'Uruguay', code: 'URU', group: 'H', fifaRanking: 11, flagEmoji: '🇺🇾' },

  // Grupo I
  { name: 'Francia', code: 'FRA', group: 'I', fifaRanking: 2, flagEmoji: '🇫🇷' },
  { name: 'Senegal', code: 'SEN', group: 'I', fifaRanking: 17, flagEmoji: '🇸🇳' },
  { name: 'Irak', code: 'IRQ', group: 'I', fifaRanking: 58, flagEmoji: '🇮🇶' },
  { name: 'Noruega', code: 'NOR', group: 'I', fifaRanking: 47, flagEmoji: '🇳🇴' },

  // Grupo J
  { name: 'Argentina', code: 'ARG', group: 'J', fifaRanking: 1, flagEmoji: '🇦🇷' },
  { name: 'Argelia', code: 'ALG', group: 'J', fifaRanking: 43, flagEmoji: '🇩🇿' },
  { name: 'Austria', code: 'AUT', group: 'J', fifaRanking: 25, flagEmoji: '🇦🇹' },
  { name: 'Jordania', code: 'JOR', group: 'J', fifaRanking: 71, flagEmoji: '🇯🇴' },

  // Grupo K
  { name: 'Portugal', code: 'POR', group: 'K', fifaRanking: 6, flagEmoji: '🇵🇹' },
  { name: 'RD Congo', code: 'COD', group: 'K', fifaRanking: 63, flagEmoji: '🇨🇩' },
  { name: 'Uzbekistán', code: 'UZB', group: 'K', fifaRanking: 64, flagEmoji: '🇺🇿' },
  { name: 'Colombia', code: 'COL', group: 'K', fifaRanking: 12, flagEmoji: '🇨🇴' },

  // Grupo L
  { name: 'Inglaterra', code: 'ENG', group: 'L', fifaRanking: 4, flagEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { name: 'Croacia', code: 'CRO', group: 'L', fifaRanking: 10, flagEmoji: '🇭🇷' },
  { name: 'Ghana', code: 'GHA', group: 'L', fifaRanking: 61, flagEmoji: '🇬🇭' },
  { name: 'Panamá', code: 'PAN', group: 'L', fifaRanking: 45, flagEmoji: '🇵🇦' },
];

export const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export function getTeamsByGroup(group: string): TeamData[] {
  return TEAMS.filter((t) => t.group === group);
}

// Genera los 6 partidos de un grupo (round-robin de 4 equipos)
export function generateGroupMatches(group: string): { teamA: TeamData; teamB: TeamData }[] {
  const teams = getTeamsByGroup(group);
  if (teams.length !== 4) return [];

  return [
    { teamA: teams[0], teamB: teams[1] },
    { teamA: teams[2], teamB: teams[3] },
    { teamA: teams[0], teamB: teams[2] },
    { teamA: teams[1], teamB: teams[3] },
    { teamA: teams[0], teamB: teams[3] },
    { teamA: teams[1], teamB: teams[2] },
  ];
}

// Configuración de partidos bonus
export const BONUS_MATCHES = {
  inaugural: 1,     // México vs Sudáfrica
  final: true,
};

// Wizard steps
export const WIZARD_STEPS = [
  ...GROUPS.map((g) => ({ id: `group-${g}`, label: `Grupo ${g}`, type: 'group' as const })),
  { id: 'best-thirds', label: 'Mejores Terceros', type: 'bestThirds' as const },
  { id: 'r32', label: 'Dieciseisavos', type: 'knockout' as const },
  { id: 'r16', label: 'Octavos de Final', type: 'knockout' as const },
  { id: 'qf', label: 'Cuartos de Final', type: 'knockout' as const },
  { id: 'sf', label: 'Semifinales', type: 'knockout' as const },
  { id: 'third', label: 'Tercer Puesto', type: 'knockout' as const },
  { id: 'final', label: 'Final', type: 'knockout' as const },
  { id: 'honors', label: 'Cuadro de Honor', type: 'honors' as const },
  { id: 'summary', label: 'Resumen', type: 'summary' as const },
];
