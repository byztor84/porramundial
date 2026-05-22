'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function DashboardHubPage() {
  const router = useRouter();
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  
  // Forms
  const [newPoolName, setNewPoolName] = useState('');
  const [newPoolFee, setNewPoolFee] = useState('0');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPools = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Usamos inner join en pools para traernos toda la info de la porra
      const { data, error } = await supabase
        .from('pool_members')
        .select(`
          role,
          has_paid,
          pools (
            id,
            name,
            entry_fee,
            creator_id
          )
        `)
        .eq('user_id', user.id);
        
      if (data) {
        setPools(data);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPools();
  }, []);

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    try {
      // Generar código de invitación aleatorio (ej: A7F9X2)
      const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // 1. Crear el pool
      const { data: poolData, error: poolError } = await supabase
        .from('pools')
        .insert({
          name: newPoolName,
          entry_fee: parseFloat(newPoolFee) || 0,
          creator_id: user.id,
          invite_code: randomCode
        })
        .select()
        .single();

      if (poolError) throw poolError;

      // 2. Unirse automáticamente como admin
      const { error: memberError } = await supabase
        .from('pool_members')
        .insert({
          pool_id: poolData.id,
          user_id: user.id,
          role: 'admin',
          has_paid: true // Admin automatically considered paid or doesn't matter
        });

      if (memberError) throw memberError;

      // 3. Ir a la porra
      router.push(`/pool/${poolData.id}`);
      
    } catch (err: any) {
      setError(err.message || 'Error al crear la porra');
      setSubmitting(false);
    }
  };

  const handleJoinPool = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    
    const supabase = createClient();
    
    try {
      const { data, error } = await supabase.rpc('join_pool', {
        invite_code_input: joinCode.trim()
      });
      
      if (error) throw error;
      
      if (data) {
        router.push(`/pool/${data}`);
      }
    } catch (err: any) {
      setError(err.message || 'Código inválido o error al unirse');
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div className="animate-fadeIn" style={{ paddingBottom: '5rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="dashboard-header animate-slideUp">
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900 }}>
          Mis Porras 🏆
        </h1>
        <p className="text-muted" style={{ fontSize: '1.1rem' }}>
          Únete a ligas de tus amigos o crea la tuya propia para empezar a competir.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '3rem' }}>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
          ➕ Crear Porra
        </button>
        <button onClick={() => setShowJoin(true)} className="btn btn-secondary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
          🔗 Unirse con Código
        </button>
      </div>

      {pools.length === 0 ? (
        <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.5 }}>🤷‍♂️</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>No estás en ninguna porra todavía</h2>
          <p className="text-muted">Crea una nueva liga o pide un código de invitación a tus amigos.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {pools.map((item: any) => {
            const pool = item.pools;
            return (
              <Link href={`/pool/${pool.id}`} key={pool.id} style={{ textDecoration: 'none' }}>
                <div className="glass-card stat-card" style={{ transition: 'all 0.3s ease', cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                      {pool.name}
                    </h3>
                    {item.role === 'admin' && (
                      <span className="badge badge-bonus">Admin</span>
                    )}
                  </div>
                  
                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cuota</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-orange)' }}>
                        {pool.entry_fee > 0 ? `${pool.entry_fee}€` : 'GRATIS'}
                      </div>
                    </div>
                    
                    {pool.entry_fee > 0 && (
                      <div>
                        {item.has_paid ? (
                          <span style={{ color: 'var(--color-green)', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            ✅ Pagado
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-red)', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            ⚠️ Pendiente
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Modal Crear Porra */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Crear Nueva Porra</h2>
            <form onSubmit={handleCreatePool}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Nombre de la liga</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: Porra de la Oficina" 
                  value={newPoolName}
                  onChange={e => setNewPoolName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Cuota de entrada (€) - Opcional</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="0 para gratis" 
                  min="0"
                  step="0.01"
                  value={newPoolFee}
                  onChange={e => setNewPoolFee(e.target.value)}
                />
              </div>
              {error && <p className="form-error">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creando...' : 'Crear Porra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Unirse a Porra */}
      {showJoin && (
        <div className="modal-overlay" onClick={() => setShowJoin(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Unirse a una Porra</h2>
            <form onSubmit={handleJoinPool}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Código de Invitación</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Introduce el código aquí" 
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  required
                />
              </div>
              {error && <p className="form-error">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowJoin(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Verificando...' : 'Unirse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
