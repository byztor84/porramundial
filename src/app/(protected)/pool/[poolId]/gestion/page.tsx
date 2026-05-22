'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function PoolManagementPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = use(params);
  const router = useRouter();
  const [pool, setPool] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [poolLogo, setPoolLogo] = useState<string | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchData();
  }, [poolId]);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Check if user is admin of this pool
    const { data: memberData } = await supabase
      .from('pool_members')
      .select('role')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .single();

    if (!memberData || memberData.role !== 'admin') {
      router.push(`/pool/${poolId}`); // redirect non-admins to pool dashboard
      return;
    }

    // Fetch pool details
    const { data: poolData } = await supabase
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .single();

    if (poolData) {
      setPool(poolData);
      setPoolLogo(poolData.logo_url);
    }

    // Fetch members
    const { data: membersData } = await supabase
      .from('pool_members')
      .select(`
        user_id,
        role,
        has_paid,
        joined_at,
        profiles (
          first_name,
          last_name,
          email
        )
      `)
      .eq('pool_id', poolId)
      .order('joined_at', { ascending: true });

    if (membersData) setMembers(membersData);
    
    setLoading(false);
  };

  const copyToClipboard = () => {
    if (!pool) return;
    navigator.clipboard.writeText(pool.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const togglePaymentStatus = async (userId: string, currentStatus: boolean) => {
    const supabase = createClient();
    const newStatus = !currentStatus;
    
    // Optimistic update
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, has_paid: newStatus } : m));

    const { error } = await supabase
      .from('pool_members')
      .update({ has_paid: newStatus })
      .eq('pool_id', poolId)
      .eq('user_id', userId);

    if (error) {
      // Revert if error
      setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, has_paid: currentStatus } : m));
      setError('Error al actualizar el pago.');
    }
  };

  const removeMember = async (userId: string) => {
    if (!confirm('¿Estás seguro de que deseas expulsar a este jugador de la porra? Perderá todas sus predicciones para esta porra.')) return;
    
    const supabase = createClient();
    
    // Eliminar
    setMembers(prev => prev.filter(m => m.user_id !== userId));

    const { error } = await supabase
      .from('pool_members')
      .delete()
      .eq('pool_id', poolId)
      .eq('user_id', userId);

    if (error) {
      fetchData(); // Reload to revert
      setError('Error al expulsar al jugador.');
    }
  };

  const updateLogo = async (url: string) => {
    setSavingLogo(true);
    setError('');
    setSuccess('');
    const supabase = createClient();
    
    const { error } = await supabase
      .from('pools')
      .update({ logo_url: url })
      .eq('id', poolId);

    if (error) {
      setError('Error al actualizar el logo: ' + error.message);
    } else {
      setPool({ ...pool, logo_url: url });
      setSuccess('¡Logo actualizado correctamente!');
      setTimeout(() => setSuccess(''), 3000);
    }
    setSavingLogo(false);
  };

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div className="animate-fadeIn" style={{ paddingBottom: '5rem', maxWidth: '1000px', margin: '0 auto' }}>
      
      {/* Navegación dentro de la porra */}
      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
        <Link href={`/pool/${poolId}`} className="navbar-link">🏠 Dashboard de la Porra</Link>
        <Link href={`/pool/${poolId}/gestion`} className="navbar-link active">⚙️ Gestión de la Porra</Link>
      </div>

      <div className="dashboard-header animate-slideUp">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          {poolLogo && (
            <img src={poolLogo} alt="Logo" style={{ height: 40, borderRadius: 4 }} />
          )}
          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--color-orange)' }}>
            LA PORRA DEL MUNDIAL: <span style={{ color: '#fff' }}>{pool?.name}</span>
          </h1>
        </div>
        <p className="text-muted" style={{ fontSize: '1.1rem' }}>
          Administra a los participantes y los pagos.
        </p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', padding: '1rem', marginBottom: '2rem', borderRadius: '4px' }}>
          <p style={{ margin: 0, color: '#ef4444', fontWeight: 600 }}>❌ {error}</p>
        </div>
      )}

      {success && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderLeft: '4px solid #10b981', padding: '1rem', marginBottom: '2rem', borderRadius: '4px' }}>
          <p style={{ margin: 0, color: '#10b981', fontWeight: 600 }}>✅ {success}</p>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Logo de la Porra */}
        <div className="glass-card stat-card" style={{ borderBottom: '4px solid var(--color-gold)', gridColumn: 'span 1' }}>
          <div className="stat-label" style={{ marginBottom: '1rem' }}>Logo Personalizado</div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {pool?.logo_url ? (
              <img src={pool.logo_url} alt="Logo actual" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 60, height: 60, borderRadius: 8, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🖼️</div>
            )}
            <div style={{ flex: 1 }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="URL de la imagen (PNG/JPG)"
                defaultValue={pool?.logo_url || ''}
                onBlur={(e) => updateLogo(e.target.value)}
                style={{ fontSize: '0.8rem' }}
              />
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.8rem' }}>
            Pega el enlace de una imagen para personalizar tu porra.
          </p>
        </div>

        {/* Código de Invitación */}
        <div className="glass-card stat-card" style={{ borderBottom: '4px solid var(--color-orange)', gridColumn: 'span 1' }}>
          <div className="stat-label" style={{ marginBottom: '1rem' }}>Código de Invitación</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              background: 'rgba(0,0,0,0.4)', 
              padding: '0.75rem', 
              borderRadius: '8px', 
              fontFamily: 'monospace', 
              fontSize: '1.2rem', 
              letterSpacing: '0.1em',
              fontWeight: 800,
              flex: 1,
              textAlign: 'center'
            }}>
              {pool?.invite_code}
            </div>
            <button onClick={copyToClipboard} className="btn btn-primary" style={{ padding: '0.75rem' }}>
              {copied ? '✅' : '📋'}
            </button>
          </div>
          <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '1rem' }}>
            Comparte este código para que otros se unan.
          </p>
        </div>

        {/* Resumen Financiero */}
        <div className="glass-card stat-card" style={{ borderBottom: '4px solid var(--color-green)', gridColumn: 'span 1' }}>
          <div className="stat-label">Bote Acumulado</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '0.5rem' }}>
            <div>
              <div className="stat-value green">
                {members.filter(m => m.has_paid).length * (pool?.entry_fee || 0)}€
              </div>
              <div className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Cuota: {pool?.entry_fee}€ por persona
              </div>
            </div>
            <div style={{ fontSize: '3rem', opacity: 0.8 }}>💰</div>
          </div>
          <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
            <strong>{members.filter(m => m.has_paid).length}</strong> han pagado de <strong>{members.length}</strong> participantes
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ marginTop: '2rem', overflow: 'hidden' }}>
        <h3 style={{ padding: '1.5rem', margin: 0, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
          Participantes ({members.length})
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="ranking-table" style={{ minWidth: '600px' }}>
            <thead>
              <tr>
                <th>Jugador</th>
                <th>Rol</th>
                <th>Estado de Pago</th>
                {pool?.entry_fee > 0 && <th style={{ textAlign: 'center' }}>Marcar Pago</th>}
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.user_id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                        {(member.profiles.first_name || member.profiles.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#fff' }}>
                          {member.profiles.first_name ? `${member.profiles.first_name} ${member.profiles.last_name}` : 'Usuario'}
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{member.profiles.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {member.role === 'admin' ? (
                      <span className="badge badge-bonus">Admin</span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>Jugador</span>
                    )}
                  </td>
                  <td>
                    {pool?.entry_fee > 0 ? (
                      member.has_paid ? (
                        <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>✅ Pagado</span>
                      ) : (
                        <span style={{ color: 'var(--color-red)', fontWeight: 600 }}>⚠️ Debe {pool?.entry_fee}€</span>
                      )
                    ) : (
                      <span className="text-muted">Gratis</span>
                    )}
                  </td>
                  
                  {pool?.entry_fee > 0 && (
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => togglePaymentStatus(member.user_id, member.has_paid)}
                        className={`btn btn-sm ${member.has_paid ? 'btn-secondary' : 'btn-primary'}`}
                        style={{ padding: '0.4rem 0.8rem' }}
                      >
                        {member.has_paid ? 'Marcar Impago' : 'Cobrar'}
                      </button>
                    </td>
                  )}
                  
                  <td style={{ textAlign: 'right' }}>
                    {member.role !== 'admin' && (
                      <button 
                        onClick={() => removeMember(member.user_id)}
                        className="btn btn-sm btn-danger"
                      >
                        Expulsar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
