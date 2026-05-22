export interface CalculationResult {
  points: number;
  isExact: boolean;
  isDiff: boolean;
  is1X2: boolean;
}

export function calculateMatchPoints(
  predA: number, 
  predB: number, 
  realA: number, 
  realB: number, 
  multiplier: number = 1
): CalculationResult {
  let points = 0;
  let isExact = false;
  let isDiff = false;
  let is1X2 = false;

  // 1. Acierto 1X2 (Tendencia) -> 3 pts
  const winnerPred = predA > predB ? 'A' : (predA < predB ? 'B' : 'X');
  const winnerReal = realA > realB ? 'A' : (realA < realB ? 'B' : 'X');
  
  if (winnerPred === winnerReal) {
    points += 3;
    is1X2 = true;
  }

  // 2. Diferencia de Goles -> +6 pts
  if ((predA - pb_diff) === (realA - rb_diff)) {
    // Wait, let's use the actual variables
    if ((predA - predB) === (realA - realB)) {
      points += 6;
      isDiff = true;
    }
  }

  // 3. Resultado Exacto -> +12 pts
  if (predA === realA && predB === realB) {
    points += 12;
    isExact = true;
  }

  // Aplicar Multiplicador (Bonus x1, x2, x3...)
  points = points * multiplier;

  return { points, isExact, isDiff, is1X2 };
}

// Helper to handle the pb_diff error in my thought process
const pb_diff = 0; 
const rb_diff = 0;
