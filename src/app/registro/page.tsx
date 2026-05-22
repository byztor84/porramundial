'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      },
    });

    if (authError) {
      setError(authError.message === 'User already registered'
        ? 'Este correo ya está registrado. Inicia sesión.'
        : `Error al registrarse: ${authError.message}`);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="login-split-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="floating-bg" style={{ top: '10%', left: '10%' }}></div>
        <div className="auth-card premium-glass animate-fadeIn" style={{ textAlign: 'center', padding: '4rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🏆</div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', marginBottom: '1rem' }}>¡Registro completado!</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem', marginBottom: '2.5rem', maxWidth: '400px', margin: '0 auto 2.5rem' }}>
            Tu perfil ha sido creado con éxito. Ya puedes iniciar sesión y empezar a pronosticar.
          </p>
          <Link href="/login" className="btn btn-premium btn-sweep" style={{ padding: '1rem 3rem', borderRadius: '12px' }}>
            Iniciar Sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-split-container">
      <div className="floating-bg" style={{ top: '5%', left: '5%' }}></div>
      <div className="floating-bg" style={{ bottom: '5%', right: '5%', background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)' }}></div>

      <div className="login-visual-side" style={{ backgroundImage: 'linear-gradient(to left, rgba(2,4,8,0.2), rgba(2,4,8,0.9)), url("/stadium_final.png")' }}>
        <div className="login-visual-content animate-fadeIn" style={{ textAlign: 'right', maxWidth: '700px' }}>
          <h1 style={{ 
            fontSize: '4.5rem', 
            fontWeight: 900, 
            lineHeight: 0.85, 
            marginBottom: '1.5rem',
            letterSpacing: '-0.02em'
          }}>
            <span className="text-gold">SOLICITA</span><br/>
            <span style={{ color: '#fff' }}>TU ACCESO</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.2rem', fontWeight: 500, maxWidth: '500px', marginLeft: 'auto' }}>
            Únete a la competición exclusiva de porras para el Mundial 2026. Demuestra tu visión estratégica.
          </p>
        </div>
      </div>

      <div className="login-form-side">
        <div className="auth-card premium-glass animate-slideUp" style={{ padding: '3rem', maxWidth: '550px' }}>
          <div className="auth-logo" style={{ alignItems: 'flex-start', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', marginBottom: '0.5rem' }}>Registro de Jugador</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>Completa tus datos para crear tu perfil oficial.</p>
          </div>

          <form className="auth-form" onSubmit={handleRegister} style={{ gap: '1.2rem' }}>
            <div className="auth-name-grid">
              <div className="form-group">
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Nombre</label>
                <input type="text" className="input-premium" placeholder="Nombre"
                  value={firstName} onChange={(e) => setFirstName(e.target.value)} required style={{ paddingLeft: '1.2rem' }} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Apellidos</label>
                <input type="text" className="input-premium" placeholder="Apellidos"
                  value={lastName} onChange={(e) => setLastName(e.target.value)} required style={{ paddingLeft: '1.2rem' }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Correo electrónico</label>
              <input type="email" className="input-premium" placeholder="ejemplo@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required style={{ paddingLeft: '1.2rem' }} />
            </div>

            <div className="auth-name-grid">
              <div className="form-group">
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Contraseña</label>
                <input type="password" className="input-premium" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={{ paddingLeft: '1.2rem' }} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Confirmar</label>
                <input type="password" className="input-premium" placeholder="••••••••"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={{ paddingLeft: '1.2rem' }} />
              </div>
            </div>

            {error && (
              <div className="animate-fadeIn" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                <p style={{ margin: 0, color: '#ef4444', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>
              </div>
            )}

            <button type="submit" className="btn btn-premium btn-sweep" disabled={loading} style={{ width: '100%', height: '3.5rem', borderRadius: '12px', marginTop: '0.5rem' }}>
              {loading ? <span className="spinner" style={{ width: 20, height: 20 }}></span> : 'Crear Perfil Elite'}
            </button>
          </form>

          <div className="auth-footer" style={{ marginTop: '2rem', textAlign: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>¿Ya formas parte de la competición? </span>
            <Link href="/login" style={{ color: 'var(--color-gold)', fontWeight: 700, textDecoration: 'none' }}>
              Inicia Sesión →
            </Link>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .login-split-container { background: #020408; min-height: 100vh; display: flex; position: relative; overflow: hidden; }
        .login-visual-side { flex: 0.8; display: flex; align-items: center; justify-content: center; padding: 4rem; background-size: cover; background-position: center; }
        .login-form-side { flex: 1.2; display: flex; align-items: center; justify-content: center; padding: 2rem; background: rgba(6, 9, 16, 0.4); backdrop-filter: blur(40px); border-left: 1px solid rgba(255,255,255,0.05); z-index: 10; }
        @media (max-width: 991px) { .login-visual-side { display: none; } .login-form-side { background: transparent; border-left: none; } }
      `}</style>
    </div>
  );
}
