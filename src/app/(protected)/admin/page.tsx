'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { calculateMatchPoints } from '@/lib/points-engine';
import { calculateOfficialStandings, getR32Pairings } from '@/lib/tournament-logic';
import { getFlagUrl } from '@/lib/utils/flags';
import { playerDatabase } from '@/lib/constants/players';

interface Team {
  id: number;
  name: string;
  code: string;
  group_letter: string;
}

interface Match {
  id: number;
  match_number: number;
  stage: string;
  group_letter: string;
  team_a_id: number | null;
  team_b_id: number | null;
  team_a: Team | null;
  team_b: Team | null;
  match_datetime: string;
  venue: string;
  is_bonus?: boolean;
}

interface Result {
  match_id: number;
  score_a: number;
  score_b: number;
  winner_id: number | null;
}

export default function AdminPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [results, setResults] = useState<Record<number, Result>>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [filter, setFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [teams, setTeams] = useState<Team[]>([]);
  const [topScorer, setTopScorer] = useState('');
  const [selectedPlayerTeam, setSelectedPlayerTeam] = useState<number | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const router = useRouter();

  const playerOptions = useMemo(() => {
    const selectedTeam = teams.find(t => t.id === selectedPlayerTeam);
    return playerDatabase[selectedTeam?.code || ''] || playerDatabase.default;
  }, [selectedPlayerTeam, teams]);

  const handleFlagError = (e: any) => {
    e.target.style.display = 'none';
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      setIsAdmin(true);

      const [mRes, rRes, tRes, cRes] = await Promise.all([
        supabase.from('matches').select('*, team_a:team_a_id(*), team_b:team_b_id(*)').order('match_number'),
        supabase.from('results').select('*'),
        supabase.from('teams').select('*'),
        supabase.from('tournament_config').select('*')
      ]);

      if (mRes.data) setMatches(mRes.data);
      if (tRes.data) setTeams(tRes.data);
      
      const resMap: Record<number, Result> = {};
      rRes.data?.forEach(r => {
        resMap[r.match_id] = r;
      });
      setResults(resMap);

      if (cRes.data) {
        const scorer = cRes.data.find(c => c.key === 'top_scorer')?.value;
        if (scorer) {
          setTopScorer(scorer);
          const foundTeamCode = Object.keys(playerDatabase).find(code => 
            playerDatabase[code].includes(scorer)
          );
          if (foundTeamCode && tRes.data) {
            const team = tRes.data.find(t => t.code === foundTeamCode);
            if (team) setSelectedPlayerTeam(team.id);
          }
        }
      }
      
      setLoading(false);
    };
    init();
  }, [router]);

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      const matchesSearch = m.team_a?.name.toLowerCase().includes(filter.toLowerCase()) || 
                           m.team_b?.name.toLowerCase().includes(filter.toLowerCase()) ||
                           m.match_number.toString().includes(filter);
      const matchesStage = stageFilter === 'all' || m.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [matches, filter, stageFilter]);

  const updateResult = (matchId: number, team: 'A' | 'B', score: number) => {
    setResults(prev => {
      const current = prev[matchId] || { match_id: matchId, score_a: 0, score_b: 0, winner_id: null };
      const updated = { ...current };
      if (team === 'A') updated.score_a = score;
      else updated.score_b = score;
      
      const match = matches.find(m => m.id === matchId);
      if (updated.score_a !== updated.score_b) {
        updated.winner_id = updated.score_a > updated.score_b ? match?.team_a_id || null : match?.team_b_id || null;
      } else {
        updated.winner_id = null;
      }
      
      return { ...prev, [matchId]: updated };
    });
  };

  const stepScore = (matchId: number, team: 'A' | 'B', step: number) => {
    const current = results[matchId] || { match_id: matchId, score_a: 0, score_b: 0, winner_id: null };
    const currentScore = team === 'A' ? current.score_a : current.score_b;
    const newScore = Math.max(0, currentScore + step);
    updateResult(matchId, team, newScore);
  };

  const saveResult = async (matchId: number) => {
    setSaving(matchId);
    const supabase = createClient();
    
    // Si no hay resultado en el estado local, asumimos 0-0
    let result = results[matchId];
    if (!result) {
      result = { match_id: matchId, score_a: 0, score_b: 0, winner_id: null };
    }

    if (isNaN(result.score_a) || isNaN(result.score_b)) {
      showToast('Introduce marcadores válidos antes de guardar', 'error');
      setSaving(null);
      return;
    }

    try {
      // 1. Guardar el resultado
      const { error } = await supabase.from('results').upsert({
        match_id: result.match_id,
        score_a: result.score_a,
        score_b: result.score_b,
        winner_id: result.winner_id,
        updated_at: new Date().toISOString()
      });

      if (error) throw error;

      // Actualizar estado local para que aparezca el botón de Borrar
      setResults(prev => ({ ...prev, [matchId]: result }));

      // 2. Propagar al siguiente partido si es fase eliminatoria
      await propagateWinner(matchId, result.winner_id);

      showToast(`Resultado guardado: Partido #${matches.find(m => m.id === matchId)?.match_number}`);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  const propagateWinner = async (matchId: number, winnerId: number | null) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || match.stage === 'group' || !winnerId) return;

    const matchNum = match.match_number;
    const supabase = createClient();

    // Caso Final (guardar campeón y subcampeón oficiales)
    if (matchNum === 104) {
      const runnerUpId = winnerId === match.team_a_id ? match.team_b_id : match.team_a_id;
      const { error } = await supabase.from('tournament_config').upsert([
        { key: 'champion_id', value: winnerId.toString() },
        { key: 'runner_up_id', value: runnerUpId ? runnerUpId.toString() : '' }
      ]);
      if (error) {
        showToast('Error al guardar campeón/subcampeón: ' + error.message, 'error');
      } else {
        showToast('Campeón y Subcampeón guardados automáticamente');
      }
      return;
    }

    // Definición de propagación (Basada en los cruces oficiales proporcionados)
    const KO_MAP: Record<number, any> = {
      // R32 -> R16
      73: { next: 90, pos: 'A' }, 75: { next: 90, pos: 'B' },
      74: { next: 89, pos: 'A' }, 77: { next: 89, pos: 'B' },
      79: { next: 92, pos: 'A' }, 80: { next: 92, pos: 'B' },
      76: { next: 91, pos: 'A' }, 78: { next: 91, pos: 'B' },
      83: { next: 93, pos: 'A' }, 84: { next: 93, pos: 'B' },
      81: { next: 94, pos: 'A' }, 82: { next: 94, pos: 'B' },
      86: { next: 95, pos: 'A' }, 88: { next: 95, pos: 'B' },
      85: { next: 96, pos: 'A' }, 87: { next: 96, pos: 'B' },
      // R16 -> QF
      89: { next: 97, pos: 'A' }, 90: { next: 97, pos: 'B' },
      93: { next: 98, pos: 'A' }, 94: { next: 98, pos: 'B' },
      91: { next: 99, pos: 'A' }, 92: { next: 99, pos: 'B' },
      95: { next: 100, pos: 'A' }, 96: { next: 100, pos: 'B' },
      // QF -> SF
      97: { next: 101, pos: 'A' }, 98: { next: 101, pos: 'B' },
      99: { next: 102, pos: 'A' }, 100: { next: 102, pos: 'B' },
      // SF -> Final y 3er Puesto
      101: { winNext: 104, winPos: 'A', loseNext: 103, losePos: 'A' },
      102: { winNext: 104, winPos: 'B', loseNext: 103, losePos: 'B' }
    };

    const rule = KO_MAP[matchNum];
    if (!rule) return;

    const loserId = winnerId === match.team_a_id ? match.team_b_id : match.team_a_id;

    if (rule.next) {
      await supabase.from('matches').update({ 
        [rule.pos === 'A' ? 'team_a_id' : 'team_b_id']: winnerId 
      }).eq('match_number', rule.next);
    } else {
      // Caso Semifinales (propagan ganador a Final y perdedor a 3er puesto)
      await Promise.all([
        supabase.from('matches').update({ 
          [rule.winPos === 'A' ? 'team_a_id' : 'team_b_id']: winnerId 
        }).eq('match_number', rule.winNext),
        supabase.from('matches').update({ 
          [rule.losePos === 'A' ? 'team_a_id' : 'team_b_id']: loserId 
        }).eq('match_number', rule.loseNext)
      ]);
    }

    // Recargar partidos localmente para ver cambios sin F5
    const { data: updatedMatches } = await supabase.from('matches').select('*, team_a:team_a_id(*), team_b:team_b_id(*)').order('match_number');
    if (updatedMatches) setMatches(updatedMatches);
  };

  const deleteResult = async (matchId: number) => {
    if (!confirm('¿Seguro que quieres borrar este resultado oficial? El partido volverá a estado "No Jugado".')) return;
    
    setSaving(matchId);
    const supabase = createClient();

    try {
      // Intentar borrado explícito
      const { error, status } = await supabase
        .from('results')
        .delete()
        .match({ match_id: matchId });
      
      if (error) throw error;

      // Limpiar estado local inmediatamente
      setResults(prev => {
        const newState = { ...prev };
        delete newState[matchId];
        return newState;
      });

      // 2. Limpiar propagación si es eliminatoria
      const match = matches.find(m => m.id === matchId);
      if (match && match.stage !== 'group') {
        if (match.match_number === 104) {
          await supabase.from('tournament_config').upsert([
            { key: 'champion_id', value: '' },
            { key: 'runner_up_id', value: '' }
          ]);
        }
        const KO_MAP: Record<number, any> = {
          73: { next: 90, pos: 'A' }, 75: { next: 90, pos: 'B' },
          74: { next: 89, pos: 'A' }, 77: { next: 89, pos: 'B' },
          79: { next: 92, pos: 'A' }, 80: { next: 92, pos: 'B' },
          76: { next: 91, pos: 'A' }, 78: { next: 91, pos: 'B' },
          83: { next: 93, pos: 'A' }, 84: { next: 93, pos: 'B' },
          81: { next: 94, pos: 'A' }, 82: { next: 94, pos: 'B' },
          86: { next: 95, pos: 'A' }, 88: { next: 95, pos: 'B' },
          85: { next: 96, pos: 'A' }, 87: { next: 96, pos: 'B' },
          89: { next: 97, pos: 'A' }, 90: { next: 97, pos: 'B' },
          93: { next: 98, pos: 'A' }, 94: { next: 98, pos: 'B' },
          91: { next: 99, pos: 'A' }, 92: { next: 99, pos: 'B' },
          95: { next: 100, pos: 'A' }, 96: { next: 100, pos: 'B' },
          97: { next: 101, pos: 'A' }, 98: { next: 101, pos: 'B' },
          99: { next: 102, pos: 'A' }, 100: { next: 102, pos: 'B' },
          101: { winNext: 104, winPos: 'A', loseNext: 103, losePos: 'A' },
          102: { winNext: 104, winPos: 'B', loseNext: 103, losePos: 'B' }
        };
        const rule = KO_MAP[match.match_number];
        if (rule) {
          if (rule.next) {
            await supabase.from('matches').update({ [rule.pos === 'A' ? 'team_a_id' : 'team_b_id']: null }).eq('match_number', rule.next);
          } else {
            await Promise.all([
              supabase.from('matches').update({ [rule.winPos === 'A' ? 'team_a_id' : 'team_b_id']: null }).eq('match_number', rule.winNext),
              supabase.from('matches').update({ [rule.losePos === 'A' ? 'team_a_id' : 'team_b_id']: null }).eq('match_number', rule.loseNext)
            ]);
          }
          // Recargar partidos
          const { data: updatedMatches } = await supabase.from('matches').select('*, team_a:team_a_id(*), team_b:team_b_id(*)').order('match_number');
          if (updatedMatches) setMatches(updatedMatches);
        }
      }

      showToast(`Resultado del partido #${match?.match_number} eliminado`);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  const [recalculating, setRecalculating] = useState(false);

  const recalculateGlobalRanking = async () => {
    setRecalculating(true);
    const supabase = createClient();

    try {
      // 1. Obtener datos necesarios
      const [
        { data: allStandings },
        { data: allResults },
        { data: allPredictions },
        { data: matchesData },
        { data: config }
      ] = await Promise.all([
        supabase.from('standings').select('*'),
        supabase.from('results').select('*'),
        supabase.from('predictions').select('*'),
        supabase.from('matches').select('*, team_a:team_a_id(*), team_b:team_b_id(*)'),
        supabase.from('tournament_config').select('*')
      ]);

      if (!allStandings || !allResults || !allPredictions) throw new Error('Error al cargar datos para el ranking');

      const { data: allBracketPredictions } = await supabase.from('bracket_predictions').select('*');
      const { data: allHonorsPredictions } = await supabase.from('honors_predictions').select('*');

      const officialChampionId = config?.find(c => c.key === 'champion_id')?.value;
      const officialTopScorer = config?.find(c => c.key === 'top_scorer')?.value;

      const hasResults = allResults && allResults.length > 0;

      // 1.5. Determinar equipos clasificados OFICIALMENTE por ronda
      const officialTeamsPerStage: Record<string, Set<number>> = {
        'R32': new Set(),
        'R16': new Set(),
        'QF': new Set(),
        'SF': new Set(),
        'F': new Set()
      };

      if (hasResults) {
        matchesData?.forEach(m => {
          if (m.stage !== 'group' && m.stage !== '3rd') {
            if (m.team_a_id) officialTeamsPerStage[m.stage].add(m.team_a_id);
            if (m.team_b_id) officialTeamsPerStage[m.stage].add(m.team_b_id);
          }
        });
      }

      const pointsPerStage: Record<string, number> = {
        'R32': 3,
        'R16': 6,
        'QF': 12,
        'SF': 25,
        'F': 50
      };

      const nationalTeamCode = config?.find(c => c.key === 'national_team')?.value || 'ESP';

      // 2. Calcular puntos para cada miembro de cada porra
      const standingsUpdates = allStandings.map(standing => {
        let totalMatchPoints = 0;
        let exactHits = 0;
        let groupPositionPoints = 0;
        let bracketPoints = 0;
        let honorsPoints = 0;

        if (hasResults) {
          const userPoolPredictions = allPredictions.filter(p => p.user_id === standing.user_id && p.pool_id === standing.pool_id);

          // A. Puntos por Partido
          userPoolPredictions.forEach(pred => {
            const result = allResults.find(r => r.match_id === pred.match_id);
            const match = matchesData?.find(m => m.id === pred.match_id);
            
            if (result && match) {
              const isNationalTeam = (match.team_a?.code === nationalTeamCode || match.team_b?.code === nationalTeamCode);
              const multiplier = (match.is_bonus || isNationalTeam) ? 2 : 1; // Soporta x2 por defecto, expandible a x3

              const calc = calculateMatchPoints(
                pred.predicted_score_a,
                pred.predicted_score_b,
                result.score_a,
                result.score_b,
                multiplier
              );

              totalMatchPoints += calc.points;
              if (calc.isExact) exactHits++;
            }
          });

          // B. Puntos por Posición de Grupo (Nuevo)
          // Agrupar predicciones por grupo
          const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
          const realStandings = calculateOfficialStandings(matchesData || [], allResults, teams || []);
          
          groups.forEach(groupLetter => {
            const groupTeams = teams?.filter(t => t.group_letter === groupLetter) || [];
            if (groupTeams.length === 0) return;

            // Calcular tabla predicha por el usuario para este grupo
            const userGroupPredictions = userPoolPredictions.filter(p => {
               const m = matchesData?.find(match => match.id === p.match_id);
               return m?.group_letter === groupLetter;
            });
            
            // Solo si el usuario ha completado el grupo
            if (userGroupPredictions.length >= 6) {
               const userGroupResults = userGroupPredictions.map(p => ({
                 match_id: p.match_id,
                 score_a: p.predicted_score_a,
                 score_b: p.predicted_score_b
               }));
               const predictedStandings = calculateOfficialStandings(matchesData || [], userGroupResults, groupTeams);
               
               const realList = realStandings[groupLetter] || [];
               const predList = predictedStandings[groupLetter] || [];

               // Comparar posiciones 1, 2, 3, 4
               [0, 1, 2, 3].forEach(posIdx => {
                 if (realList[posIdx] && predList[posIdx] && realList[posIdx].teamId === predList[posIdx].teamId) {
                    const bonus = posIdx === 0 ? 5 : (posIdx === 1 ? 3 : 1);
                    groupPositionPoints += bonus;
                 }
               });
            }
          });

          // C. Puntos de Progresión (Bracket)
          const userBrackets = allBracketPredictions?.filter(b => b.user_id === standing.user_id && b.pool_id === standing.pool_id) || [];
          userBrackets.forEach(ub => {
            if (officialTeamsPerStage[ub.stage]?.has(ub.team_id)) {
              bracketPoints += pointsPerStage[ub.stage] || 0;
            }
          });

          // D. Puntos de Honor
          const userHonor = allHonorsPredictions?.find(h => h.user_id === standing.user_id && h.pool_id === standing.pool_id);
          if (userHonor) {
            if (officialChampionId && userHonor.champion_id === parseInt(officialChampionId)) honorsPoints += 25;
            if (officialTopScorer && userHonor.top_scorer?.trim().toLowerCase() === officialTopScorer.trim().toLowerCase()) honorsPoints += 20;
          }
        }

        return {
          user_id: standing.user_id,
          pool_id: standing.pool_id,
          total_points: totalMatchPoints + bracketPoints + honorsPoints + groupPositionPoints, 
          exact_hits: exactHits,
          match_points: totalMatchPoints,
          bracket_points: bracketPoints + groupPositionPoints, // Sumamos posiciones aquí para simplificar tabla
          honors_points: honorsPoints,
          updated_at: new Date().toISOString()
        };
      });

      // 3. Guardar en tabla standings
      const { error: sError } = await supabase.from('standings').upsert(standingsUpdates);
      if (sError) throw sError;

      showToast(`¡Ranking global actualizado! Se han procesado ${standingsUpdates.length} registros de puntuación.`);
    } catch (err: any) {
      console.error(err);
      showToast('Error en la sincronización: ' + err.message, 'error');
    } finally {
      setRecalculating(false);
    }
  };

  const handleUpdateMatchTeams = async (matchId: number, teamAId: number | null, teamBId: number | null) => {
    const supabase = createClient();
    try {
      const { error } = await supabase.from('matches').update({
        team_a_id: teamAId,
        team_b_id: teamBId
      }).eq('id', matchId);

      if (error) throw error;

      setMatches(prev => prev.map(m => m.id === matchId ? {
        ...m,
        team_a_id: teamAId,
        team_b_id: teamBId,
        team_a: teams.find(t => t.id === teamAId) || null,
        team_b: teams.find(t => t.id === teamBId) || null
      } : m));

      showToast('Equipos del partido actualizados correctamente');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const saveTopScorer = async () => {
    setSavingConfig(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.from('tournament_config').upsert({
        key: 'top_scorer',
        value: topScorer || ''
      });

      if (error) throw error;
      showToast('Bota de Oro guardada correctamente');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleResetTournament = async () => {
    if (!confirm('🚨 ADVERTENCIA: Esto reseteará todas las puntuaciones, plenos y clasificaciones oficiales a CERO en todos los standings. Los partidos de fases eliminatorias volverán a TBD. Las predicciones de los usuarios NO SE BORRARÁN. ¿Estás seguro de continuar?')) return;
    
    setRecalculating(true);
    const supabase = createClient();

    try {
      // 1. Obtener todos los standings actuales
      const { data: allStandings, error: fetchError } = await supabase.from('standings').select('user_id, pool_id');
      if (fetchError) throw fetchError;

      // 2. Preparar el reset a cero para todos los standings
      if (allStandings && allStandings.length > 0) {
        const resetStandings = allStandings.map(s => ({
          user_id: s.user_id,
          pool_id: s.pool_id,
          total_points: 0,
          exact_hits: 0,
          match_points: 0,
          bracket_points: 0,
          honors_points: 0,
          updated_at: new Date().toISOString()
        }));

        const { error: sError } = await supabase.from('standings').upsert(resetStandings);
        if (sError) throw sError;
      }

      // 3. Resetear partidos de eliminatorias a NULL (TBD) en la base de datos
      const { error: mError } = await supabase
        .from('matches')
        .update({ team_a_id: null, team_b_id: null })
        .neq('stage', 'group');
      if (mError) throw mError;

      // 4. Limpiar configuración del torneo en la DB
      await Promise.all([
        supabase.from('tournament_config').update({ value: '' }).eq('key', 'champion_id'),
        supabase.from('tournament_config').update({ value: '' }).eq('key', 'runner_up_id'),
        supabase.from('tournament_config').update({ value: '' }).eq('key', 'top_scorer')
      ]);

      setTopScorer('');
      setSelectedPlayerTeam(null);

      showToast('Competición reseteada a cero correctamente. Predicciones conservadas.');
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      showToast('Error al resetear competición: ' + err.message, 'error');
    } finally {
      setRecalculating(false);
    }
  };

  const handleFinalizeGroups = async () => {
    if (!confirm('¿Estás seguro de cerrar la Fase de Grupos? Esto actualizará los equipos oficiales de Dieciseisavos basándose en los resultados reales.')) return;
    
    setRecalculating(true);
    try {
      const supabase = createClient();
      const standings = calculateOfficialStandings(matches, Object.values(results), teams);
      const pairings = getR32Pairings(standings);

      // Actualizar partidos 73 al 88 en la DB (R32)
      for (const [matchNum, pairing] of Object.entries(pairings)) {
        const p = pairing as { a: number; b: number };
        if (!p.a || !p.b) continue;
        
        const { error } = await supabase
          .from('matches')
          .update({ team_a_id: p.a, team_b_id: p.b })
          .eq('match_number', parseInt(matchNum));
        
        if (error) throw error;
      }

      showToast('Fase de Grupos finalizada. Cruces de R32 actualizados.');
      window.location.reload(); 
    } catch (err: any) {
      showToast('Error al finalizar fase: ' + err.message, 'error');
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;
  if (!isAdmin) return null;

  return (
    <div className="container admin-container">
      <div className="dashboard-header animate-fadeIn" style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: 'var(--color-orange)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800 }}>ADMIN MODE</div>
          </div>
          <h1>Control de Resultados Oficiales</h1>
          <p className="text-muted">Introduce los marcadores reales para calcular el ranking global de la Porra.</p>
        </div>

        <div className="admin-header-actions">
          <button 
            className="btn btn-danger" 
            onClick={handleResetTournament}
            disabled={recalculating}
            style={{ height: 'fit-content', padding: '1rem 1.5rem', fontSize: '1rem' }}
          >
            🗑️ Resetear a Cero
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleFinalizeGroups}
            disabled={recalculating}
            style={{ height: 'fit-content', padding: '1rem 1.5rem', fontSize: '1rem' }}
          >
            🏁 Finalizar Fase Grupos
          </button>
          <button 
            className="btn btn-primary" 
            onClick={recalculateGlobalRanking}
            disabled={recalculating}
            style={{ height: 'fit-content', padding: '1rem 2rem', fontSize: '1rem', boxShadow: '0 0 30px rgba(242,140,56,0.3)' }}
          >
            {recalculating ? <span className="spinner" style={{ width: 20, height: 20, marginRight: '0.75rem' }}></span> : '🔄 '}
            Sincronizar Ranking Global
          </button>
        </div>
      </div>

      {/* Configuración de Bota de Oro */}
      <div className="glass-card animate-fadeIn" style={{ padding: '2rem', marginBottom: '2rem', borderBottom: '4px solid var(--color-orange)' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🏆 Bota de Oro / Pichichi Oficial del Torneo
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '0.5rem', display: 'block' }}>1. Filtrar por Selección</label>
            <select
              className="form-input"
              value={selectedPlayerTeam || ''}
              onChange={e => {
                setSelectedPlayerTeam(parseInt(e.target.value) || null);
                setTopScorer('');
              }}
            >
              <option value="">-- Selecciona un País --</option>
              {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '0.5rem', display: 'block' }}>2. Elegir Jugador de la Plantilla</label>
            <select
              className="form-input"
              value={topScorer}
              onChange={e => setTopScorer(e.target.value)}
              disabled={!selectedPlayerTeam}
            >
              <option value="">-- Elige al Máximo Goleador --</option>
              {[...playerOptions].sort().map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '0.5rem', display: 'block' }}>O escribir manualmente (si no está en la lista)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Nombre del jugador..."
              value={topScorer}
              onChange={e => setTopScorer(e.target.value)}
            />
          </div>

          <div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', height: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 0 20px rgba(242,140,56,0.2)' }}
              onClick={saveTopScorer}
              disabled={savingConfig}
            >
              {savingConfig ? <span className="spinner" style={{ width: 18, height: 18 }}></span> : 'Guardar Bota de Oro'}
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="glass-card admin-filters">
        <div style={{ flex: 1 }}>
          <input 
            className="form-input" 
            placeholder="Buscar por equipo o # de partido..." 
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <select 
          className="form-input" 
          style={{ width: '200px' }}
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
        >
          <option value="all">Todas las fases</option>
          <option value="group">Fase de Grupos</option>
          <option value="R32">Dieciseisavos</option>
          <option value="R16">Octavos</option>
          <option value="QF">Cuartos</option>
          <option value="SF">Semifinales</option>
          <option value="F">Final</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {filteredMatches.map(m => {
          const res = results[m.id];
          const isPlayed = !!res;
          const isGroup = m.stage === 'group';

          return (
            <div key={m.id} className={`glass-card animate-fadeIn admin-match-card ${m.is_bonus ? 'bonus' : ''} ${isPlayed ? 'played' : ''}`}>
              <div className="admin-match-grid">
                {/* Match Number */}
                <div className="admin-match-num">
                  <span className="label">PARTIDO</span>
                  <span className="number">#{m.match_number}</span>
                  <span className="stage-badge">{isGroup ? `Grupo ${m.group_letter}` : m.stage}</span>
                </div>

                {/* Match Info (Date & Venue) */}
                <div className="admin-match-info">
                  <div className="admin-match-date">
                    {m.match_datetime ? new Date(m.match_datetime).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Fecha TBD'}
                  </div>
                  <div className="admin-match-venue">
                    📍 {m.venue || 'Sede TBD'}
                  </div>
                </div>

                {/* Team A */}
                <div className="admin-team-a">
                  <div className="team-text">
                    {isGroup ? (
                      <div className="team-name">{m.team_a?.name || 'TBD'}</div>
                    ) : (
                      <select
                        className="form-input text-sm"
                        style={{ padding: '0.25rem 0.5rem', minWidth: '150px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                        value={m.team_a_id || ''}
                        onChange={(e) => handleUpdateMatchTeams(m.id, parseInt(e.target.value) || null, m.team_b_id)}
                      >
                        <option value="">TBD</option>
                        {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.group_letter})</option>
                        ))}
                      </select>
                    )}
                    <div className="team-label">LOCAL</div>
                  </div>
                  {m.team_a && <img 
                    src={getFlagUrl(m.team_a.code)} 
                    onError={handleFlagError}
                    className="admin-flag"
                  />}
                </div>

                {/* Score inputs with Info above */}
                <div className="admin-score-wrapper">
                  <div className="admin-score-section">
                    <div className="score-box">
                      <button 
                        type="button"
                        className="stepper-btn btn-sm" 
                        onClick={() => stepScore(m.id, 'A', 1)}
                      >
                        +
                      </button>
                      <input 
                        type="number" 
                        className="stepper-value" 
                        value={isPlayed ? res.score_a : 0}
                        onChange={e => updateResult(m.id, 'A', parseInt(e.target.value) || 0)}
                      />
                      <button 
                        type="button"
                        className="stepper-btn btn-sm" 
                        onClick={() => stepScore(m.id, 'A', -1)}
                        disabled={!isPlayed || res.score_a <= 0}
                      >
                        -
                      </button>
                    </div>

                    <div className="match-vs-divider">VS</div>

                    <div className="score-box">
                      <button 
                        type="button"
                        className="stepper-btn btn-sm" 
                        onClick={() => stepScore(m.id, 'B', 1)}
                      >
                        +
                      </button>
                      <input 
                        type="number" 
                        className="stepper-value" 
                        value={isPlayed ? res.score_b : 0}
                        onChange={e => updateResult(m.id, 'B', parseInt(e.target.value) || 0)}
                      />
                      <button 
                        type="button"
                        className="stepper-btn btn-sm" 
                        onClick={() => stepScore(m.id, 'B', -1)}
                        disabled={!isPlayed || res.score_b <= 0}
                      >
                        -
                      </button>
                    </div>
                  </div>
                </div>

                {/* Team B */}
                <div className="admin-team-b">
                  {m.team_b && <img 
                    src={getFlagUrl(m.team_b.code)} 
                    onError={handleFlagError}
                    className="admin-flag"
                  />}
                  <div className="team-text">
                    {isGroup ? (
                      <div className="team-name">{m.team_b?.name || 'TBD'}</div>
                    ) : (
                      <select
                        className="form-input text-sm"
                        style={{ padding: '0.25rem 0.5rem', minWidth: '150px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                        value={m.team_b_id || ''}
                        onChange={(e) => handleUpdateMatchTeams(m.id, m.team_a_id, parseInt(e.target.value) || null)}
                      >
                        <option value="">TBD</option>
                        {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.group_letter})</option>
                        ))}
                      </select>
                    )}
                    <div className="team-label">VISITANTE</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="admin-actions">
                  <button 
                    className={`btn ${saving === m.id ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => saveResult(m.id)}
                    disabled={saving !== null}
                  >
                    {saving === m.id ? <div className="spinner" style={{ width: 16, height: 16 }}></div> : 'GUARDAR'}
                  </button>
                  
                  {isPlayed && (
                    <button 
                      className="btn btn-danger"
                      onClick={() => deleteResult(m.id)}
                      disabled={saving !== null}
                    >
                      🗑️ BORRAR
                    </button>
                  )}
                </div>
              </div>

              {/* Penalty winner selector for KO stages */}
              {!isGroup && isPlayed && res.score_a === res.score_b && m.team_a && m.team_b && (
                <div className="admin-penalty-container animate-slideIn">
                  <p style={{ fontSize: '0.9rem', marginBottom: '1.25rem', fontWeight: 700, color: 'var(--color-orange)' }}>
                    ⚡ EMPATE EN ELIMINATORIA: ¿Quién ganó por penaltis?
                  </p>
                  <div className="admin-penalty-options">
                    <div 
                      onClick={() => setResults(prev => ({...prev, [m.id]: {...prev[m.id], winner_id: m.team_a_id}}))}
                      className={`admin-penalty-card ${res.winner_id === m.team_a_id ? 'selected' : ''}`}
                    >
                      <img src={getFlagUrl(m.team_a.code)} style={{ width: 40, height: 27, objectFit: 'contain', borderRadius: 4, marginBottom: '0.5rem' }} />
                      <div style={{ fontWeight: 800, fontSize: '0.8rem' }}>{m.team_a.name}</div>
                    </div>

                    <div 
                      onClick={() => setResults(prev => ({...prev, [m.id]: {...prev[m.id], winner_id: m.team_b_id}}))}
                      className={`admin-penalty-card ${res.winner_id === m.team_b_id ? 'selected' : ''}`}
                    >
                      <img src={getFlagUrl(m.team_b.code)} style={{ width: 40, height: 27, objectFit: 'contain', borderRadius: 4, marginBottom: '0.5rem' }} />
                      <div style={{ fontWeight: 800, fontSize: '0.8rem' }}>{m.team_b.name}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom Toast Notification */}
      {toast && (
        <div 
          className="animate-fadeIn"
          style={{ 
            position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
            padding: '1rem 2rem', borderRadius: '12px', zIndex: 10000,
            background: toast.type === 'success' ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)',
            backdropFilter: 'blur(10px)', color: 'white', fontWeight: 600,
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '0.75rem'
          }}
        >
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          {toast.message}
        </div>
      )}
    </div>
  );
}
