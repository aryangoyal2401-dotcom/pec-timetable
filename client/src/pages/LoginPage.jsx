import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Landmark, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '525912195711-gspvd24nog749cf3lg7hti2s0pc14p12.apps.googleusercontent.com',
        callback: handleCredentialResponse,
        hosted_domain: 'pec.edu.in'
      });
      window.google.accounts.id.renderButton(
        googleButtonRef.current,
        { theme: 'outline', size: 'large', text: 'continue_with', width: 280 }
      );
    }
  }, []);

  const handleCredentialResponse = async (response) => {
    try {
      setError(null);
      await login(response.credential);
      navigate('/');
    } catch (err) {
      setError(err.error || 'Failed to authenticate with Google. Ensure you use your @pec.edu.in ID.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)'
    }}>
      <header style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }}>
        <img src="/pec-logo.png" alt="PEC Logo" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>PEC CSE</h1>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timetable &amp; Scheduling</p>
        </div>
      </header>

      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }}>
        <div style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '40px 32px 32px',
            textAlign: 'center',
            borderBottom: '1px solid var(--border)'
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Sign in to your account</h2>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
              Use your official Punjab Engineering College email ID to access the system.
            </p>
          </div>

          <div style={{ padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {error && (
              <div style={{
                width: '100%',
                marginBottom: 24,
                padding: 16,
                background: 'rgba(244,63,94,0.1)',
                border: '1px solid rgba(244,63,94,0.2)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--rose)',
                fontSize: 14,
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start'
              }}>
                <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{error}</span>
              </div>
            )}

            <div ref={googleButtonRef} style={{ width: '100%', maxWidth: 280, minHeight: 40, display: 'flex', justifyContent: 'center' }}></div>

            <p style={{
              marginTop: 32,
              fontSize: 12,
              color: 'var(--text-muted)',
              textAlign: 'center',
              maxWidth: 280
            }}>
              By signing in, you agree to our Terms of Service and Privacy Policy. Only @pec.edu.in accounts are permitted.
            </p>
          </div>
        </div>
      </main>

      <footer style={{
        width: '100%',
        padding: 24,
        textAlign: 'center',
        fontSize: 13,
        color: 'var(--text-muted)'
      }}>
        &copy; {new Date().getFullYear()} Punjab Engineering College - Computer Science &amp; Engineering Dept.
      </footer>
    </div>
  );
}
