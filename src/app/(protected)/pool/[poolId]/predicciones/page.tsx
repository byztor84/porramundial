'use client';

import { useEffect, useState, useCallback, useMemo, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { calculateMatchPoints } from '@/lib/points-engine';
import { GROUPS, WIZARD_STEPS } from '@/lib/constants/tournament';
import { calculateGroupStandings, rankThirdPlaceTeams } from '@/lib/scoring/classification';
import type { GroupStanding, Team, Match, Prediction, BracketPrediction, HonorsPrediction } from '@/lib/types/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getFlagUrl } from '@/lib/utils/flags';
import { playerDatabase } from '@/lib/constants/players';


interface MatchPrediction {
  matchId: number;
  teamAId: number | null;
  teamBId: number | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId?: number | null;
}



export default function PrediccionesPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = use(params);
  const [currentStep, setCurrentStep] = useState(0);
  const [dbMatches, setDbMatches] = useState<Match[]>([]);
  const [dbTeams, setDbTeams] = useState<Team[]>([]);
  const [groupPredictions, setGroupPredictions] = useState<Record<string, MatchPrediction[]>>({});
  const [groupStandings, setGroupStandings] = useState<Record<string, GroupStanding[]>>({});
  const [knockoutPredictions, setKnockoutPredictions] = useState<Record<number, MatchPrediction>>({});
  const [honors, setHonors] = useState({ championId: null as number | null, runnerUpId: null as number | null, topScorer: '' });
  
  const [isLocked, setIsLocked] = useState(false);
  const [poolLogo, setPoolLogo] = useState<string | null>(null);
  const [poolName, setPoolName] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Record<number, any>>({});
  const [nationalTeam, setNationalTeam] = useState('ESP');

  // ... (rest of the state and effects remain the same)

  // 1. Cargar datos iniciales
  useEffect(() => {
    async function init() {
      const supabase = createClient();
      
      // Obtener sesión
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Obtener estado de bloqueo para esta porra específica
      const { data: member } = await supabase
        .from('pool_members')
        .select('prediction_locked')
        .eq('pool_id', poolId)
        .eq('user_id', user.id)
        .single();
        
      if (member?.prediction_locked) setIsLocked(true);
      // Obtener equipos, partidos y PREDICCIONES guardadas
      const [
        { data: teams }, 
        { data: matches }, 
        { data: savedPreds },
        { data: savedHonors },
        { data: poolData },
        { data: resultsData },
        { data: configData }
      ] = await Promise.all([
        supabase.from('teams').select('*').order('id'),
        supabase.from('matches').select('*, team_a:team_a_id(*), team_b:team_b_id(*)').order('match_number'),
        supabase.from('predictions').select('*').eq('user_id', user.id).eq('pool_id', poolId),
        supabase.from('honors_predictions').select('*').eq('user_id', user.id).eq('pool_id', poolId).single(),
        supabase.from('pools').select('name, logo_url').eq('id', poolId).single(),
        supabase.from('results').select('*'),
        supabase.from('tournament_config').select('*')
      ]);

      if (poolData?.logo_url) setPoolLogo(poolData.logo_url);
      if (poolData?.name) setPoolName(poolData.name);
      
      if (resultsData) {
        const resMap: Record<number, any> = {};
        resultsData.forEach(r => resMap[r.match_id] = r);
        setResults(resMap);
      }
      
      if (configData) {
        const nt = configData.find(c => c.key === 'national_team')?.value;
        if (nt) setNationalTeam(nt);
      }

      if (teams) setDbTeams(teams);
      if (matches) {
        setDbMatches(matches);
        
        // 1. Organizar predicciones de grupo
        const groupPreds: Record<string, MatchPrediction[]> = {};
        const groupMatches = matches.filter(m => m.stage === 'group');
        for (const group of GROUPS) {
          groupPreds[group] = groupMatches
            .filter(m => m.group_letter === group)
            .map(m => {
              const saved = savedPreds?.find(p => p.match_id === m.id);
              return {
                matchId: m.id,
                teamAId: m.team_a_id,
                teamBId: m.team_b_id,
                scoreA: saved ? saved.predicted_score_a : null,
                scoreB: saved ? saved.predicted_score_b : null
              };
            });
        }
        setGroupPredictions(groupPreds);

        // 2. Inicializar eliminatorias (VACÍAS para forzar cálculo dinámico)
        const koPreds: Record<number, MatchPrediction> = {};
        matches.filter(m => m.stage !== 'group').forEach(m => {
          const saved = savedPreds?.find(p => p.match_id === m.id);
          koPreds[m.id] = {
            matchId: m.id,
            teamAId: null, // No cargamos de la DB para evitar datos antiguos
            teamBId: null, // No cargamos de la DB para evitar datos antiguos
            scoreA: saved ? saved.predicted_score_a : null,
            scoreB: saved ? saved.predicted_score_b : null,
            winnerId: saved ? saved.predicted_winner_id : null
          };
        });
        setKnockoutPredictions(koPreds);
      }

      // 3. Cargar honores
      if (savedHonors) {
        setHonors({
          championId: savedHonors.champion_id,
          runnerUpId: savedHonors.runner_up_id,
          topScorer: savedHonors.top_scorer || ''
        });
        // Si hay equipo de goleador guardado, intentar deducirlo
        if (savedHonors.champion_id) setSelectedPlayerTeam(savedHonors.champion_id);
      }

      setLoading(false);
    }
    init();
  }, []);


  // 1.2 State para el asistente de Bota de Oro
  const [selectedPlayerTeam, setSelectedPlayerTeam] = useState<number | null>(null);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };


  // 2. Recalcular standings de grupos
  const recalcStandings = useCallback((group: string, preds: MatchPrediction[]) => {
    const groupTeams = dbTeams.filter(t => t.group_letter === group);
    const matchResults = preds.map(p => ({
      teamAId: p.teamAId!,
      teamBId: p.teamBId!,
      scoreA: p.scoreA,
      scoreB: p.scoreB
    }));

    const standings = calculateGroupStandings(groupTeams, matchResults);
    setGroupStandings(prev => ({ ...prev, [group]: standings }));
  }, [dbTeams]);

  useEffect(() => {
    Object.entries(groupPredictions).forEach(([group, preds]) => {
      if (preds.length > 0) recalcStandings(group, preds);
    });
  }, [groupPredictions, recalcStandings]);

  // Función para comprobar si un grupo está completo
  const isGroupComplete = useCallback((group: string) => {
    const preds = groupPredictions[group];
    return preds && preds.every(p => p.scoreA !== null && p.scoreB !== null);
  }, [groupPredictions]);

  // 3. Lógica de Mejores Terceros - SOLO si los grupos están completos
  const bestThirds = useMemo(() => {
    // Comprobar si todos los grupos están completos
    const allGroupsComplete = GROUPS.every(g => isGroupComplete(g));
    if (!allGroupsComplete) return [];

    const thirds = GROUPS.map(g => groupStandings[g]?.[2]).filter(Boolean);
    if (thirds.length < 12) return [];
    return rankThirdPlaceTeams(thirds).slice(0, 8);
  }, [groupStandings, isGroupComplete]);

  // ====================================================================
  // CUADRO ELIMINATORIO — BRACKET OFICIAL FIFA 2026
  // ====================================================================
  const getMatchByNum = useCallback(
    (num: number) => dbMatches.find(m => m.match_number === num),
    [dbMatches]
  );

  const computeBracket = useCallback(
    (preds: Record<number, MatchPrediction>): Record<number, MatchPrediction> => {
      const out = { ...preds };
      let changed = false;

      // 1. Recalcular Standings localmente para asegurar frescura total
      const localStandings: Record<string, GroupStanding[]> = {};
      Object.entries(groupPredictions).forEach(([sid, pds]) => {
        const group = sid.replace('group-', '');
        const teams = dbTeams.filter(t => t.group_letter === group);
        localStandings[group] = calculateGroupStandings(teams, pds.map(p => ({
          teamAId: p.teamAId!, teamBId: p.teamBId!, scoreA: p.scoreA, scoreB: p.scoreB
        })));
      });

      const allThirds = Object.values(localStandings).map(s => s[2]).filter(Boolean);
      const sortedBestThirds = rankThirdPlaceTeams(allThirds).slice(0, 8);
      // No obligamos a que todos los grupos estén terminados para empezar a ver cruces de terceros
      // pero sí mostramos que es provisional.

      // 2. Mapeo Maestro Dieciseisavos (R32) - ORDEN OFICIAL CON PRIORIDAD
      const r32Defs = [
        { n: 73, a: '2A', b: '2B' },
        { n: 74, a: '1E', b: '3rd', allowed: ['B','A','C','D','F'] },
        { n: 75, a: '1F', b: '2C' },
        { n: 76, a: '1C', b: '2F' },
        { n: 77, a: '1I', b: '3rd', allowed: ['A','G','H','C','D'] },
        { n: 78, a: '2E', b: '2I' },
        { n: 79, a: '1A', b: '3rd', allowed: ['C','E','F','H','I'] },
        { n: 80, a: '1L', b: '3rd', allowed: ['D','H','I','J','K'] },
        { n: 81, a: '1D', b: '3rd', allowed: ['E','B','F','I','J'] },
        { n: 82, a: '1G', b: '3rd', allowed: ['F','A','E','H','I'] },
        { n: 83, a: '2K', b: '2L' },
        { n: 84, a: '1H', b: '2J' },
        { n: 85, a: '1B', b: '3rd', allowed: ['G','E','F','I','J'] },
        { n: 86, a: '1J', b: '2H' },
        { n: 87, a: '1K', b: '3rd', allowed: ['H','D','E','I','J','L'] },
        { n: 88, a: '2D', b: '2G' },
      ];

      const matchResults: Record<number, { tA: number | null, tB: number | null }> = {};
      const usedThirds = new Set<number>();

      // PASO 1: Asignación de Locales y Visitantes (No-3rds)
      r32Defs.forEach((def) => {
        let tA: number | null = null;
        let tB: number | null = null;
        const gA = def.a.substring(1);
        const pA = parseInt(def.a[0]);
        tA = isGroupComplete(gA) ? (localStandings[gA]?.[pA-1]?.teamId ?? null) : null;
        if (def.b !== '3rd') {
          const gB = def.b.substring(1);
          const pB = parseInt(def.b[0]);
          tB = isGroupComplete(gB) ? (localStandings[gB]?.[pB-1]?.teamId ?? null) : null;
        }
        matchResults[def.n] = { tA, tB };
      });

      // PASO 2: Rellenar Terceros con lógica de asignación robusta
      r32Defs.forEach((def) => {
        if (def.b === '3rd') {
          // Buscamos al mejor clasificado que esté en nuestra lista de permitidos
          // y que no haya sido asignado aún.
          // Para evitar que equipos se queden "huérfanos", priorizamos los que tienen menos opciones.
          const availableThirds = sortedBestThirds.filter(s => !usedThirds.has(s.teamId));
          const team = availableThirds.find(s => def.allowed?.includes(s.team.group_letter));
          
          if (team) {
            matchResults[def.n].tB = team.teamId;
            usedThirds.add(team.teamId);
          } else if (availableThirds.length > 0) {
            // Fallback: Si no hay ninguno de la lista "allowed" disponible, tomamos el mejor disponible
            // para evitar que el partido se quede vacío.
            const fallbackTeam = availableThirds[0];
            matchResults[def.n].tB = fallbackTeam.teamId;
            usedThirds.add(fallbackTeam.teamId);
          }
        }
      });

      const getWinner = (p: MatchPrediction) => {
        if (!p) return null;
        if (p.winnerId && (p.winnerId === p.teamAId || p.winnerId === p.teamBId)) return p.winnerId;
        if (p.scoreA !== null && p.scoreB !== null) {
          if (p.scoreA > p.scoreB) return p.teamAId;
          if (p.scoreB > p.scoreA) return p.teamBId;
        }
        return null;
      };

      // Aplicar cambios R32
      r32Defs.forEach((def) => {
        const m = getMatchByNum(def.n);
        if (!m || !out[m.id]) return;
        const { tA, tB } = matchResults[def.n];
        if (out[m.id].teamAId !== tA || out[m.id].teamBId !== tB) {
          const oldWinner = out[m.id].winnerId;
          out[m.id] = { ...out[m.id], teamAId: tA, teamBId: tB };
          // Si el ganador antiguo ya no es válido, intentamos calcular uno nuevo o ponemos null
          if (oldWinner && (oldWinner !== tA && oldWinner !== tB)) {
            out[m.id].winnerId = getWinner(out[m.id]);
          } else if (!oldWinner) {
            out[m.id].winnerId = getWinner(out[m.id]);
          }
          changed = true;
        } else if (!out[m.id].winnerId && out[m.id].scoreA !== null && out[m.id].scoreB !== null) {
          // Si no hay ganador pero hay goles, lo calculamos
          out[m.id].winnerId = getWinner(out[m.id]);
          if (out[m.id].winnerId) changed = true;
        }
      });

      // 3. Bracket Progresivo (R16 y más allá) - ORDEN OFICIAL
      const bracket = [
        { n: 89, pA: 73, pB: 74 }, { n: 90, pA: 75, pB: 76 },
        { n: 91, pA: 77, pB: 78 }, { n: 92, pA: 79, pB: 80 },
        { n: 93, pA: 81, pB: 82 }, { n: 94, pA: 83, pB: 84 },
        { n: 95, pA: 85, pB: 86 }, { n: 96, pA: 87, pB: 88 },
        { n: 97, pA: 89, pB: 90 }, { n: 98, pA: 91, pB: 92 },
        { n: 99, pA: 93, pB: 94 }, { n: 100, pA: 95, pB: 96 },
        { n: 101, pA: 97, pB: 98 }, { n: 102, pA: 99, pB: 100 },
        { n: 104, pA: 101, pB: 102 }, { n: 103, pA: 101, pB: 102 }
      ];

      bracket.forEach(({ n, pA, pB }) => {
        const m = getMatchByNum(n);
        const mA = getMatchByNum(pA);
        const mB = getMatchByNum(pB);
        if (!m || !mA || !mB || !out[m.id]) return;

        let nA = null, nB = null;
        const predA = out[mA.id], predB = out[mB.id];
        const winA = getWinner(predA), winB = getWinner(predB);

        if (n === 103) {
          if (winA) nA = winA === predA.teamAId ? predA.teamBId : predA.teamAId;
          if (winB) nB = winB === predB.teamAId ? predB.teamBId : predB.teamAId;
        } else {
          nA = winA;
          nB = winB;
        }

        if (out[m.id].teamAId !== nA || out[m.id].teamBId !== nB) {
          const oldWinner = out[m.id].winnerId;
          out[m.id] = { ...out[m.id], teamAId: nA, teamBId: nB };
          if (!oldWinner || (oldWinner !== nA && oldWinner !== nB)) {
            out[m.id].winnerId = getWinner(out[m.id]);
          }
          changed = true;
        } else if (!out[m.id].winnerId && out[m.id].scoreA !== null && out[m.id].scoreB !== null) {
          out[m.id].winnerId = getWinner(out[m.id]);
          if (out[m.id].winnerId) changed = true;
        }
      });

      const fM = getMatchByNum(104);
      if (fM && out[fM.id]) {
        const winner = getWinner(out[fM.id]);
        if (winner) {
          const champ = winner as number;
          const runner = champ === out[fM.id].teamAId ? out[fM.id].teamBId : out[fM.id].teamAId;
          if (honors.championId !== champ || honors.runnerUpId !== runner) {
            setHonors(h => ({ ...h, championId: champ, runnerUpId: runner as number }));
          }
        }
      }

      return changed ? out : preds;
    },
    [dbMatches, dbTeams, groupPredictions, isGroupComplete, calculateGroupStandings, rankThirdPlaceTeams, honors.championId, honors.runnerUpId]
  );


  useEffect(() => {
    if (dbMatches.length === 0 || dbTeams.length === 0 || loading) return;
    setKnockoutPredictions(prev => computeBracket(prev));
  }, [groupStandings, bestThirds, dbMatches, dbTeams, loading, computeBracket]);

  const updateScore = (type: 'group' | 'knockout', stageId: string | number, matchId: number, team: 'A' | 'B', delta: number) => {
    if (isLocked) return;
    
    if (type === 'group') {
      const group = stageId as string;
      setGroupPredictions(prev => {
        const updated = { ...prev };
        const groupPreds = [...updated[group]];
        const idx = groupPreds.findIndex(p => p.matchId === matchId);
        if (idx === -1) return prev;
        
        const match = { ...groupPreds[idx] };
        if (team === 'A') {
          const current = match.scoreA ?? -1;
          match.scoreA = Math.max(0, Math.min(20, current + delta));
        } else {
          const current = match.scoreB ?? -1;
          match.scoreB = Math.max(0, Math.min(20, current + delta));
        }
        groupPreds[idx] = match;
        updated[group] = groupPreds;
        return updated;
      });
    } else {
      setKnockoutPredictions(prev => {
        const updated = { ...prev };
        const match = { ...updated[matchId] };
        if (team === 'A') {
          const current = match.scoreA ?? -1;
          match.scoreA = Math.max(0, Math.min(20, current + delta));
        } else {
          const current = match.scoreB ?? -1;
          match.scoreB = Math.max(0, Math.min(20, current + delta));
        }
        
        if (match.scoreA !== null && match.scoreB !== null && match.scoreA !== match.scoreB) {
          match.winnerId = match.scoreA > match.scoreB ? match.teamAId : match.teamBId;
        }

        updated[matchId] = match;
        
        // Propagar ganadores al resto del cuadro
        return computeBracket(updated);
      });
    }
  };

  const [savingProgress, setSavingProgress] = useState(false);
  
  const saveProgress = async (silent = false) => {
    if (isLocked) return;
    if (!silent) setSavingProgress(true);
    
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (!silent) setSavingProgress(false);
      return;
    }

    try {
      // 1. Preparar predicciones de partidos (limpieza de nulos)
      const allPreds = [
        ...Object.values(groupPredictions).flat(),
        ...Object.values(knockoutPredictions)
      ]
      .filter(p => p.scoreA !== null && p.scoreB !== null) // Solo si ambos están definidos
      .map(p => ({
        user_id: user.id,
        pool_id: poolId,
        match_id: p.matchId,
        predicted_score_a: Number(p.scoreA),
        predicted_score_b: Number(p.scoreB),
        predicted_winner_id: p.winnerId || (Number(p.scoreA) > Number(p.scoreB) ? p.teamAId : Number(p.scoreB) > Number(p.scoreA) ? p.teamBId : null)
      }));

      if (allPreds.length > 0) {
        const { error: pError } = await supabase.from('predictions').upsert(allPreds, { 
          onConflict: 'user_id,match_id,pool_id',
          ignoreDuplicates: false 
        });
        if (pError) throw new Error(`Error en partidos: ${pError.message}`);
      }

      // 2. Guardar Cuadro de Honor (solo si hay datos)
      const honorsData: any = { user_id: user.id, pool_id: poolId };
      if (honors.championId) honorsData.champion_id = honors.championId;
      if (honors.runnerUpId) honorsData.runner_up_id = honors.runnerUpId;
      if (honors.topScorer) honorsData.top_scorer = honors.topScorer;

      const { error: hError } = await supabase.from('honors_predictions').upsert(honorsData, { onConflict: 'user_id,pool_id' });
      
      if (hError) throw new Error(`Error en honores: ${hError.message}`);

      if (!silent) {
        showToast('¡Progreso guardado correctamente!');
      }
    } catch (err: any) {
      console.error('Error al guardar:', err);
      if (!silent) showToast(err.message || 'Error al guardar el progreso', 'error');
    } finally {
      if (!silent) setSavingProgress(false);
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    try {
      // 1. Guardar predicciones de partidos (filtrando los que no tengan marcador puesto)
      const allPreds = [
        ...Object.values(groupPredictions).flat(),
        ...Object.values(knockoutPredictions)
      ]
      .filter(p => p.scoreA !== null && p.scoreB !== null)
      .map(p => ({
        user_id: user.id,
        pool_id: poolId,
        match_id: p.matchId,
        predicted_score_a: Number(p.scoreA),
        predicted_score_b: Number(p.scoreB),
        predicted_winner_id: p.winnerId || (Number(p.scoreA) > Number(p.scoreB) ? p.teamAId : Number(p.scoreB) > Number(p.scoreA) ? p.teamBId : null)
      }));

      if (allPreds.length > 0) {
        const { error: pError } = await supabase.from('predictions').upsert(allPreds, { onConflict: 'user_id,match_id,pool_id' });
        if (pError) throw pError;
      }

      // 2. Guardar predicciones de bracket (clasificados a R32, R16, etc.)
      const bracketPreds: any[] = [];
      // (Lógica para extraer quién pasa de cada etapa)

      // 3. Guardar cuadro de honor
      const { error: hError } = await supabase.from('honors_predictions').upsert({
        user_id: user.id,
        pool_id: poolId,
        champion_id: honors.championId,
        runner_up_id: honors.runnerUpId,
        top_scorer: honors.topScorer
      }, { onConflict: 'user_id,pool_id' });
      if (hError) throw hError;

      // 4. Bloquear la predicción para esta liga
      const { error: lockError } = await supabase
        .from('pool_members')
        .update({ prediction_locked: true })
        .eq('pool_id', poolId)
        .eq('user_id', user.id);
        
      if (lockError) throw lockError;
      
      showToast('¡Predicción confirmada y bloqueada!', 'success');
      setTimeout(() => {
        setIsLocked(true);
        setShowConfirmModal(false);
      }, 1000);
    } catch (err: any) {
      showToast(err.message || "Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  const totalSteps = WIZARD_STEPS.length;
  const currentStepData = WIZARD_STEPS[currentStep];
  const progress = ((currentStep + 1) / totalSteps) * 100;

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" style={{ width: 50, height: 50 }}></div>
      </div>
    );
  }

  // Ya no bloqueamos el renderizado total para permitir el Modo Lectura
  const LockedBanner = () => isLocked ? (
    <div className="animate-fadeIn" style={{ 
      background: 'rgba(242,140,56,0.1)', 
      border: '1px solid var(--color-orange)', 
      padding: '1rem', 
      borderRadius: '12px', 
      marginBottom: '2rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      color: 'var(--color-orange)',
      fontWeight: 700
    }}>
      <span style={{ fontSize: '1.5rem' }}>🔒</span>
      <div>
        <div style={{ fontSize: '1.1rem' }}>PREDICCIÓN BLOQUEADA</div>
        <div style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 400 }}>Estás en modo lectura. Ya no puedes realizar cambios en tus pronósticos.</div>
      </div>
    </div>
  ) : null;

  const renderPointsResult = (matchId: number, predA: number | null, predB: number | null) => {
    const res = results[matchId];
    if (!res || predA === null || predB === null) return null;

    const match = dbMatches.find(m => m.id === matchId);
    if (!match) return null;

    const isBonus = match.is_bonus || (match.team_a?.code === nationalTeam || match.team_b?.code === nationalTeam);
    
    const calc = calculateMatchPoints(
      Number(predA), 
      Number(predB), 
      res.score_a, 
      res.score_b, 
      isBonus ? 2 : 1
    );

    let reason = "Sin acierto";
    if (calc.isExact) reason = "🎯 Resultado Exacto";
    else if (calc.isDiff) reason = "⚖️ Diferencia de Goles";
    else if (calc.is1X2) reason = "✅ Tendencia (1X2)";

    return (
      <div className="animate-slideIn" style={{ 
        marginTop: '1rem', 
        padding: '0.75rem 1rem', 
        background: 'rgba(255,255,255,0.03)', 
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.6rem', opacity: 0.5, fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Resultado Real</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--color-green)', letterSpacing: '0.1em' }}>
              {res.score_a} - {res.score_b}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.6rem', opacity: 0.5, fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Puntos Ganados</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-orange)' }}>
              +{calc.points}
            </div>
          </div>
        </div>
        <div style={{ 
          marginTop: '0.5rem', 
          paddingTop: '0.5rem', 
          borderTop: '1px solid rgba(255,255,255,0.05)',
          fontSize: '0.7rem',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          color: calc.points > 0 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)'
        }}>
          <span>{reason}</span>
          {isBonus && calc.points > 0 && (
            <span style={{ color: 'var(--color-orange)', fontSize: '0.6rem' }}>🔥 ¡BONUS X2 APLICADO!</span>
          )}
        </div>
      </div>
    );
  };

  // Renders
  const renderGroupStep = (group: string) => {
    const preds = groupPredictions[group] || [];
    const standings = groupStandings[group] || [];

    return (
      <div className="animate-fadeIn">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.75rem' }}>
            Fase de Grupos: <span style={{ color: 'var(--color-orange)' }}>Grupo {group}</span>
          </h2>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 500px))', gap: '2rem', marginBottom: '3rem', justifyItems: 'center', justifyContent: 'center' }}>
          {preds.map((p) => {
            const match = dbMatches.find(m => m.id === p.matchId);
            const teamA = dbTeams.find(t => t.id === p.teamAId);
            const teamB = dbTeams.find(t => t.id === p.teamBId);
            if (!match) return null;

            const isBonusMatch = match.is_bonus || (teamA?.code === nationalTeam || teamB?.code === nationalTeam);

            return (
              <div key={p.matchId} className={`match-card ${isBonusMatch ? 'bonus' : ''}`}>
                <div className="match-info-top">
                  <span>📅 {format(new Date(match.match_datetime), "d 'DE' MMM, HH:mm", { locale: es })}</span>
                  <span>🏟️ {match.venue}</span>
                </div>

                <div className="match-main">
                  {/* Equipo A */}
                  <div className="match-team">
                    <div className="flag-container">
                      <img 
                        src={getFlagUrl(teamA?.code)} 
                        alt={teamA?.name} 
                        className={`flag-img ${!teamA ? 'placeholder' : ''}`} 
                      />
                    </div>
                    <span className="name">{teamA?.name}</span>
                  </div>
                  
                  {/* Marcador Central */}
                  <div className="match-score-section">
                    <div className="score-box">
                      <button className="stepper-btn btn-sm" onClick={() => updateScore('group', group, p.matchId, 'A', 1)} disabled={isLocked}>+</button>
                      <span className="stepper-value" style={{ opacity: p.scoreA === null ? 0.2 : 1 }}>
                        {p.scoreA ?? 0}
                      </span>
                      <button className="stepper-btn btn-sm" onClick={() => updateScore('group', group, p.matchId, 'A', -1)} disabled={isLocked || p.scoreA === null || p.scoreA === 0}>−</button>
                    </div>
                    
                    <div className="match-vs-divider">VS</div>
                    
                    <div className="score-box">
                      <button className="stepper-btn btn-sm" onClick={() => updateScore('group', group, p.matchId, 'B', 1)} disabled={isLocked}>+</button>
                      <span className="stepper-value" style={{ opacity: p.scoreB === null ? 0.2 : 1 }}>
                        {p.scoreB ?? 0}
                      </span>
                      <button className="stepper-btn btn-sm" onClick={() => updateScore('group', group, p.matchId, 'B', -1)} disabled={isLocked || p.scoreB === null || p.scoreB === 0}>−</button>
                    </div>
                  </div>
                  
                  {/* Equipo B */}
                  <div className="match-team">
                    <div className="flag-container">
                      <img 
                        src={getFlagUrl(teamB?.code)} 
                        alt={teamB?.name} 
                        className={`flag-img ${!teamB ? 'placeholder' : ''}`} 
                      />
                    </div>
                    <span className="name">{teamB?.name}</span>
                  </div>
                </div>
                {renderPointsResult(p.matchId, p.scoreA, p.scoreB)}
              </div>
            );
          })}
        </div>
        
        {standings.length > 0 && (
          <div className="glass-card" style={{ padding: '1.5rem', marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', color: 'var(--color-orange)' }}>
              Clasificación Provisional Grupo {group}
            </h3>
            <table className="group-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>POS</th>
                  <th style={{ textAlign: 'left' }}>EQUIPO</th>
                  <th>PJ</th>
                  <th style={{ color: 'var(--color-orange)' }}>PTS</th>
                  <th>GF</th>
                  <th>GC</th>
                  <th>DG</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.teamId} className={i < 2 ? 'qualified' : i === 2 ? 'third' : 'eliminated'}>
                    <td style={{ fontWeight: 800 }}>{i + 1}</td>
                    <td style={{ textAlign: 'left' }}>
                      <img src={getFlagUrl(s.team.code)} alt={s.team.name} className="table-flag" />
                      {s.team.name}
                    </td>
                    <td>{s.played}</td>
                    <td style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--color-text)' }}>{s.points}</td>
                    <td>{s.goalsFor}</td>
                    <td>{s.goalsAgainst}</td>
                    <td style={{ color: s.goalDifference > 0 ? 'var(--color-green)' : s.goalDifference < 0 ? 'var(--color-red)' : 'inherit' }}>
                      {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1.5rem', fontSize: '0.8rem', padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-green)' }}></span> Clasifica
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-gold)' }}></span> Posible Tercero
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-text-muted)' }}></span> Eliminado
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBestThirdsStep = () => {
    const allGroupsDone = GROUPS.every(g => isGroupComplete(g));
    const thirdsToDisplay = allGroupsDone 
      ? GROUPS.map(g => groupStandings[g]?.[2]).filter(Boolean)
          .sort((a,b) => (b.points - a.points) || (b.goalDifference - a.goalDifference) || (b.goalsFor - a.goalsFor) || (a.team.fifa_ranking - b.team.fifa_ranking))
      : [];

    return (
      <div className="animate-fadeIn">
        <h2 style={{ marginBottom: '1rem' }}>📊 Mejores Terceros</h2>
        <p className="text-muted" style={{ marginBottom: '2rem' }}>Los 8 mejores terceros de entre los 12 grupos avanzan a dieciseisavos.</p>
        
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          {allGroupsDone ? (
            <table className="group-table">
              <thead>
                <tr><th>Rk</th><th>Grupo</th><th style={{textAlign:'left'}}>Equipo</th><th>PJ</th><th>Pts</th><th>DG</th><th>GF</th></tr>
              </thead>
              <tbody>
                {thirdsToDisplay.map((s, i) => {
                  const isQualified = bestThirds.some(bt => bt.teamId === s.teamId);
                  return (
                    <tr key={s.teamId} className={isQualified ? 'qualified' : 'eliminated'}>
                      <td>{i + 1}</td>
                      <td>{s.team.group_letter}</td>
                      <td style={{textAlign:'left'}}>
                        <img src={getFlagUrl(s.team.code)} alt={s.team.name} className="table-flag" />
                        {s.team.name}
                      </td>
                      <td>{s.played}</td>
                      <td style={{fontWeight:800}}>{s.points}</td>
                      <td>{s.goalDifference}</td><td>{s.goalsFor}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
              <p className="text-muted">Completa todos los grupos para ver la clasificación de los mejores terceros.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCurrentStepContent = () => {
    if (currentStepData.type === 'group') {
      return renderGroupStep(currentStepData.id.replace('group-', ''));
    }
    if (currentStepData.type === 'bestThirds') {
      return renderBestThirdsStep();
    }
    if (currentStepData.type === 'knockout') {
      const stageId = currentStepData.id.toLowerCase();
      const stageKey = stageId === 'r32' ? 'R32' : 
                       stageId === 'r16' ? 'R16' : 
                       stageId === 'qf' ? 'QF' : 
                       stageId === 'sf' ? 'SF' : 
                       stageId === 'third' ? '3rd' : 
                       stageId === 'final' ? 'F' : '';
                       
      const stageMatches = dbMatches.filter(m => m.stage === stageKey);
      
      return (
        <div className="animate-fadeIn">
          <h2 style={{ marginBottom: '1.5rem' }}>⚔️ Eliminatorias: {currentStepData.label}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 500px))', gap: '2rem', justifyItems: 'center', justifyContent: 'center' }}>
            {stageMatches.length > 0 ? stageMatches.map(m => {
              const p = knockoutPredictions[m.id];
              const teamA = dbTeams.find(t => t.id === p?.teamAId);
              const teamB = dbTeams.find(t => t.id === p?.teamBId);
              const isBonusMatch = m.is_bonus || (teamA?.code === nationalTeam || teamB?.code === nationalTeam);
              
              return (
                <div key={m.id} className={`match-card ${isBonusMatch ? 'bonus' : ''}`}>
                  <div style={{ width: '100%', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    <span>🏟️ {m.venue}</span>
                    <span>#{m.match_number}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
                    <div className="match-team">
                      <div className="flag-container">
                        <img 
                          src={getFlagUrl(teamA?.code)} 
                          alt={teamA?.name || 'TBD'} 
                          className={`flag-img ${!teamA ? 'placeholder' : ''}`} 
                        />
                      </div>
                      <span className="name">{teamA?.name || 'TBD'}</span>
                    </div>
                    
                    <div className="match-score-section">
                      <div className="score-box">
                        <button className="stepper-btn btn-sm" onClick={() => updateScore('knockout', stageId, m.id, 'A', 1)} disabled={isLocked || !p || !p.teamAId}>+</button>
                        <span className="stepper-value" style={{ opacity: p?.scoreA === null ? 0.2 : 1 }}>
                          {p?.scoreA ?? 0}
                        </span>
                        <button className="stepper-btn btn-sm" onClick={() => updateScore('knockout', stageId, m.id, 'A', -1)} disabled={isLocked || !p || p.scoreA === null || p.scoreA === 0 || !p.teamAId}>−</button>
                      </div>
                      
                      <div className="match-vs-divider">VS</div>
                      
                      <div className="score-box">
                        <button className="stepper-btn btn-sm" onClick={() => updateScore('knockout', stageId, m.id, 'B', 1)} disabled={isLocked || !p || !p.teamBId}>+</button>
                        <span className="stepper-value" style={{ opacity: p?.scoreB === null ? 0.2 : 1 }}>
                          {p?.scoreB ?? 0}
                        </span>
                        <button className="stepper-btn btn-sm" onClick={() => updateScore('knockout', stageId, m.id, 'B', -1)} disabled={isLocked || !p || p.scoreB === null || p.scoreB === 0 || !p.teamBId}>−</button>
                      </div>
                    </div>

                    <div className="match-team">
                      <div className="flag-container">
                        <img 
                          src={getFlagUrl(teamB?.code)} 
                          alt={teamB?.name || 'TBD'} 
                          className={`flag-img ${!teamB ? 'placeholder' : ''}`} 
                        />
                      </div>
                      <span className="name">{teamB?.name || 'TBD'}</span>
                    </div>
                  </div>
                  {renderPointsResult(m.id, p?.scoreA ?? null, p?.scoreB ?? null)}
                  
                  {p?.scoreA === p?.scoreB && p?.teamAId && p?.teamBId && (
                    <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem', fontWeight: 600, color: m.match_number === 104 ? 'var(--color-orange)' : 'inherit' }}>
                        {m.match_number === 104 
                          ? '🏆 Empate en la Final: ¿Quién gana el MUNDIAL por penaltis?' 
                          : 'Empate: ¿Quién pasa por penaltis?'}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                        <button 
                          className={`btn btn-sm ${p.winnerId === p.teamAId ? 'btn-primary' : 'btn-secondary'}`}
                          disabled={isLocked}
                          onClick={() => setKnockoutPredictions(prev => {
                            const updated = {...prev, [m.id]: {...prev[m.id], winnerId: p.teamAId}};
                            return computeBracket(updated);
                          })}
                        >
                          {teamA?.name}
                        </button>
                        <button 
                          className={`btn btn-sm ${p.winnerId === p.teamBId ? 'btn-primary' : 'btn-secondary'}`}
                          disabled={isLocked}
                          onClick={() => setKnockoutPredictions(prev => {
                            const updated = {...prev, [m.id]: {...prev[m.id], winnerId: p.teamBId}};
                            return computeBracket(updated);
                          })}
                        >
                          {teamB?.name}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            }) : (
              <p className="text-muted">Calculando emparejamientos basados en tus resultados de grupo...</p>
            )}
          </div>
        </div>
      );
    }
    if (currentStepData.type === 'honors') {
      const champion = dbTeams.find(t => t.id === honors.championId);
      const runnerUp = dbTeams.find(t => t.id === honors.runnerUpId);
      const selectedTeam = dbTeams.find(t => t.id === selectedPlayerTeam);
      const playerOptions = playerDatabase[selectedTeam?.code || ''] || playerDatabase.default;

      return (
        <div className="animate-fadeIn" style={{ paddingBottom: showTeamDropdown ? '250px' : '2rem' }}>
          <h2 style={{ marginBottom: '2rem', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>🏆 Cuadro de Honor</h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '1.5rem',
          }}>
            {/* Campeón */}
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', border: honors.championId ? '1px solid var(--color-orange)' : '' }}>
              <div style={{ margin: '1rem 0' }}>
                <img src="/trophy_nobg.png" alt="Campeón" style={{ height: '140px', width: 'auto', filter: 'drop-shadow(0 0 15px rgba(242,140,56,0.4))' }} />
              </div>
              <h3 style={{ marginBottom: '1rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Campeón del Mundo</h3>
              {champion ? (
                <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <img src={getFlagUrl(champion.code)} style={{ width: 80, height: 53, objectFit: 'contain', borderRadius: 6, marginBottom: '0.75rem', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }} />
                  <div style={{ fontWeight: 800, fontSize: '1.4rem', textTransform: 'uppercase', color: 'var(--color-orange)' }}>{champion.name}</div>
                </div>
              ) : (
                <div style={{ padding: '2rem', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '16px' }}>
                  <p className="text-muted">Se definirá al completar la final</p>
                </div>
              )}
            </div>

            {/* Subcampeón */}
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.8 }}>🥈</div>
              <h3 style={{ marginBottom: '1rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Subcampeón</h3>
              {runnerUp ? (
                <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <img src={getFlagUrl(runnerUp.code)} style={{ width: 80, height: 53, objectFit: 'contain', borderRadius: 6, marginBottom: '0.75rem' }} />
                  <div style={{ fontWeight: 800, fontSize: '1.4rem', textTransform: 'uppercase' }}>{runnerUp.name}</div>
                </div>
              ) : (
                <div style={{ padding: '2rem', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '16px' }}>
                  <p className="text-muted">Se definirá al completar la final</p>
                </div>
              )}
            </div>

            {/* Bota de Oro */}
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{ margin: '1rem 0' }}>
                <img src="/boot_nobg.png" alt="Bota de Oro" style={{ height: '140px', width: 'auto', mixBlendMode: 'screen', filter: 'drop-shadow(0 0 15px rgba(242,140,56,0.3))' }} />
              </div>
              <h3 style={{ marginBottom: '1.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Bota de Oro</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.7rem', opacity: 0.6 }}>1. SELECCIÓN DEL GOLEADOR</label>
                  
                  {/* Custom Team Selector */}
                  <div style={{ position: 'relative' }}>
                    <div 
                      className={`form-input ${isLocked ? 'readonly' : ''}`} 
                      style={{ cursor: isLocked ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: isLocked ? 0.7 : 1 }}
                      onClick={() => !isLocked && setShowTeamDropdown(!showTeamDropdown)}
                    >
                      {selectedTeam ? (
                        <>
                          <img src={getFlagUrl(selectedTeam.code)} style={{ width: 24, height: 16, objectFit: 'contain', borderRadius: 2 }} />
                          <span style={{ fontWeight: 600 }}>{selectedTeam.name}</span>
                        </>
                      ) : (
                        <span className="text-muted">Selecciona equipo...</span>
                      )}
                      {!isLocked && <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.7rem' }}>{showTeamDropdown ? '▲' : '▼'}</span>}
                    </div>

                    {showTeamDropdown && (
                      <div className="animate-slideIn" style={{ 
                        position: 'absolute', top: '110%', left: 0, right: 0, 
                        background: '#1a202c', border: '1px solid rgba(255,255,255,0.15)', 
                        borderRadius: '12px', zIndex: 9999, maxHeight: '250px', overflowY: 'auto',
                        boxShadow: '0 10px 50px rgba(0,0,0,0.8)', padding: '0.5rem',
                        scrollbarWidth: 'thin', scrollbarColor: 'var(--color-orange) transparent'
                      }}>
                        {[...dbTeams].sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                          <div 
                            key={t.id} 
                            style={{ 
                              display: 'flex', alignItems: 'center', gap: '0.75rem', 
                              padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer',
                              background: selectedPlayerTeam === t.id ? 'rgba(242,140,56,0.1)' : 'transparent',
                              transition: 'all 0.2s'
                            }}
                            className="dropdown-item-hover"
                            onClick={() => {
                              setSelectedPlayerTeam(t.id);
                              setHonors(h => ({ ...h, topScorer: '' }));
                              setShowTeamDropdown(false);
                            }}
                          >
                            <img src={getFlagUrl(t.code)} style={{ width: 22, height: 15, objectFit: 'contain', borderRadius: 2 }} />
                            <span style={{ fontSize: '0.9rem', fontWeight: selectedPlayerTeam === t.id ? 700 : 400 }}>{t.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {selectedPlayerTeam && (
                  <div className="animate-slideIn">
                    <label className="form-label" style={{ fontSize: '0.7rem', opacity: 0.6 }}>2. ELIGE AL JUGADOR</label>
                    <select 
                      className="form-input" 
                      disabled={isLocked}
                      value={honors.topScorer} 
                      onChange={e => {
                        setHonors(h => ({ ...h, topScorer: e.target.value }));
                      }}
                    >
                      <option value="">¿Quién será el Pichichi?</option>
                      {[...playerOptions].sort().map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (currentStepData.type === 'summary') {
      return (
        <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '2rem 0' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>📋 Revisión Final</h2>
          <div className="glass-card" style={{ padding: '3rem', maxWidth: 500, margin: '0 auto' }}>
            {isLocked ? (
              <>
                <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🏆</div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--color-green)' }}>¡Predicción Enviada!</h3>
                <p className="text-muted">
                  Tus pronósticos están registrados y bloqueados. 
                  ¡Mucha suerte en la Porra GINSO!
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>📝</div>
                <p style={{ fontSize: '1.1rem', marginBottom: '2rem' }}>
                  Has completado todos los pasos de tu predicción. 
                  Asegúrate de que todo esté correcto antes de enviar.
                </p>
                <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={() => setShowConfirmModal(true)}>
                  🔒 Enviar y Bloquear
                </button>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="container" style={{ paddingBottom: '5rem' }}>
      <div className="dashboard-header animate-fadeIn">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          {poolLogo && (
            <img src={poolLogo} alt="Logo" style={{ height: 40, borderRadius: 4 }} />
          )}
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--color-orange)' }}>
              LA PORRA DEL MUNDIAL: <span style={{ color: '#fff' }}>{poolName || '2026'}</span>
            </h1>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>Paso {currentStep + 1} de {totalSteps}: {currentStepData.label}</p>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '2.5rem' }}>
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="wizard-steps" style={{ marginTop: '1rem' }}>
          {WIZARD_STEPS.map((step, i) => (
            <button 
              key={step.id} 
              className={`wizard-step ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}`} 
              onClick={() => setCurrentStep(i)}
            >
              {step.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ minHeight: '50vh' }}>
        <LockedBanner />
        {renderCurrentStepContent()}
      </div>

      <div style={{ 
        position: 'fixed', bottom: 0, left: 0, right: 0, padding: '1.5rem', 
        background: 'rgba(11, 15, 26, 0.8)', backdropFilter: 'blur(10px)', 
        borderTop: '1px solid var(--color-border)', zIndex: 50,
        display: 'flex', justifyContent: 'center'
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          {/* Botones de Navegación */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button 
              className="btn btn-secondary"
              onClick={() => saveProgress()}
              disabled={savingProgress || isLocked}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {savingProgress ? '⌛ Guardando...' : '💾 Guardar progreso'}
            </button>

            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 0.5rem' }}></div>

            {currentStep > 0 && (
              <button 
                className="btn btn-secondary"
                onClick={() => setCurrentStep(prev => prev - 1)}
              >
                ← Anterior
              </button>
            )}
            
            {currentStep < WIZARD_STEPS.length - 1 ? (
              <button 
                className="btn btn-primary"
                onClick={() => setCurrentStep(prev => prev + 1)}
              >
                Siguiente →
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
              <h2 className="modal-title">¿Confirmar predicción?</h2>
              <p className="text-muted">
                Al confirmar, tus pronósticos quedarán bloqueados y no podrás editarlos. 
                Se utilizarán para el ranking oficial de la Porra GINSO.
              </p>
            </div>
            <div className="modal-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 20, height: 20 }}></span> : '🔒 Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Toast Notification */}
      {toast && (
        <div 
          className="animate-fadeIn"
          style={{ 
            position: 'fixed', bottom: '6rem', left: '50%', transform: 'translateX(-50%)',
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
