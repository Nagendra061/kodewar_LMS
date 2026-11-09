import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Shield, Mail, AlertCircle, ArrowRight, Eye, EyeOff, GraduationCap } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('admin@kodewar.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setPreset = (id: string, pass: string) => {
    setIdentifier(id);
    setPassword(pass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 flex items-center justify-center z-0 overflow-hidden select-none"
      >
        <img
          src="/logo.png"
          alt=""
          className="w-[480px] max-w-[70vw] max-h-[70vh] object-contain opacity-[0.18] dark:opacity-[0.20] dark:invert pointer-events-none"
        />
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <img
            src="/favicon.png"
            alt="Kodewar"
            className="w-12 h-12 rounded-xl object-contain bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 shadow-sm"
          />
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Kodewar LMS
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">
          Single-Company Digital Learning & Candidate Management
        </p>
      </div>

      <div className="relative z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Registered Email or Candidate ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@kodewar.com or KDL-2026-001"
                  className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3.5 pr-10 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Preset testing logins */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">
              Quick Role Switch (Demo Access)
            </p>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setPreset('admin@kodewar.com', 'admin123')}
                className="w-full text-left p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-slate-900 dark:text-white">Super Admin</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">admin@kodewar.com</span>
              </button>

              <button
                type="button"
                onClick={() => setPreset('vinay@kodewar.com', 'tutor123')}
                className="w-full text-left p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium text-slate-900 dark:text-white">Assigned Tutor</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">vinay@kodewar.com</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
              Enrolled candidates and assigned tutors can sign in with their registered email or unique account ID.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
