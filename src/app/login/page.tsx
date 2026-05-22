'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError('Credenciales incorrectas. Comprueba tu email y contraseña.');
        setLoading(false);
        return;
      }

      window.location.href = '/dashboard';
    } catch (err: any) {
      setError('Error de conexión. Inténtalo de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="login-split-container">
      {/* Elementos de fondo decorativos */}
      <div className="floating-bg" style={{ top: '10%', left: '10%' }}></div>
      <div className="floating-bg" style={{ bottom: '10%', right: '10%', animationDelay: '-5s', background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)' }}></div>

      {/* Lado Visual - Desktop Immersivo */}
      <div className="login-visual-side" style={{ backgroundImage: 'linear-gradient(to right, rgba(2,4,8,0.2), rgba(2,4,8,0.9)), url("/stadium_final.png")' }}>
        <div className="login-visual-content animate-fadeIn" style={{ textAlign: 'left', maxWidth: '700px' }}>
          <div style={{ position: 'relative', marginBottom: '2rem' }}>
            <img 
              src="/trophy_premium.png" 
              alt="World Cup Trophy" 
              style={{ 
                height: '500px', 
                width: 'auto', 
                filter: 'drop-shadow(0 0 50px rgba(212,175,55,0.3))',
                maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)'
              }} 
            />
          </div>
          
          <h1 style={{ 
            fontSize: '5rem', 
            fontWeight: 900, 
            lineHeight: 0.85, 
            marginBottom: '1.5rem',
            letterSpacing: '-0.02em'
          }}>
            <span className="text-gold">MUNDIAL</span><br/>
            <span style={{ color: '#fff' }}>2026</span>
          </h1>
          
          <p style={{ 
            fontSize: '1.5rem', 
            color: 'rgba(255,255,255,0.8)', 
            lineHeight: '1.4',
            marginTop: '2rem',
            fontWeight: 500,
            maxWidth: '500px'
          }}>
            Crea tu porra con más gente y disfruta de la emoción del Mundial
          </p>
        </div>
      </div>

      {/* Lado del Formulario */}
      <div className="login-form-side">
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '520px', gap: '1.5rem', margin: '2rem 0' }}>
          
          <div className="auth-card premium-glass animate-slideUp" style={{ padding: '3.5rem' }}>
            
            {/* Header del Formulario */}
            <div className="auth-logo" style={{ alignItems: 'flex-start', marginBottom: '2.5rem' }}>
              <div style={{ 
                background: 'var(--gradient-gold)', 
                width: '40px', 
                height: '4px', 
                borderRadius: '2px',
                marginBottom: '1rem'
              }}></div>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff', marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>
                Iniciar Sesión
              </h2>
              <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                Accede a la plataforma para gestionar tus porras.
              </p>
            </div>

            <form className="auth-form" onSubmit={handleLogin} style={{ gap: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.9rem' }}>Correo electrónico</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.6, fontSize: '1.2rem' }}>✉️</span>
                  <input
                    type="email"
                    className="input-premium"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.9rem' }}>Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.6, fontSize: '1.2rem' }}>🔒</span>
                  <input
                    type="password"
                    className="input-premium"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {error && (
                <div className="animate-fadeIn" style={{ 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid rgba(239, 68, 68, 0.2)', 
                  padding: '1rem', 
                  borderRadius: '12px',
                  marginTop: '0.5rem'
                }}>
                  <p style={{ margin: 0, color: '#ef4444', fontWeight: 600, fontSize: '0.9rem', textAlign: 'center' }}>{error}</p>
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-premium btn-sweep" 
                disabled={loading} 
                style={{ 
                  width: '100%', 
                  marginTop: '1rem',
                  height: '4rem',
                  fontSize: '1.1rem',
                  borderRadius: '12px'
                }}
              >
                {loading ? <span className="spinner" style={{ width: 24, height: 24 }}></span> : 'Entrar ahora'}
              </button>
            </form>

            <div className="auth-footer" style={{ marginTop: '2.5rem', textAlign: 'left' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
                ¿Aún no tienes acceso? <br/>
                <Link href="/registro" style={{ color: 'var(--color-gold)', fontWeight: 700, textDecoration: 'none', fontSize: '1rem' }}>
                  Contacta con el administrador →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .login-split-container {
          background: #020408;
          min-height: 100vh;
          display: flex;
          position: relative;
          overflow-y: auto;
        }
        .login-visual-side {
          flex: 1.2;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4rem;
          background-size: cover;
          background-position: center;
        }
        .login-form-side {
          flex: 1;
          display: flex;
          position: relative;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: rgba(6, 9, 16, 0.6);
          backdrop-filter: blur(40px);
          border-left: 1px solid rgba(255,255,255,0.05);
          z-index: 10;
        }
        @media (max-width: 991px) {
          .login-split-container {
            overflow-y: auto;
          }
          .login-visual-side { display: none; }
          .login-form-side { 
            background: transparent; 
            border-left: none;
            padding: 1.5rem 1rem;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
