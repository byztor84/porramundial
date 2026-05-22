'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { getFlagUrl } from '@/lib/utils/flags';

interface Participant {
  user_id: string;
  has_paid: boolean;
  prediction_locked: boolean;
  profiles: {
    first_name: string;
    last_name: string;
    email: string;
  };
  standings?: {
    total_points: number;
    exact_hits: number;
  };
}

export default function ParticipantesPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = use(params);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [poolName, setPoolName] = useState('');
  const [poolLogo, setPoolLogo] = useState<string | null>(null);

  useEffect(() => {
    const fetchParticipants = async () => {
      const supabase = createClient();
      
      const { data: members, error } = await supabase
        .from('pool_members')
        .select(`
          user_id,
          has_paid,
          prediction_locked,
          profiles (
            first_name,
            last_name,
            email
          )
        `)
        .eq('pool_id', poolId);

      const { data: standings } = await supabase
        .from('standings')
        .select('user_id, total_points, exact_hits')
        .eq('pool_id', poolId);

      const { data: poolData } = await supabase
        .from('pools')
        .select('name, logo_url')
        .eq('id', poolId)
        .single();

      if (members) {
        const enrichedParticipants = members.map((m: any) => {
          const s = standings?.find(st => st.user_id === m.user_id);
          return { ...m, standings: s };
        }).sort((a, b) => (b.standings?.total_points || 0) - (a.standings?.total_points || 0));
        
        setParticipants(enrichedParticipants);
      }
      
      if (poolData) {
        setPoolName(poolData.name);
        setPoolLogo(poolData.logo_url);
      }
      
      setLoading(false);
    };

    fetchParticipants();
  }, [poolId]);

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 8rem' }}>
      <div className="dashboard-header animate-fadeIn" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '3rem' }}>
        {poolLogo && (
          <img src={poolLogo} alt="Logo" style={{ height: 60, borderRadius: 8 }} />
        )}
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--color-orange)' }}>
            PARTICIPANTES: <span style={{ color: '#fff' }}>{poolName}</span>
          </h1>
          <p className="text-muted">Haz clic en un jugador para ver su estrategia y pronósticos.</p>
        </div>
        <Link href={`/pool/${poolId}`} className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>
          Volver al Dashboard
        </Link>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {participants.map((p) => (
          <Link 
            key={p.user_id} 
            href={`/pool/${poolId}/participantes/${p.user_id}`}
            className="glass-card" 
            style={{ 
              padding: '1.5rem', 
              textDecoration: 'none', 
              color: 'inherit',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              borderLeft: p.prediction_locked ? '4px solid var(--color-orange)' : '4px solid var(--color-border)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="navbar-avatar" style={{ width: 48, height: 48, fontSize: '1rem' }}>
                {(p.profiles.first_name || p.profiles.email)[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                  {p.profiles.first_name ? `${p.profiles.first_name} ${p.profiles.last_name}` : 'Usuario'}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{p.profiles.email}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>Puntos</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-orange)' }}>{p.standings?.total_points || 0}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>Estado</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  {p.prediction_locked ? '🔒 Confirmada' : '✏️ Pendiente'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {p.has_paid && (
                <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>💰 PAGO CONFIRMADO</span>
              )}
              {p.prediction_locked && (
                <span className="badge badge-bonus" style={{ fontSize: '0.65rem' }}>👀 VER PRONÓSTICOS</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {participants.length === 0 && (
        <div style={{ textAlign: 'center', padding: '5rem', opacity: 0.5 }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🏜️</div>
          <h3>Aún no hay participantes en esta porra.</h3>
        </div>
      )}
    </div>
  );
}
