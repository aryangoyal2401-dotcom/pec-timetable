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
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="w-full bg-white border-b px-6 py-4 shadow-sm flex items-center gap-3">
        <Landmark className="h-8 w-8 text-indigo-600" />
        <div>
          <h1 className="font-bold text-xl text-slate-800">PEC CSE</h1>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Timetable &amp; Scheduling</p>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          <div className="px-8 pt-10 pb-8 text-center border-b border-slate-100">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Sign in to your account</h2>
            <p className="text-slate-500 text-sm">
              Use your official Punjab Engineering College email ID to access the system.
            </p>
          </div>

          <div className="px-8 py-10 flex flex-col items-center">
            {error && (
              <div className="w-full mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 text-red-700 text-sm items-start">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div ref={googleButtonRef} className="w-full max-w-[280px] min-h-[40px] flex justify-center"></div>

            <p className="mt-8 text-xs text-slate-400 text-center max-w-[280px]">
              By signing in, you agree to our Terms of Service and Privacy Policy. Only @pec.edu.in accounts are permitted.
            </p>
          </div>
        </div>
      </main>

      <footer className="w-full p-6 text-center text-sm text-slate-400">
        &copy; {new Date().getFullYear()} Punjab Engineering College - Computer Science &amp; Engineering Dept.
      </footer>
    </div>
  );
}
