'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getFlagUrl } from '@/lib/utils/flags';
import type { Profile, Standing, Match } from '@/lib/types/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function PoolDashboardPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = use(params);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [poolName, setPoolName] = useState('la Porra');
  const [poolLogo, setPoolLogo] = useState<string | null>(null);
  const [entryFee, setEntryFee] = useState(0);
  const [totalPot, setTotalPot] = useState(0);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [rank, setRank] = useState(0);
  const [nextMatch, setNextMatch] = useState<any>(null);
  const [predictionLocked, setPredictionLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, poolRes, standingRes, allStandingsRes, matchesRes, membersRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('pools').select('name, entry_fee, logo_url').eq('id', poolId).single(),
        supabase.from('standings').select('*').eq('user_id', user.id).eq('pool_id', poolId).single(),
        supabase.from('standings').select('user_id, total_points').eq('pool_id', poolId).order('total_points', { ascending: false }),
        supabase.from('matches').select('*, team_a:team_a_id(*), team_b:team_b_id(*)').order('match_datetime', { ascending: true }).limit(10),
        supabase.from('pool_members').select('has_paid, prediction_locked').eq('pool_id', poolId).eq('user_id', user.id).single()
      ]);

      if (profileRes.data) setProfile(profileRes.data as Profile);
      
      let fee = 0;
      if (poolRes.data) {
        setPoolName(poolRes.data.name);
        setPoolLogo(poolRes.data.logo_url);
        fee = poolRes.data.entry_fee || 0;
        setEntryFee(fee);
      }
      
      if (standingRes.data) setStanding(standingRes.data as Standing);

      if (membersRes.data) {
        setPredictionLocked(membersRes.data.prediction_locked);
        
        // Contar participantes reales y calcular el bote
        const { data: allMembers } = await supabase.from('pool_members').select('has_paid').eq('pool_id', poolId);
        if (allMembers) {
          setTotalUsers(allMembers.length);
          const paidCount = allMembers.filter((m: any) => m.has_paid).length;
          setTotalPot(paidCount * fee);
        }
      }

      if (allStandingsRes.data) {
        const myRank = allStandingsRes.data.findIndex((s: { user_id: string }) => s.user_id === user.id) + 1;
        setRank(myRank);
      }

      if (matchesRes.data) {
        setNextMatch(matchesRes.data[0]);
      }
      
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div className="animate-fadeIn" style={{ paddingBottom: '5rem' }}>
      <div className="dashboard-header animate-slideUp" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {poolLogo && (
              <img src={poolLogo} alt="Logo" style={{ height: '60px', width: 'auto', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }} />
            )}
            <div>
              <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--color-orange)', textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                LA PORRA DEL MUNDIAL: <br/>
                <span style={{ color: '#fff' }}>{poolName}</span>
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' }}>
                <span className={`badge ${predictionLocked ? 'badge-success' : 'badge-bonus'}`} style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', fontWeight: 800 }}>
                  {predictionLocked ? '🔒 PREDICCIÓN CONFIRMADA' : '✏️ PREDICCIÓN PENDIENTE'}
                </span>
                <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                  ¡Hola, {profile?.first_name || 'Jugador'}! Tu camino a la gloria empieza aquí.
                </p>
              </div>
            </div>
          </div>
        <Link href="/dashboard" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
          ⬅️ Volver a Mis Porras
        </Link>
      </div>

      <div className="dashboard-grid">
        <div className="glass-card stat-card" style={{ borderBottom: '4px solid var(--color-orange)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-label">Tu posición</div>
              <div className="stat-value orange">{rank > 0 ? `#${rank}` : '—'}</div>
            </div>
            <div style={{ position: 'relative' }}>
              <img src="/trophy_nobg.png" alt="Ranking" style={{ height: '75px', width: 'auto', filter: 'drop-shadow(0 0 10px rgba(242,140,56,0.3))' }} />
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>de {totalUsers} participantes</p>
        </div>

        <div className="glass-card stat-card" style={{ borderBottom: '4px solid var(--color-grass)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-label">Puntos totales</div>
              <div className="stat-value green">{standing?.total_points ?? 0}</div>
            </div>
            <div style={{ fontSize: '2.5rem' }}>📊</div>
          </div>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            {standing?.exact_hits ?? 0} resultados exactos (Plenos)
          </p>
        </div>

        <Link href={`/pool/${poolId}/participantes`} className="glass-card stat-card" style={{ borderBottom: '4px solid #3b82f6', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-label">Participantes</div>
              <div className="stat-value blue">{totalUsers}</div>
            </div>
            <div style={{ fontSize: '2.5rem' }}>👥</div>
          </div>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Ver todos los jugadores y sus pronósticos →
          </p>
        </Link>
      </div>

      {/* Botones de Acción Principal - Movidos arriba para máxima visibilidad */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', marginBottom: '2.5rem' }}>
        {!predictionLocked ? (
          <Link href={`/pool/${poolId}/predicciones`} className="btn btn-primary btn-lg" style={{ flex: 1, padding: '1.5rem', fontSize: '1.1rem' }}>
            ⚽ COMPLETAR MI PREDICCIÓN
          </Link>
        ) : (
          <Link href={`/pool/${poolId}/predicciones`} className="btn btn-secondary btn-lg" style={{ flex: 1, padding: '1.5rem', fontSize: '1.1rem' }}>
            🔍 VER MIS PRONÓSTICOS
          </Link>
        )}
        <Link href={`/pool/${poolId}/ranking`} className="btn btn-secondary btn-lg" style={{ flex: 1, padding: '1.5rem', fontSize: '1.1rem' }}>
          🏆 CLASIFICACIÓN
        </Link>
        <Link href={`/pool/${poolId}/gestion`} className="btn btn-secondary btn-lg" style={{ flex: 1, padding: '1.5rem', fontSize: '1.1rem' }}>
          ⚙️ GESTIÓN DE LA PORRA
        </Link>
      </div>

      {/* Siguiente Partido */}
      {nextMatch && (
        <div className={`glass-card ${nextMatch.is_bonus || nextMatch.team_a?.code === 'ESP' || nextMatch.team_b?.code === 'ESP' ? 'bonus' : ''}`} style={{ padding: '1.75rem', background: 'rgba(0,0,0,0.5)', overflow: 'hidden', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', letterSpacing: '0.05em' }}>
                🕒 PRÓXIMO PARTIDO
              </span>
              {(nextMatch.is_bonus || nextMatch.team_a?.code === 'ESP' || nextMatch.team_b?.code === 'ESP') && (
                <span className="badge badge-bonus" style={{ background: 'var(--color-orange)', color: '#fff', animation: 'pulse 2s infinite' }}>
                  ⚡ BONUS X2
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              📍 {nextMatch.venue}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <img src={getFlagUrl(nextMatch.team_a?.code)} style={{ width: 60, height: 40, borderRadius: 4, objectFit: 'contain' }} />
              <div style={{ fontWeight: 800, marginTop: '0.5rem', fontSize: '0.9rem' }}>{nextMatch.team_a?.name}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{format(new Date(nextMatch.match_datetime), 'HH:mm')}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{format(new Date(nextMatch.match_datetime), 'dd MMM', { locale: es }).toUpperCase()}</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <img src={getFlagUrl(nextMatch.team_b?.code)} style={{ width: 60, height: 40, borderRadius: 4, objectFit: 'contain' }} />
              <div style={{ fontWeight: 800, marginTop: '0.5rem', fontSize: '0.9rem' }}>{nextMatch.team_b?.name}</div>
            </div>
          </div>
        </div>
      )}

      {/* Sección de Reglas y Bote */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-orange)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              📜 SISTEMA DE PUNTUACIÓN OFICIAL
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Columna Partidos */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, opacity: 0.7, marginBottom: '1rem', color: 'var(--color-orange)' }}>⚽ POR CADA PARTIDO</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}><span>Resultado Exacto</span> <strong style={{ color: 'var(--color-green)' }}>12 pts</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}><span>Diferencia de Goles</span> <strong style={{ color: '#3b82f6' }}>6 pts</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}><span>Tendencia (1X2)</span> <strong style={{ color: '#fff' }}>3 pts</strong></div>
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(242,140,56,0.1)', borderRadius: '6px', fontSize: '0.75rem', textAlign: 'center', color: 'var(--color-orange)', fontWeight: 800 }}>
                    🔥 BONUS SELECCIÓN Y ESPECIALES: X2 PUNTOS
                  </div>
                </div>
              </div>

              {/* Columna Progresión */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, opacity: 0.7, marginBottom: '1rem', color: 'var(--color-orange)' }}>🧠 PUNTOS POR CLASIFICADOS</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}><span>1/16 Final</span> <strong>3</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}><span>Octavos</span> <strong>6</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}><span>Cuartos</span> <strong>12</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}><span>Semis</span> <strong>25</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(242,140,56,0.1)', padding: '0.4rem 0.6rem', borderRadius: '4px', gridColumn: 'span 2' }}>
                    <span>ACERTAR FINALISTAS</span> <strong style={{ color: 'var(--color-orange)' }}>50 pts/u</strong>
                  </div>
                </div>
                <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                   <span>🏆 Campeón: <strong>25 pts</strong></span>
                   <span>👟 Bota de Oro: <strong>20 pts</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem', height: 'fit-content' }}>
          {entryFee > 0 ? (
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--color-green)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}>
                <span>💰 BOTE TOTAL</span>
                <span style={{ fontSize: '1.4rem' }}>{totalPot}€</span>
              </h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', alignItems: 'center', background: 'rgba(255, 215, 0, 0.1)', padding: '0.75rem', borderRadius: '8px', borderLeft: '3px solid gold' }}>
                  <span style={{ fontWeight: 800 }}>🥇 1º (60%)</span>
                  <strong style={{ color: 'gold', fontSize: '1.1rem' }}>{(totalPot * 0.60).toFixed(2)}€</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', alignItems: 'center', background: 'rgba(192, 192, 192, 0.1)', padding: '0.75rem', borderRadius: '8px', borderLeft: '3px solid silver' }}>
                  <span style={{ fontWeight: 800 }}>🥈 2º (30%)</span>
                  <strong style={{ color: 'silver', fontSize: '1rem' }}>{(totalPot * 0.30).toFixed(2)}€</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', alignItems: 'center', background: 'rgba(205, 127, 50, 0.1)', padding: '0.75rem', borderRadius: '8px', borderLeft: '3px solid #cd7f32' }}>
                  <span style={{ fontWeight: 800 }}>🥉 3º (10%)</span>
                  <strong style={{ color: '#cd7f32', fontSize: '1rem' }}>{(totalPot * 0.10).toFixed(2)}€</strong>
                </li>
              </ul>
              <div style={{ marginTop: '1.5rem', fontSize: '0.75rem', opacity: 0.6, textAlign: 'center', fontStyle: 'italic' }}>
                * El bote se calcula según los usuarios que han confirmado el pago.
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎮</div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800 }}>PORRA AMISTOSA</h3>
              <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>Esta porra no tiene bote económico. ¡Se juega por el honor!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
