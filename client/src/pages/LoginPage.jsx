import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Landmark, ShieldAlert, UserCheck, Terminal, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login, loginDev, user } = useAuth();
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [devEmail, setDevEmail] = useState('aryangoyal.bt24cse@pec.edu.in');
  const [devRole, setDevRole] = useState('admin');

  const isLocalHost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || import.meta.env.DEV);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    let intervalId = null;

    const renderGoogleBtn = () => {
      if (window.google?.accounts?.id && googleButtonRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '525912195711-gspvd24nog749cf3lg7hti2s0pc14p12.apps.googleusercontent.com',
            callback: handleCredentialResponse,
            hosted_domain: 'pec.edu.in'
          });
          window.google.accounts.id.renderButton(
            googleButtonRef.current,
            { theme: 'outline', size: 'large', text: 'continue_with', width: 280 }
          );
          return true;
        } catch (err) {
          console.warn('Google button render error:', err);
        }
      }
      return false;
    };

    if (!renderGoogleBtn()) {
      intervalId = setInterval(() => {
        if (renderGoogleBtn()) {
          clearInterval(intervalId);
        }
      }, 200);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleCredentialResponse = async (response) => {
    try {
      setLoading(true);
      setError(null);
      await login(response.credential);
      navigate('/');
    } catch (err) {
      setError(err?.error || 'Failed to authenticate with Google. Ensure you use your @pec.edu.in ID.');
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async (e, customEmail = null, customRole = null) => {
    if (e) e.preventDefault();
    const targetEmail = customEmail || devEmail;
    const targetRole = customRole || devRole;

    if (!targetEmail.trim().endsWith('@pec.edu.in')) {
      setError('Dev Login requires an email ending with @pec.edu.in');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await loginDev({ email: targetEmail.trim(), role: targetRole });
      navigate('/');
    } catch (err) {
      setError(err?.error || 'Local Dev Login failed.');
    } finally {
      setLoading(false);
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
          maxWidth: 440,
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '32px 32px 24px',
            textAlign: 'center',
            borderBottom: '1px solid var(--border)'
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>Sign in to your account</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
              Use your official Punjab Engineering College email ID (@pec.edu.in) to access the system.
            </p>
          </div>

          <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {error && (
              <div style={{
                width: '100%',
                marginBottom: 20,
                padding: '12px 14px',
                background: 'rgba(244,63,94,0.1)',
                border: '1px solid rgba(244,63,94,0.25)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--rose)',
                fontSize: 13,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start'
              }}>
                <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Official Google Sign-in Button */}
            <div ref={googleButtonRef} style={{ width: '100%', maxWidth: 280, minHeight: 44, display: 'flex', justifyContent: 'center' }}></div>

            {loading && (
              <p style={{ fontSize: 13, color: 'var(--accent)', marginTop: 12 }}>Authenticating, please wait...</p>
            )}

            {/* Localhost / Dev Quick Login */}
            {isLocalHost && (
              <div style={{
                width: '100%',
                marginTop: 28,
                paddingTop: 20,
                borderTop: '1px dashed var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                  <Terminal size={14} />
                  <span>Local Dev / Testing Authentication</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    type="button"
                    onClick={(e) => handleDevLogin(e, 'aryangoyal.bt24cse@pec.edu.in', 'admin')}
                    disabled={loading}
                    className="btn btn-secondary"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <UserCheck size={14} color="#10b981" />
                      <strong>Login as Super Admin</strong>
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>aryangoyal.bt24cse@pec.edu.in</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDevLogin(e, 'teacher.cse@pec.edu.in', 'viewer')}
                    disabled={loading}
                    className="btn btn-secondary"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <UserCheck size={14} color="#6366f1" />
                      <span>Login as Faculty (Viewer)</span>
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>teacher.cse@pec.edu.in</span>
                  </button>
                </div>

                <form onSubmit={handleDevLogin} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="email"
                      value={devEmail}
                      onChange={(e) => setDevEmail(e.target.value)}
                      placeholder="custom@pec.edu.in"
                      className="form-control"
                      style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                    />
                    <select
                      value={devRole}
                      onChange={(e) => setDevRole(e.target.value)}
                      className="form-control"
                      style={{ width: 90, fontSize: 12, padding: '6px 8px' }}
                    >
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: '6px 12px', width: '100%' }}
                  >
                    Sign in with Custom @pec.edu.in
                  </button>
                </form>
              </div>
            )}

            <p style={{
              marginTop: 24,
              fontSize: 12,
              color: 'var(--text-muted)',
              textAlign: 'center',
              maxWidth: 300
            }}>
              Only official @pec.edu.in accounts are permitted to sign in.
            </p>
          </div>
        </div>
      </main>

      <footer style={{
        width: '100%',
        padding: 20,
        textAlign: 'center',
        fontSize: 12,
        color: 'var(--text-muted)'
      }}>
        &copy; {new Date().getFullYear()} Punjab Engineering College - Computer Science &amp; Engineering Dept.
      </footer>
    </div>
  );
}
