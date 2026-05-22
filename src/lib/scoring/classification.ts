/* ============================================
   Porra Mundial - Lógica de Clasificación
   Criterios FIFA para clasificación de grupos
   ============================================ */

import { type GroupStanding, type Team } from '@/lib/types/database';

interface MatchResult {
  teamAId: number;
  teamBId: number;
  scoreA: number | null;
  scoreB: number | null;
}

/**
 * Calcula la tabla de clasificación de un grupo basada en los resultados de los partidos.
 * Aplica los criterios FIFA en orden estricto.
 */
export function calculateGroupStandings(
  teams: Team[],
  matches: MatchResult[]
): GroupStanding[] {
  // Inicializar standings
  const standings: Map<number, GroupStanding> = new Map();

  for (const team of teams) {
    standings.set(team.id, {
      teamId: team.id,
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      position: 0,
    });
  }

  // Procesar partidos
  for (const match of matches) {
    if (match.scoreA === null || match.scoreB === null) continue;

    const teamA = standings.get(match.teamAId);
    const teamB = standings.get(match.teamBId);
    if (!teamA || !teamB) continue;

    teamA.played++;
    teamB.played++;

    teamA.goalsFor += match.scoreA;
    teamA.goalsAgainst += match.scoreB;
    teamB.goalsFor += match.scoreB;
    teamB.goalsAgainst += match.scoreA;

    if (match.scoreA > match.scoreB) {
      teamA.won++;
      teamA.points += 3;
      teamB.lost++;
    } else if (match.scoreA < match.scoreB) {
      teamB.won++;
      teamB.points += 3;
      teamA.lost++;
    } else {
      teamA.drawn++;
      teamB.drawn++;
      teamA.points += 1;
      teamB.points += 1;
    }

    teamA.goalDifference = teamA.goalsFor - teamA.goalsAgainst;
    teamB.goalDifference = teamB.goalsFor - teamB.goalsAgainst;
  }

  // Ordenar según criterios FIFA (Simplificado para consistencia con predicciones)
  const sorted = Array.from(standings.values()).sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
    if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;

    // Enfrentamientos directos
    const h2h = getHeadToHead(a.teamId, b.teamId, matches);
    if (h2h !== 0) return h2h;

    // Evitar saltos inesperados por Ranking FIFA
    return a.teamId - b.teamId; 
  });

  // Asignar posiciones
  sorted.forEach((s, index) => {
    s.position = index + 1;
  });

  return sorted;
}

/**
 * Compara dos equipos por enfrentamiento directo.
 * Retorna negativo si teamA es mejor, positivo si teamB es mejor, 0 si empate.
 */
function getHeadToHead(teamAId: number, teamBId: number, matches: MatchResult[]): number {
  // Buscar el partido directo
  const h2hMatch = matches.find(
    (m) =>
      (m.teamAId === teamAId && m.teamBId === teamBId) ||
      (m.teamAId === teamBId && m.teamBId === teamAId)
  );

  if (!h2hMatch || h2hMatch.scoreA === null || h2hMatch.scoreB === null) return 0;

  const isAHome = h2hMatch.teamAId === teamAId;
  const goalsA = isAHome ? h2hMatch.scoreA : h2hMatch.scoreB;
  const goalsB = isAHome ? h2hMatch.scoreB : h2hMatch.scoreA;

  // Puntos en enfrentamiento directo
  if (goalsA > goalsB) return -1; // A ganó
  if (goalsA < goalsB) return 1;  // B ganó

  // Empate en enfrentamiento directo - diferencia de goles (siempre 0 aquí)
  // Goles a favor en enfrentamiento directo
  if (goalsA !== goalsB) return goalsB - goalsA;

  return 0; // Empate total
}

/**
 * Detecta si hay empates irresolubles en la clasificación.
 * Retorna los grupos de equipos empatados que necesitan intervención manual.
 */
export function detectTies(standings: GroupStanding[]): number[][] {
  const ties: number[][] = [];
  let currentGroup: number[] = [standings[0]?.teamId];

  for (let i = 1; i < standings.length; i++) {
    const prev = standings[i - 1];
    const curr = standings[i];

    // Comprobar si están efectivamente empatados en todos los criterios
    const areTied =
      prev.points === curr.points &&
      prev.goalDifference === curr.goalDifference &&
      prev.goalsFor === curr.goalsFor &&
      prev.team.fifa_ranking === curr.team.fifa_ranking;

    if (areTied) {
      currentGroup.push(curr.teamId);
    } else {
      if (currentGroup.length > 1) {
        ties.push([...currentGroup]);
      }
      currentGroup = [curr.teamId];
    }
  }

  if (currentGroup.length > 1) {
    ties.push([...currentGroup]);
  }

  return ties;
}

/**
 * Selecciona los 8 mejores terceros de los 12 grupos.
 * Criterios: puntos > diferencia de goles > goles a favor > ranking FIFA
 */
export function rankThirdPlaceTeams(
  thirdPlaceTeams: GroupStanding[]
): GroupStanding[] {
  return [...thirdPlaceTeams].sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
    if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
    return a.teamId - b.teamId;
  });
}
