import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateMatchPoints } from '@/lib/scoring/engine';

export async function POST() {
  try {
    const supabase = await createClient();

    // Verificar que es admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    // Obtener todos los resultados
    const { data: results } = await supabase.from('results').select('*');
    const hasResults = results && results.length > 0;

    // Obtener partidos con su flag de bonus
    const { data: matches } = await supabase.from('matches').select('id, is_bonus');
    const matchBonusMap = new Map((matches || []).map((m: { id: number; is_bonus: boolean }) => [m.id, m.is_bonus]));

    // Obtener todos los usuarios con predicciones
    const { data: allUsers } = await supabase.from('profiles').select('id');
    if (!allUsers) return NextResponse.json({ error: 'Error obteniendo usuarios' }, { status: 500 });

    // Obtener todas las predicciones
    const { data: allPredictions } = await supabase.from('predictions').select('*');

    const resultsMap = new Map((results || []).map((r: { match_id: number; score_a: number; score_b: number }) => [r.match_id, r]));

    // Recalcular para cada usuario
    const updates = [];
    for (const user of allUsers) {
      const userPredictions = (allPredictions || []).filter((p: { user_id: string }) => p.user_id === user.id);

      let matchPoints = 0;
      let exactHits = 0;

      if (hasResults) {
        for (const pred of userPredictions) {
          const result = resultsMap.get(pred.match_id);
          if (!result) continue;

          const isBonus = matchBonusMap.get(pred.match_id) || false;
          const score = calculateMatchPoints(
            { predicted_score_a: pred.predicted_score_a, predicted_score_b: pred.predicted_score_b },
            { score_a: result.score_a, score_b: result.score_b },
            isBonus
          );

          matchPoints += score.points;
          if (score.isExact) exactHits++;
        }
      }

      updates.push({
        user_id: user.id,
        total_points: matchPoints,
        exact_hits: exactHits,
        match_points: matchPoints,
        bracket_points: 0,
        honors_points: 0,
      });
    }

    // Actualizar standings
    for (const update of updates) {
      await supabase.from('standings').upsert(update, { onConflict: 'user_id' });
    }

    return NextResponse.json({
      message: `Recálculo completado. ${updates.length} usuarios actualizados.`,
      updated: updates.length,
    });
  } catch (error) {
    console.error('Error en recálculo:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
