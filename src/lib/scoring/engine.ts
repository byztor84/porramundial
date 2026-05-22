/* ============================================
   Porra Mundial - Motor de Puntuación
   Calcula puntos según las reglas definidas
   ============================================ */

import { type Prediction, type Result, type Match, type MatchScore, STAGE_BRACKET_POINTS } from '@/lib/types/database';

/**
 * Calcula los puntos obtenidos por una predicción de partido.
 * 
 * Jerarquía:
 * - Resultado exacto → 12 puntos
 * - Diferencia de goles → 6 puntos
 * - Acierto 1X2 → 3 puntos
 * - Fallo → 0 puntos
 * 
 * Bonus x2 si el partido es inaugural, final o de la selección nacional.
 */
export function calculateMatchPoints(
  prediction: { predicted_score_a: number; predicted_score_b: number },
  result: { score_a: number; score_b: number },
  isBonus: boolean
): MatchScore {
  const pa = prediction.predicted_score_a;
  const pb = prediction.predicted_score_b;
  const ra = result.score_a;
  const rb = result.score_b;

  let points = 0;
  let isExact = false;
  let isDifference = false;
  let is1X2 = false;

  // 1. Acierto 1X2 (Tendencia) -> Siempre suma 3 si acierta el ganador o empate
  if (
    (pa > pb && ra > rb) ||   // Victoria A
    (pa < pb && ra < rb) ||   // Victoria B
    (pa === pb && ra === rb)   // Empate
  ) {
    points += 3;
    is1X2 = true;
  }

  // 2. Diferencia de goles correcta -> Suma 6 puntos ADICIONALES
  if ((pa - pb) === (ra - rb)) {
    points += 6;
    isDifference = true;
  }

  // 3. Resultado exacto -> Suma 12 puntos ADICIONALES
  if (pa === ra && pb === rb) {
    points += 12;
    isExact = true;
  }

  const bonusMultiplier = isBonus ? 2 : 1;

  return {
    points: points * bonusMultiplier,
    isExact,
    isDifference,
    is1X2,
    bonusMultiplier,
  };
}

/**
 * Calcula los puntos por clasificación correcta de un equipo en una ronda.
 * 
 * R32 → 3 pts
 * R16 → 5 pts
 * QF  → 8 pts
 * SF  → 12 pts
 * F   → 15 pts (finalista)
 */
export function calculateBracketPoints(stage: string): number {
  return STAGE_BRACKET_POINTS[stage] || 0;
}

/**
 * Calcula los puntos del cuadro de honor.
 * 
 * Campeón acertado → 25 pts
 * Subcampeón acertado → 15 pts
 * Bota de Oro acertada → 20 pts
 */
export function calculateHonorsPoints(
  prediction: { champion_id: number | null; runner_up_id: number | null; top_scorer: string },
  actual: { champion_id: number | null; runner_up_id: number | null; top_scorer: string }
): { total: number; champion: number; runnerUp: number; topScorer: number } {
  let champion = 0;
  let runnerUp = 0;
  let topScorer = 0;

  if (prediction.champion_id && prediction.champion_id === actual.champion_id) {
    champion = 25;
  }
  if (prediction.runner_up_id && prediction.runner_up_id === actual.runner_up_id) {
    runnerUp = 15;
  }
  if (
    prediction.top_scorer &&
    actual.top_scorer &&
    prediction.top_scorer.toLowerCase().trim() === actual.top_scorer.toLowerCase().trim()
  ) {
    topScorer = 20;
  }

  return {
    total: champion + runnerUp + topScorer,
    champion,
    runnerUp,
    topScorer,
  };
}

/**
 * Recalcula la puntuación total de un usuario.
 * Retorna el objeto de standings actualizado.
 */
export function recalculateUserStandings(
  predictions: (Prediction & { match: Match })[],
  results: Result[],
  bracketPredictions: { stage: string; team_id: number }[],
  actualBracketTeams: { stage: string; team_id: number }[],
  honorsPrediction: { champion_id: number | null; runner_up_id: number | null; top_scorer: string } | null,
  actualHonors: { champion_id: number | null; runner_up_id: number | null; top_scorer: string } | null
) {
  let matchPoints = 0;
  let exactHits = 0;
  let bracketPoints = 0;
  let honorsPoints = 0;

  // Calcular puntos por partidos
  const resultsMap = new Map(results.map((r) => [r.match_id, r]));

  for (const prediction of predictions) {
    const result = resultsMap.get(prediction.match_id);
    if (!result) continue;

    const score = calculateMatchPoints(
      prediction,
      result,
      prediction.match?.is_bonus || false
    );

    matchPoints += score.points;
    if (score.isExact) exactHits++;
  }

  // Calcular puntos por clasificación correcta
  const actualBracketSet = new Set(
    actualBracketTeams.map((b) => `${b.stage}-${b.team_id}`)
  );

  for (const bp of bracketPredictions) {
    const key = `${bp.stage}-${bp.team_id}`;
    if (actualBracketSet.has(key)) {
      bracketPoints += calculateBracketPoints(bp.stage);
    }
  }

  // Calcular puntos de honor
  if (honorsPrediction && actualHonors) {
    const honors = calculateHonorsPoints(honorsPrediction, actualHonors);
    honorsPoints = honors.total;
  }

  return {
    total_points: matchPoints + bracketPoints + honorsPoints,
    exact_hits: exactHits,
    match_points: matchPoints,
    bracket_points: bracketPoints,
    honors_points: honorsPoints,
  };
}
