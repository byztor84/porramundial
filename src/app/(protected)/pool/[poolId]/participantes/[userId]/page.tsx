'use client';

import { useEffect, useState, useMemo, use } from 'react';
export const dynamic = "force-dynamic";
import { createClient } from '@/lib/supabase/client';
import { GROUPS, WIZARD_STEPS } from '@/lib/constants/tournament';
import { calculateGroupStandings, rankThirdPlaceTeams } from '@/lib/scoring/classification';
import type { GroupStanding, Team, Match } from '@/lib/types/database';
import { getFlagUrl } from '@/lib/utils/flags';
import Link from 'next/link';

interface MatchPrediction {
  matchId: number;
  teamAId: number | null;
  teamBId: number | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId?: number | null;
}

export default function ViewUserPredictions({ params }: { params: Promise<{ poolId: string, userId: string }> }) {
  const { poolId, userId } = use(params);
  const [dbMatches, setDbMatches] = useState<Match[]>([]);
  const [dbTeams, setDbTeams] = useState<Team[]>([]);
  const [savedPreds, setSavedPreds] = useState<any[]>([]);
  const [honors, setHonors] = useState({ championId: null as number | null, runnerUpId: null as number | null, topScorer: '' });
  const [dbResults, setDbResults] = useState<any[]>([]);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  const TROPHY_IMG = "/images/trophy.png";

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const [{ data: teams }, { data: matches }, { data: preds }, { data: savedHonors }, { data: userData }, { data: results }] = await Promise.all([
          supabase.from('teams').select('*').order('id'),
          supabase.from('matches').select('*').order('match_number'),
          supabase.from('predictions').select('*').eq('user_id', userId).eq('pool_id', poolId),
          supabase.from('honors_predictions').select('*').eq('user_id', userId).eq('pool_id', poolId).maybeSingle(),
          supabase.from('profiles').select('first_name, last_name, email').eq('id', userId).single(),
          supabase.from('results').select('*')
        ]);

        if (userData) setUserName(userData.first_name ? `${userData.first_name} ${userData.last_name}` : userData.email.split('@')[0]);
        if (teams) setDbTeams(teams);
        if (matches) setDbMatches(matches);
        if (preds) setSavedPreds(preds);
        if (results) setDbResults(results);
        if (savedHonors) setHonors({ championId: savedHonors.champion_id, runnerUpId: savedHonors.runner_up_id, topScorer: savedHonors.top_scorer || '' });
      } catch (err) {
        console.error("Error loading predictions:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [poolId, userId]);

  const groupPredictions = useMemo(() => {
    const gp: Record<string, MatchPrediction[]> = {};
    GROUPS.forEach(l => {
      const groupKey = `group-${l}`;
      gp[groupKey] = dbMatches.filter(m => m.stage === 'group' && m.group_letter === l).map(m => {
        const sp = savedPreds?.find(p => p.match_id === m.id);
        return { 
          matchId: m.id, 
          teamAId: m.team_a_id, 
          teamBId: m.team_b_id, 
          scoreA: sp?.predicted_score_a ?? null, 
          scoreB: sp?.predicted_score_b ?? null 
        };
      });
    });
    return gp;
  }, [dbMatches, savedPreds]);

  const localStandings = useMemo(() => {
    const gs: Record<string, GroupStanding[]> = {};
    Object.entries(groupPredictions).forEach(([sid, preds]) => {
      const l = sid.split('-')[1];
      const t = dbTeams.filter(team => team.group_letter === l);
      gs[sid] = calculateGroupStandings(t, preds.map(p => ({ 
        teamAId: Number(p.teamAId), 
        teamBId: Number(p.teamBId), 
        scoreA: p.scoreA, 
        scoreB: p.scoreB 
      })));
    });
    return gs;
  }, [groupPredictions, dbTeams]);

  const bestThirds = useMemo(() => {
    const thirds = GROUPS.map(l => localStandings[`group-${l}`]?.[2]).filter(Boolean);
    return rankThirdPlaceTeams(thirds).slice(0, 8);
  }, [localStandings]);

  const computedKO = useMemo(() => {
    const out: Record<number, MatchPrediction> = {};
    
    const getWinner = (p: any) => {
      if (!p) return null;
      const sA = p.scoreA !== null ? Number(p.scoreA) : null;
      const sB = p.scoreB !== null ? Number(p.scoreB) : null;
      
      if (p.winnerId && (String(p.winnerId) === String(p.teamAId) || String(p.winnerId) === String(p.teamBId))) return p.winnerId;
      if (sA !== null && sB !== null) {
        if (sA > sB) return p.teamAId;
        if (sB > sA) return p.teamBId;
      }
      return null;
    };

    const r32Assignments = [
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

    const usedThirds = new Set<string>();
    
    r32Assignments.forEach((matchDef) => {
      const m = dbMatches.find(x => x.match_number === matchDef.n);
      const sp = savedPreds?.find(p => p.match_id === m?.id) || {};
      
      const aType = parseInt(matchDef.a[0]); 
      const aGroup = matchDef.a[1];
      const teamAId = localStandings[`group-${aGroup}`]?.[aType - 1]?.teamId || null;

      let teamBId: number | null = null;
      if (matchDef.b === '3rd') {
        const available = bestThirds.filter(s => !usedThirds.has(String(s.teamId)));
        const team = available.find(s => matchDef.allowed?.includes(s.team.group_letter)) || available[0];
        if (team) {
          teamBId = team.teamId;
          usedThirds.add(String(team.teamId));
        }
      } else {
        const bType = parseInt(matchDef.b[0]);
        const bGroup = matchDef.b[1];
        teamBId = localStandings[`group-${bGroup}`]?.[bType - 1]?.teamId || null;
      }

      const matchObj = { 
        matchId: m?.id || 0, 
        teamAId, 
        teamBId, 
        scoreA: sp.predicted_score_a ?? null, 
        scoreB: sp.predicted_score_b ?? null, 
        winnerId: sp.predicted_winner_id ?? null 
      };
      matchObj.winnerId = getWinner(matchObj);
      out[matchDef.n] = matchObj;
    });

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
      const m = dbMatches.find(x => x.match_number === n);
      const sp = savedPreds?.find(p => p.match_id === m?.id) || {};
      const predA = out[pA], predB = out[pB];
      
      let teamAId: number | null = null;
      let teamBId: number | null = null;

      if (n === 103) { // 3rd Place Match
        const wA = getWinner(predA), wB = getWinner(predB);
        if (predA && wA) teamAId = String(wA) === String(predA.teamAId) ? predA.teamBId : predA.teamAId;
        if (predB && wB) teamBId = String(wB) === String(predB.teamAId) ? predB.teamBId : predB.teamAId;
      } else {
        teamAId = getWinner(predA);
        teamBId = getWinner(predB);
      }

      const matchObj = { 
        matchId: m?.id || 0, 
        teamAId, 
        teamBId, 
        scoreA: sp.predicted_score_a ?? null, 
        scoreB: sp.predicted_score_b ?? null, 
        winnerId: sp.predicted_winner_id ?? null 
      };
      matchObj.winnerId = getWinner(matchObj);
      out[n] = matchObj;
    });

    return out;
  }, [dbMatches, dbTeams, savedPreds, localStandings, bestThirds]);

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

  const renderMini = (num: number, width = '155px') => {
    const p = computedKO[num];
    const m = dbMatches.find(x => x.match_number === num);
    const tA = dbTeams.find(t => String(t.id) === String(p?.teamAId));
    const tB = dbTeams.find(t => String(t.id) === String(p?.teamBId));
    const winId = p?.winnerId;
    const real = dbResults.find(r => r.match_id === m?.id);

    let pts = 0;
    if (real && p) {
       const pa = p.scoreA ?? 0;
       const pb = p.scoreB ?? 0;
       const ra = real.score_a;
       const rb = real.score_b;
       if (pa === ra && pb === rb) pts = 12;
       else if ((pa - pb) === (ra - rb)) pts = 6;
       else if ((pa > pb && ra > rb) || (pa < pb && ra < rb) || (pa === pb && ra === rb)) pts = 3;
       if (m?.is_bonus || tA?.code === 'ESP' || tB?.code === 'ESP') pts *= 2;
    }

    return (
      <div key={num} className="mini-match glass-card" style={{ padding: '0.4rem', width, border: pts > 0 ? '1px solid var(--color-orange)' : '1px solid rgba(255,255,255,0.08)', margin: '0 auto', background: 'rgba(0,0,0,0.4)', position: 'relative' }}>
        {pts > 0 && (
          <div style={{ position: 'absolute', top: -8, right: -8, background: 'var(--color-orange)', color: '#000', fontSize: '0.5rem', fontWeight: 900, padding: '2px 5px', borderRadius: '4px', boxShadow: '0 2px 5px rgba(0,0,0,0.5)', zIndex: 10 }}>
            +{pts}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: tA ? 1 : 0.4, background: winId && String(winId) === String(tA?.id) ? 'rgba(242,140,56,0.2)' : 'transparent', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.65rem' }}>
            <img src={getFlagUrl(tA?.code)} style={{ width: 16, height: 11, objectFit: 'contain', borderRadius: 1 }} /> 
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px', fontWeight: tA ? 700 : 400 }}>{tA?.name || 'TBD'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            {real && <span style={{ fontSize: '0.5rem', color: 'var(--color-green)', opacity: 0.8 }}>({real.score_a})</span>}
            <span style={{ fontWeight: 900, fontSize: '0.75rem', color: 'var(--color-orange)' }}>{p?.scoreA ?? '-'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem', opacity: tB ? 1 : 0.4, background: winId && String(winId) === String(tB?.id) ? 'rgba(242,140,56,0.2)' : 'transparent', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.65rem' }}>
            <img src={getFlagUrl(tB?.code)} style={{ width: 16, height: 11, objectFit: 'contain', borderRadius: 1 }} /> 
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px', fontWeight: tB ? 700 : 400 }}>{tB?.name || 'TBD'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            {real && <span style={{ fontSize: '0.5rem', color: 'var(--color-green)', opacity: 0.8 }}>({real.score_b})</span>}
            <span style={{ fontWeight: 900, fontSize: '0.75rem', color: 'var(--color-orange)' }}>{p?.scoreB ?? '-'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '1rem', width: '100%', maxWidth: '100vw', minHeight: '100vh', background: 'var(--color-bg)' }}>
      <style jsx global>{`
        .force-scroll { overflow-x: scroll !important; overflow-y: hidden !important; scrollbar-width: auto !important; scrollbar-color: var(--color-orange) rgba(0,0,0,0.3) !important; }
        .force-scroll::-webkit-scrollbar { height: 10px !important; display: block !important; }
        .force-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); border-radius: 10px; }
        .force-scroll::-webkit-scrollbar-thumb { background: var(--color-orange); border-radius: 10px; border: 3px solid #111; }
        .col-r32 { display: grid; grid-template-rows: repeat(8, 1fr); height: 100%; gap: 1px; }
        .col-r16 { display: grid; grid-template-rows: repeat(4, 1fr); height: 100%; }
        .col-qf { display: grid; grid-template-rows: repeat(2, 1fr); height: 100%; }
        .col-sf { display: flex; flex-direction: column; justify-content: center; height: 100%; }
      `}</style>

      <div className="glass-card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'rgba(242,140,56,0.05)', border: '1px solid var(--color-orange)' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', margin: 0 }}>PRONÓSTICOS DE: <span style={{ color: 'var(--color-orange)', fontWeight: 900 }}>{userName.toUpperCase()}</span></h1>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Visualizando la estrategia completa de este participante.</p>
        </div>
        <Link href={`/pool/${poolId}/participantes`} className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>Atrás</Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* GRUPOS */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--color-orange)', marginBottom: '1.5rem', fontWeight: 900 }}>📊 RESUMEN DE GRUPOS</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {GROUPS.map(l => (
              <div key={l} className="glass-card" style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.02)' }}>
                <h3 style={{ fontSize: '0.8rem', marginBottom: '0.8rem', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>GRUPO {l}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {localStandings[`group-${l}`]?.map((s, i) => (
                    <div key={s.teamId} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.7rem', opacity: i < 2 ? 1 : 0.6 }}>
                      <span style={{ width: 12, fontWeight: 900 }}>{i+1}</span>
                      <img src={getFlagUrl(dbTeams.find(t => t.id === s.teamId)?.code)} style={{ width: 16, height: 11, objectFit: 'contain', borderRadius: 1 }} />
                      <span style={{ flex: 1 }}>{dbTeams.find(t => t.id === s.teamId)?.name}</span>
                      <span style={{ fontWeight: 800 }}>{s.points} PTS</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--color-orange)', textTransform: 'uppercase', marginBottom: '0.5rem', opacity: 0.8 }}>Resultados Predichos</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {groupPredictions[`group-${l}`]?.map((p, idx) => {
                      const tA = dbTeams.find(t => t.id === p.teamAId);
                      const tB = dbTeams.find(t => t.id === p.teamBId);
                      const real = dbResults.find(r => r.match_id === p.matchId);
                      const matchInfo = dbMatches.find(m => m.id === p.matchId);
                      
                      let pointsInfo = null;
                      if (real) {
                        const pa = p.scoreA ?? 0;
                        const pb = p.scoreB ?? 0;
                        const ra = real.score_a;
                        const rb = real.score_b;
                        let pts = 0;
                        let types = [];
                        
                        // 1. Tendencia (1X2)
                        if ((pa > pb && ra > rb) || (pa < pb && ra < rb) || (pa === pb && ra === rb)) {
                          pts += 3;
                          types.push("1X2");
                        }
                        // 2. Diferencia
                        if ((pa - pb) === (ra - rb)) {
                          pts += 6;
                          types.push("DIF");
                        }
                        // 3. Exacto
                        if (pa === ra && pb === rb) {
                          pts += 12;
                          types.push("EXACTO");
                        }
                        
                        const isBonus = matchInfo?.is_bonus || tA?.code === 'ESP' || tB?.code === 'ESP';
                        if (isBonus) pts *= 2;
                        
                        pointsInfo = { pts, type: types.join(" + "), isBonus, ra, rb };
                      }

                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.5rem', borderRadius: '4px', border: pointsInfo && pointsInfo.pts > 0 ? '1px solid rgba(242,140,56,0.3)' : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1 }}>
                              <img src={getFlagUrl(tA?.code)} style={{ width: 12, height: 8, objectFit: 'contain', borderRadius: 1 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60px' }}>{tA?.name}</span>
                            </div>
                            <div style={{ fontWeight: 900, color: 'var(--color-orange)', margin: '0 0.5rem', minWidth: '35px', textAlign: 'center', fontSize: '0.75rem' }}>
                              {p.scoreA ?? '-'} : {p.scoreB ?? '-'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, justifyContent: 'flex-end' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60px', textAlign: 'right' }}>{tB?.name}</span>
                              <img src={getFlagUrl(tB?.code)} style={{ width: 12, height: 8, objectFit: 'contain', borderRadius: 1 }} />
                            </div>
                          </div>
                          {pointsInfo && pointsInfo.pts > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', paddingTop: '0.2rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.6rem' }}>
                               <div style={{ color: 'var(--color-green)', fontWeight: 800 }}>REAL: {pointsInfo.ra} - {pointsInfo.rb}</div>
                               <div style={{ background: pointsInfo.pts >= 18 ? 'var(--color-orange)' : 'rgba(255,255,255,0.1)', color: pointsInfo.pts >= 18 ? '#000' : '#fff', padding: '1px 4px', borderRadius: '3px', fontWeight: 900 }}>
                                 {pointsInfo.pts} PTS {pointsInfo.isBonus && '🚀'}
                               </div>
                               <span style={{ opacity: 0.6, fontWeight: 700 }}>{pointsInfo.type}</span>
                            </div>
                          )}
                          {pointsInfo && pointsInfo.pts === 0 && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', paddingTop: '0.2rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.6rem', opacity: 0.4 }}>
                               <div style={{ color: '#ff4d4d' }}>REAL: {pointsInfo.ra} - {pointsInfo.rb}</div>
                               <div>0 PTS</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BRACKET ELIMINATORIO */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--color-orange)', marginBottom: '1.5rem', fontWeight: 900 }}>🏆 CUADRO ELIMINATORIO PREDICHO</h2>
          <div className="force-scroll" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.4)', borderRadius: '16px', minHeight: '650px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '1.5rem', minWidth: '1800px', height: '600px' }}>
              
              <div style={{ display: 'flex', gap: '1.5rem', height: '100%' }}>
                  <div className="col-r32">
                    {[73, 74, 75, 76, 77, 78, 79, 80].map(n => <div key={n} style={{display:'flex', alignItems:'center'}}>{renderMini(n)}</div>)}
                  </div>
                  <div className="col-r16">
                    {[89, 90, 91, 92].map(n => <div key={n} style={{display:'flex', alignItems:'center'}}>{renderMini(n)}</div>)}
                  </div>
                  <div className="col-qf">
                    {[97, 98].map(n => <div key={n} style={{display:'flex', alignItems:'center'}}>{renderMini(n)}</div>)}
                  </div>
                  <div className="col-sf">
                    {renderMini(101)}
                  </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '0 3rem', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)', minWidth: '280px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'gold', marginBottom: '0.5rem' }}>GRAN FINAL</div>
                    {renderMini(104, '200px')}
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <img src="/images/trophy.png" style={{ width: '60px', filter: 'drop-shadow(0 0 15px gold)' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.8rem' }}>
                        <img src={getFlagUrl(dbTeams.find(t => t.id === honors.championId)?.code)} style={{ width: 30, height: 20, objectFit: 'contain', borderRadius: 2 }} />
                        <div style={{ color: 'gold', fontWeight: 900, fontSize: '1.3rem' }}>{dbTeams.find(t => t.id === honors.championId)?.name || '---'}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', textAlign: 'center', width: '100%' }}>
                    <div style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '0.3rem' }}>3er PUESTO</div>
                    {renderMini(103, '180px')}
                  </div>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', flexDirection: 'row-reverse', height: '100%' }}>
                  <div className="col-r32">
                    {[81, 82, 83, 84, 85, 86, 87, 88].map(n => <div key={n} style={{display:'flex', alignItems:'center'}}>{renderMini(n)}</div>)}
                  </div>
                  <div className="col-r16">
                    {[93, 94, 95, 96].map(n => <div key={n} style={{display:'flex', alignItems:'center'}}>{renderMini(n)}</div>)}
                  </div>
                  <div className="col-qf">
                    {[99, 100].map(n => <div key={n} style={{display:'flex', alignItems:'center'}}>{renderMini(n)}</div>)}
                  </div>
                  <div className="col-sf">
                    {renderMini(102)}
                  </div>
              </div>

            </div>
          </div>
        </div>

        {/* HONOR */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '5rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <h3 style={{ fontSize: '0.7rem', color: 'var(--color-orange)', fontWeight: 900, textTransform: 'uppercase' }}>Bota de Oro</h3>
            <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.5rem' }}>{honors.topScorer || '---'}</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <h3 style={{ fontSize: '0.7rem', color: 'var(--color-orange)', fontWeight: 900, textTransform: 'uppercase' }}>Subcampeón</h3>
            <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.5rem' }}>{dbTeams.find(t => t.id === honors.runnerUpId)?.name || '---'}</div>
          </div>
        </div>

      </div>
    </div>
  );
}
