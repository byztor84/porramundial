'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types/database';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const fetchProfile = async () => {
      try {
        console.log('ProtectedLayout: checking user session...');
        const { data: { user } } = await Promise.race([
          supabase.auth.getUser(),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
        ]);
        
        if (!user) {
          console.warn('ProtectedLayout: no user session found, redirecting to /login');
          router.replace('/login');
          return;
        }

        console.log('ProtectedLayout: session verified for user:', user.email);

        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data) setProfile(data as Profile);
      } catch (e) {
        console.error('ProtectedLayout: session check failed or timed out:', e);
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    );
  }

  const navLinks = [
    { href: '/dashboard', label: 'Mis Porras', icon: '⚽' }
  ];

  const isAdmin = profile?.role === 'admin';

  const poolId = pathname.includes('/pool/') ? pathname.split('/')[2] : null;

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-orange)', letterSpacing: '-0.02em', cursor: 'pointer' }}>
              🏆 LA PORRA DEL MUNDIAL 2026
            </span>
          </Link>
        </div>

        <div className="navbar-links">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`navbar-link ${pathname === link.href ? 'active' : ''}`}
            >
              <span style={{ marginRight: '0.25rem' }}>{link.icon}</span>
              {link.label}
            </Link>
          ))}

          {/* Botón dinámico VOLVER AL INICIO (Dashboard de la Porra) */}
          {pathname.includes('/pool/') && (
            <Link
              href={`/pool/${pathname.split('/')[2]}`}
              className="navbar-link"
              style={{ background: 'rgba(242,140,56,0.1)', color: 'var(--color-orange)', borderRadius: '4px', padding: '0.4rem 0.8rem', fontWeight: 800 }}
            >
              🏠 INICIO PORRA
            </Link>
          )}

          {isAdmin && (
            <Link
              href="/admin"
              className={`navbar-link ${pathname.startsWith('/admin') ? 'active' : ''}`}
            >
              <span style={{ marginRight: '0.25rem' }}>⚙️</span>
              Admin
            </Link>
          )}
        </div>

        <div className="navbar-user">
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            {profile?.first_name} {profile?.last_name}
          </span>
          <div className="navbar-avatar">
            {profile?.first_name?.[0]}{profile?.last_name?.[0]}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            Salir
          </button>
        </div>
      </nav>

      <main className="container main-content-container">
        {children}
      </main>

      {/* Tab Bar inferior exclusivo para móvil */}
      <div className="mobile-tab-bar">
        {poolId ? (
          <>
            <Link href={`/pool/${poolId}`} className={`mobile-tab-item ${pathname === `/pool/${poolId}` ? 'active' : ''}`}>
              <span className="mobile-tab-icon">🏠</span>
              <span className="mobile-tab-label">Inicio</span>
            </Link>
            <Link href={`/pool/${poolId}/predicciones`} className={`mobile-tab-item ${pathname.includes('/predicciones') ? 'active' : ''}`}>
              <span className="mobile-tab-icon">✏️</span>
              <span className="mobile-tab-label">Pronósticos</span>
            </Link>
            <Link href={`/pool/${poolId}/ranking`} className={`mobile-tab-item ${pathname.includes('/ranking') ? 'active' : ''}`}>
              <span className="mobile-tab-icon">🏆</span>
              <span className="mobile-tab-label">Ranking</span>
            </Link>
            <Link href="/dashboard" className="mobile-tab-item">
              <span className="mobile-tab-icon">⚽</span>
              <span className="mobile-tab-label">Porras</span>
            </Link>
            {isAdmin && (
              <Link href="/admin" className={`mobile-tab-item ${pathname.startsWith('/admin') ? 'active' : ''}`}>
                <span className="mobile-tab-icon">⚙️</span>
                <span className="mobile-tab-label">Admin</span>
              </Link>
            )}
          </>
        ) : (
          <>
            <Link href="/dashboard" className={`mobile-tab-item ${pathname === '/dashboard' ? 'active' : ''}`}>
              <span className="mobile-tab-icon">⚽</span>
              <span className="mobile-tab-label">Mis Porras</span>
            </Link>
            {isAdmin && (
              <Link href="/admin" className={`mobile-tab-item ${pathname.startsWith('/admin') ? 'active' : ''}`}>
                <span className="mobile-tab-icon">⚙️</span>
                <span className="mobile-tab-label">Admin</span>
              </Link>
            )}
            <button onClick={handleLogout} className="mobile-tab-item" style={{ background: 'none', border: 'none', color: 'inherit', padding: 0 }}>
              <span className="mobile-tab-icon">🚪</span>
              <span className="mobile-tab-label">Salir</span>
            </button>
          </>
        )}
      </div>
    </>
  );
}
