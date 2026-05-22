export interface TeamStanding {
  teamId: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  played: number;
  group_letter: string;
}

export function calculateOfficialStandings(matches: any[], results: any[], teams: any[]): Record<string, TeamStanding[]> {
  const standings: Record<string, TeamStanding[]> = {};

  // Inicializar standings para todos los equipos
  teams.forEach(team => {
    if (!standings[team.group_letter]) standings[team.group_letter] = [];
    standings[team.group_letter].push({
      teamId: team.id,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      played: 0,
      group_letter: team.group_letter
    });
  });

  // Procesar resultados oficiales
  results.forEach(res => {
    const match = matches.find(m => m.id === res.match_id);
    if (!match || match.stage !== 'group') return;

    const group = match.group_letter;
    const teamA = standings[group].find(s => s.teamId === match.team_a_id);
    const teamB = standings[group].find(s => s.teamId === match.team_b_id);

    if (teamA && teamB) {
      teamA.played++;
      teamB.played++;
      teamA.goalsFor += res.score_a;
      teamA.goalsAgainst += res.score_b;
      teamB.goalsFor += res.score_b;
      teamB.goalsAgainst += res.score_a;
      teamA.goalDifference = teamA.goalsFor - teamA.goalsAgainst;
      teamB.goalDifference = teamB.goalsFor - teamB.goalsAgainst;

      if (res.score_a > res.score_b) teamA.points += 3;
      else if (res.score_a < res.score_b) teamB.points += 3;
      else {
        teamA.points += 1;
        teamB.points += 1;
      }
    }
  });

  // Ordenar cada grupo según reglas FIFA
  Object.keys(standings).forEach(group => {
    standings[group].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });
  });

  return standings;
}

/**
 * Lógica de emparejamientos para el Mundial 2026 (48 equipos)
 * Cruces de Dieciseisavos (R32)
 * Fuente: FIFA (Simplificado para la porra)
 */
export function getR32Pairings(groupStandings: Record<string, TeamStanding[]>) {
  const allThirds: TeamStanding[] = Object.values(groupStandings)
    .map(group => group[2])
    .filter(Boolean)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

  const best8Thirds = allThirds.slice(0, 8);

  // Mapeo de cruces R32 oficial (Match Number -> Pairings)
  // Basado en el formato de 48 equipos de la FIFA
  return {
    73: { a: groupStandings['A'][0]?.teamId, b: best8Thirds[0]?.teamId },
    74: { a: groupStandings['B'][1]?.teamId, b: groupStandings['C'][1]?.teamId },
    75: { a: groupStandings['E'][0]?.teamId, b: groupStandings['F'][1]?.teamId },
    76: { a: groupStandings['G'][0]?.teamId, b: groupStandings['H'][1]?.teamId },
    77: { a: groupStandings['I'][0]?.teamId, b: best8Thirds[1]?.teamId },
    78: { a: groupStandings['K'][1]?.teamId, b: groupStandings['L'][1]?.teamId },
    79: { a: groupStandings['B'][0]?.teamId, b: best8Thirds[2]?.teamId },
    80: { a: groupStandings['C'][0]?.teamId, b: best8Thirds[3]?.teamId },
    81: { a: groupStandings['D'][0]?.teamId, b: groupStandings['A'][1]?.teamId },
    82: { a: groupStandings['F'][0]?.teamId, b: groupStandings['E'][1]?.teamId },
    83: { a: groupStandings['H'][0]?.teamId, b: groupStandings['G'][1]?.teamId },
    84: { a: groupStandings['J'][0]?.teamId, b: best8Thirds[4]?.teamId },
    85: { a: groupStandings['L'][0]?.teamId, b: best8Thirds[5]?.teamId },
    86: { a: groupStandings['I'][1]?.teamId, b: groupStandings['J'][1]?.teamId },
    87: { a: groupStandings['K'][0]?.teamId, b: best8Thirds[6]?.teamId },
    88: { a: groupStandings['D'][1]?.teamId, b: best8Thirds[7]?.teamId }
  };
}
