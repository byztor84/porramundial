'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Standing {
  user_id: string;
  total_points: number;
  match_points: number;
  bracket_points: number;
  exact_hits: number;
  has_paid?: boolean;
  profiles: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export default function RankingPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = use(params);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [poolName, setPoolName] = useState('');
  const [poolLogo, setPoolLogo] = useState<string | null>(null);
  const [entryFee, setEntryFee] = useState(0);
  const [view, setView] = useState<'all' | 'premium'>('all');

  useEffect(() => {
    const fetchRanking = async () => {
      const supabase = createClient();
      
      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUser(user.id);

      // Obtener ranking ordenado con datos del perfil
      const { data, error } = await supabase
        .from('standings')
        .select(`
          user_id,
          total_points,
          match_points,
          bracket_points,
          exact_hits,
          profiles (
            first_name,
            last_name,
            email
          )
        `)
        .eq('pool_id', poolId)
        .order('total_points', { ascending: false })
        .order('exact_hits', { ascending: false });

      const { data: members } = await supabase
        .from('pool_members')
        .select('user_id, has_paid')
        .eq('pool_id', poolId);

      if (data) {
        const standingsWithPayment = data
          .filter((s: any) => members?.some(m => m.user_id === s.user_id))
          .map((s: any) => {
            const member = members?.find(m => m.user_id === s.user_id);
            return { ...s, has_paid: member ? member.has_paid : false };
          });
        setStandings(standingsWithPayment);
      }
      const { data: poolData } = await supabase
        .from('pools')
        .select('name, logo_url, entry_fee')
        .eq('id', poolId)
        .single();

      if (poolData) {
        setPoolName(poolData.name);
        setPoolLogo(poolData.logo_url);
        setEntryFee(poolData.entry_fee || 0);
      }
      
      setLoading(false);
    };

    fetchRanking();
  }, []);

  const [showRules, setShowRules] = useState(false);

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" style={{ width: 50, height: 50 }}></div>
      </div>
    );
  }

  const filteredStandings = view === 'all' 
    ? standings 
    : standings.filter(s => s.has_paid);

  const paidCount = standings.filter(s => s.has_paid).length;
  const totalPot = paidCount * entryFee;

  const top3 = filteredStandings.slice(0, 3);
  const rest = filteredStandings.slice(3);

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 8rem' }}>
      <div className="dashboard-header animate-fadeIn" style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
          {poolLogo && (
            <img src={poolLogo} alt="Logo" style={{ height: 40, borderRadius: 4 }} />
          )}
          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--color-orange)' }}>
            LA PORRA DEL MUNDIAL: <span style={{ color: '#fff' }}>{poolName || 'GINSO'}</span>
          </h1>
        </div>
        <p className="text-muted">¿Quién será el experto que se lleve la victoria?</p>
        
        <button 
          onClick={() => setShowRules(!showRules)}
          className="btn btn-secondary btn-sm"
          style={{ marginTop: '1.5rem', borderRadius: '50px', padding: '0.5rem 1.5rem' }}
        >
          {showRules ? '🔼 Ocultar Reglas' : '📜 Ver Reglas de Puntuación'}
        </button>

          {showRules && (
        <div className="glass-card animate-fadeIn" style={{ marginTop: '2rem', marginBottom: '3rem', padding: '2rem', background: 'rgba(242,140,56,0.05)', border: '1px solid rgba(242,140,56,0.2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2.5rem' }}>
            {/* Partidos */}
            <div>
              <h4 style={{ color: 'var(--color-orange)', marginBottom: '1.2rem', fontSize: '0.9rem', fontWeight: 800, borderBottom: '1px solid rgba(242,140,56,0.3)', paddingBottom: '0.5rem' }}>⚽ PUNTOS POR PARTIDO</h4>
              <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tendencia (1X2)</span> <strong>+3 pts</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Diferencia de Goles</span> <strong>+6 pts</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Resultado Exacto</span> <strong>+12 pts</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', background: 'rgba(242,140,56,0.1)', padding: '0.4rem 0.6rem', borderRadius: '6px', color: 'var(--color-orange)', fontWeight: 800 }}>
                   <span>TOTAL MÁXIMO</span> <span>21 pts</span>
                </li>
                <li style={{ fontSize: '0.75rem', opacity: 0.6, fontStyle: 'italic', marginTop: '0.3rem' }}>* Los Bonus multiplican el total x2 o x3</li>
              </ul>
            </div>

            {/* Posiciones Grupo */}
            <div>
              <h4 style={{ color: 'var(--color-orange)', marginBottom: '1.2rem', fontSize: '0.9rem', fontWeight: 800, borderBottom: '1px solid rgba(242,140,56,0.3)', paddingBottom: '0.5rem' }}>🧠 POSICIÓN EN GRUPO</h4>
              <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Acertar 1º</span> <strong>5 pts</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Acertar 2º</span> <strong>3 pts</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Acertar 3º</span> <strong>1 pt</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Acertar 4º</span> <strong>1 pt</strong></li>
                <li style={{ fontSize: '0.75rem', opacity: 0.6, fontStyle: 'italic', marginTop: '0.5rem' }}>* Se premia la posición exacta en la tabla final del grupo.</li>
              </ul>
            </div>

            {/* Progresión */}
            <div>
              <h4 style={{ color: 'var(--color-orange)', marginBottom: '1.2rem', fontSize: '0.9rem', fontWeight: 800, borderBottom: '1px solid rgba(242,140,56,0.3)', paddingBottom: '0.5rem' }}>🏆 PROGRESIÓN Y HONOR</h4>
              <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Equipo en Dieciseisavos</span> <strong>3 pts</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Equipo en Octavos</span> <strong>6 pts</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Acertar Campeón</span> <strong>25 pts</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Acertar Bota de Oro</span> <strong>20 pts</strong></li>
                <li style={{ fontSize: '0.75rem', opacity: 0.6, fontStyle: 'italic', marginTop: '0.5rem' }}>* En eliminatorias cuenta el resultado tras 120' (sin penaltis).</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Selector de Clasificación (General vs Premios) */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2.5rem', marginTop: '1rem' }}>
        <button 
          onClick={() => setView('all')}
          className={`btn ${view === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ borderRadius: '50px', padding: '0.6rem 2rem', fontWeight: 800, minWidth: '160px' }}
        >
          🌎 GENERAL
        </button>
        <button 
          onClick={() => setView('premium')}
          className={`btn ${view === 'premium' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ 
            borderRadius: '50px', 
            padding: '0.6rem 2rem', 
            fontWeight: 800, 
            minWidth: '160px',
            border: view === 'premium' ? 'none' : '1px solid rgba(16, 185, 129, 0.5)',
            color: view === 'premium' ? '#fff' : 'var(--color-green)'
          }}
        >
          💰 SOLO PREMIOS
        </button>
      </div>

      {/* Podium Section */}
      {top3.length > 0 && (
        <div className="podium animate-slideUp">
          {/* Segundo Puesto */}
          {top3[1] && (
            <div className="podium-item silver">
              <div className="podium-medal">🥈</div>
               <div className="podium-name">{top3[1].profiles.first_name || top3[1].profiles.email.split('@')[0]}</div>
               <div className="podium-points">{top3[1].total_points} PTS</div>
               {view === 'premium' && entryFee > 0 && (
                 <div style={{ color: 'var(--color-green)', fontWeight: 800, fontSize: '1rem', margin: '0.5rem 0' }}>
                   💰 {(totalPot * 0.30).toFixed(2)}€
                 </div>
               )}
               <div style={{ fontSize: '0.65rem', opacity: 0.8, color: 'var(--color-orange)' }}>
                 ⚽ {top3[1].match_points} ptos. / 🧠 {top3[1].bracket_points} clasif.
               </div>
               <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '0.25rem' }}>{top3[1].exact_hits} Plenos</div>
            </div>
          )}

          {/* Primer Puesto */}
          {top3[0] && (
            <div className="podium-item gold">
              <div className="podium-medal" style={{ marginBottom: '1.5rem' }}>
                <img 
                  src="/trophy_nobg.png" 
                  alt="Gold Trophy" 
                  style={{ height: '160px', width: 'auto', filter: 'drop-shadow(0 0 30px rgba(242,140,56,0.5))' }} 
                />
              </div>
               <div className="podium-name" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{top3[0].profiles.first_name || top3[0].profiles.email.split('@')[0]}</div>
               <div className="podium-points" style={{ fontSize: '2.5rem', color: 'var(--color-orange)' }}>{top3[0].total_points} PTS</div>
               {view === 'premium' && entryFee > 0 && (
                 <div style={{ color: 'var(--color-green)', fontWeight: 900, fontSize: '1.8rem', margin: '1rem 0', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--color-green)' }}>
                   💰 {(totalPot * 0.60).toFixed(2)}€
                 </div>
               )}
               <div style={{ fontSize: '0.8rem', opacity: 0.9, color: 'var(--color-orange)', marginBottom: '0.5rem' }}>
                 ⚽ Partidos: {top3[0].match_points} / 🧠 Clasificados: {top3[0].bracket_points}
               </div>
               <div style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 600 }}>{top3[0].exact_hits} Plenos</div>
              <div className="badge badge-bonus" style={{ marginTop: '1rem' }}>LÍDER</div>
            </div>
          )}

          {/* Tercer Puesto */}
          {top3[2] && (
            <div className="podium-item bronze">
              <div className="podium-medal">🥉</div>
               <div className="podium-name">{top3[2].profiles.first_name || top3[2].profiles.email.split('@')[0]}</div>
               <div className="podium-points">{top3[2].total_points} PTS</div>
               {view === 'premium' && entryFee > 0 && (
                 <div style={{ color: 'var(--color-green)', fontWeight: 800, fontSize: '0.9rem', margin: '0.5rem 0' }}>
                   💰 {(totalPot * 0.10).toFixed(2)}€
                 </div>
               )}
               <div style={{ fontSize: '0.65rem', opacity: 0.8, color: 'var(--color-orange)' }}>
                 ⚽ {top3[2].match_points} / 🧠 {top3[2].bracket_points}
               </div>
               <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem' }}>{top3[2].exact_hits} Plenos</div>
            </div>
          )}
        </div>
      )}

      {/* Tables List */}
      <div className="glass-card animate-fadeIn" style={{ marginTop: '3rem', padding: '0' }}>
        <table className="ranking-table">
          <thead>
            <tr>
               <th style={{ width: '80px', textAlign: 'center' }}>POS</th>
               <th>PARTICIPANTE</th>
               <th style={{ textAlign: 'center' }}>PARTIDOS</th>
               <th style={{ textAlign: 'center' }}>CLASIF.</th>
               <th style={{ textAlign: 'center' }}>PLENOS</th>
               <th style={{ textAlign: 'right', paddingRight: '2rem' }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {filteredStandings.map((s, index) => (
              <tr key={s.user_id} className={s.user_id === currentUser ? 'highlight' : ''}>
                <td style={{ textAlign: 'center' }}>
                  <div className="ranking-position" style={{ 
                    color: index === 0 ? 'var(--color-orange)' : 'inherit',
                    opacity: index < 3 ? 1 : 0.5
                  }}>
                    {index + 1}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="navbar-avatar" style={{ width: 32, height: 32, fontSize: '0.7rem' }}>
                      {(s.profiles.first_name || s.profiles.email)[0].toUpperCase()}
                    </div>
                    <Link 
                      href={`/pool/${poolId}/participantes/${s.user_id}`}
                      style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                      className="ranking-user-link"
                    >
                      <div style={{ fontWeight: 700, transition: 'color 0.2s' }}>
                        {s.profiles.first_name ? `${s.profiles.first_name} ${s.profiles.last_name}` : 'Usuario'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{s.profiles.email}</div>
                        {s.has_paid ? (
                          <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--color-green)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>💰 Opta a Premio</span>
                        ) : (
                          <span style={{ fontSize: '0.65rem', background: 'rgba(255, 255, 255, 0.1)', color: 'var(--color-text-muted)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>👀 Solo por diversión</span>
                        )}
                      </div>
                    </Link>
                    {s.user_id === currentUser && (
                      <span className="badge badge-success" style={{ fontSize: '0.6rem' }}>TÚ</span>
                    )}
                  </div>
                </td>
                 <td style={{ textAlign: 'center' }}>
                   <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>{s.match_points}</div>
                 </td>
                 <td style={{ textAlign: 'center' }}>
                   <div style={{ fontSize: '0.9rem', opacity: 0.7, color: 'var(--color-orange)', fontWeight: 600 }}>+{s.bracket_points}</div>
                 </td>
                 <td style={{ textAlign: 'center' }}>
                   <span style={{ fontWeight: 600, opacity: s.exact_hits > 0 ? 1 : 0.2 }}>
                     {s.exact_hits}
                   </span>
                 </td>
                 <td style={{ textAlign: 'right', paddingRight: '2rem' }}>
                   <div style={{ fontSize: '1.25rem', fontWeight: 900, color: index < 3 ? 'var(--color-orange)' : 'inherit' }}>
                     {s.total_points}
                   </div>
                 </td>
              </tr>
            ))}
          </tbody>
        </table>

        {standings.length === 0 && (
          <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏱️</div>
            <p>
              {view === 'premium' 
                ? 'No hay participantes con el pago confirmado que tengan puntos todavía.' 
                : 'Aún no hay puntos registrados en esta porra.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
