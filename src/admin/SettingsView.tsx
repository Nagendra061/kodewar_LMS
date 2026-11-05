import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { SystemSettings } from '../types/index.ts';
import {
  Save,
  CheckCircle2,
  Globe,
  Mail,
  BookOpen,
  LogOut,
  Database,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

const SQL_SCHEMA_SNIPPET = `-- Kodewar LMS State Table
CREATE TABLE IF NOT EXISTS public.lms_state (
  id TEXT PRIMARY KEY DEFAULT 'primary',
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::TEXT, now()) NOT NULL
);

ALTER TABLE public.lms_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to lms_state" ON public.lms_state;
CREATE POLICY "Allow all access to lms_state"
  ON public.lms_state
  FOR ALL
  USING (true)
  WITH CHECK (true);`;

export const SettingsView: React.FC = () => {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Supabase Integration State
  const [supabaseStatus, setSupabaseStatus] = useState<{
    connected: boolean;
    url: string;
    hasKey: boolean;
    keyPreview: string;
    lastSyncedAt: string | null;
  } | null>(null);
  const [supabaseUrlInput, setSupabaseUrlInput] = useState('');
  const [supabaseKeyInput, setSupabaseKeyInput] = useState('');
  const [connectingSupabase, setConnectingSupabase] = useState(false);
  const [syncingSupabase, setSyncingSupabase] = useState(false);
  const [supabaseNotice, setSupabaseNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const fetchSupabaseInfo = async () => {
    try {
      const res = await api.getSupabaseStatus();
      setSupabaseStatus(res);
      if (res.url) setSupabaseUrlInput(res.url);
    } catch (e) {
      console.warn('Failed to fetch Supabase status:', e);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.getSettings();
        setSettings(res.settings);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
    fetchSupabaseInfo();
  }, []);

  const handleConnectSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrlInput.trim() || !supabaseKeyInput.trim()) {
      setSupabaseNotice({ type: 'error', message: 'Please provide both Supabase Project URL and API Key.' });
      return;
    }

    setConnectingSupabase(true);
    setSupabaseNotice(null);
    try {
      const res = await api.configureSupabase(supabaseUrlInput.trim(), supabaseKeyInput.trim());
      setSupabaseNotice({ type: 'success', message: res.message });
      await fetchSupabaseInfo();
      setSupabaseKeyInput('');
    } catch (err: any) {
      setSupabaseNotice({ type: 'error', message: err.message || 'Failed to connect to Supabase.' });
    } finally {
      setConnectingSupabase(false);
    }
  };

  const handleSyncDatabase = async (direction: 'push' | 'pull') => {
    setSyncingSupabase(true);
    setSupabaseNotice(null);
    try {
      const res = await api.syncSupabase(direction);
      setSupabaseNotice({ type: 'success', message: res.message });
      await fetchSupabaseInfo();
    } catch (err: any) {
      setSupabaseNotice({ type: 'error', message: err.message || 'Sync failed.' });
    } finally {
      setSyncingSupabase(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_SNIPPET);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSuccess(false);
    try {
      const res = await api.updateSettings(settings);
      setSettings(res.settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return <div className="p-8 text-xs text-slate-400">Loading settings...</div>;
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          System & Company Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure single-company timezone rules, attendance calculation formulas, and security parameters.
        </p>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>System configuration updated and recorded in audit log.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Profile & Timezone */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Globe className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Company Identity & Timezone
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Authoritative System Timezone
              </label>
              <select
                value={settings.companyTimezone}
                onChange={(e) => setSettings({ ...settings, companyTimezone: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="UTC">UTC (Universal Coordinated Time)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Attendance Calculation Policy */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <BookOpen className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Attendance Calculation Formula Policy
            </h3>
          </div>

          <p className="text-xs text-slate-500">
            Formula: Attendance % = Qualifying Attended Sessions ÷ Eligible Sessions × 100.
          </p>

          <div className="space-y-3 pt-1">
            <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.lateCountsAsAttended}
                onChange={(e) => setSettings({ ...settings, lateCountsAsAttended: e.target.checked })}
                className="mt-0.5 rounded text-blue-600"
              />
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">Count "Late" as Attended</span>
                <p className="text-slate-500 text-[11px]">When checked, sessions marked Late count toward the qualifying attended numerator.</p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.excludeExcusedFromDenominator}
                onChange={(e) =>
                  setSettings({ ...settings, excludeExcusedFromDenominator: e.target.checked })
                }
                className="mt-0.5 rounded text-blue-600"
              />
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">Exclude "Excused" from Denominator</span>
                <p className="text-slate-500 text-[11px]">When checked, officially Excused sessions are subtracted from the eligible session total so the candidate is not penalized.</p>
              </div>
            </label>
          </div>
        </div>

        {/* Email & Outbox Configuration */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Mail className="w-4 h-4 text-purple-500" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Transactional Email Notification Services
            </h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailNotificationsEnabled}
                onChange={(e) => setSettings({ ...settings, emailNotificationsEnabled: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span>Enable Outbox queueing for candidate credential delivery and meeting schedule notifications</span>
            </label>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Max Resource File Upload Size (MB)
                </label>
                <input
                  type="number"
                  value={settings.maxFileUploadSizeMb}
                  onChange={(e) => setSettings({ ...settings, maxFileUploadSizeMb: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>

      {/* Supabase Cloud PostgreSQL Database */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Supabase Cloud Database
            </h3>
          </div>

          {supabaseStatus?.connected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Connected & Synchronized
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              Using Local JSON Storage
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Connect your free Supabase PostgreSQL project for persistent multi-region cloud storage, automated daily backups, and instant synchronization.
        </p>

        {supabaseNotice && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              supabaseNotice.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}
          >
            {supabaseNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{supabaseNotice.message}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleConnectSupabase} className="space-y-3 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                Supabase Project URL
              </label>
              <input
                type="text"
                placeholder="https://xyzcompany.supabase.co"
                value={supabaseUrlInput}
                onChange={(e) => setSupabaseUrlInput(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                Supabase API Key (Anon / Service Role)
              </label>
              <input
                type="password"
                placeholder={supabaseStatus?.hasKey ? `Configured (${supabaseStatus.keyPreview})` : 'eyJhbGciOiJIUzI1Ni...'}
                value={supabaseKeyInput}
                onChange={(e) => setSupabaseKeyInput(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="text-[11px] text-slate-400">
              {supabaseStatus?.lastSyncedAt && (
                <span>Last cloud sync: {new Date(supabaseStatus.lastSyncedAt).toLocaleString()}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {supabaseStatus?.connected && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSyncDatabase('push')}
                    disabled={syncingSupabase}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncingSupabase ? 'animate-spin' : ''}`} />
                    <span>Push to Supabase</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSyncDatabase('pull')}
                    disabled={syncingSupabase}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncingSupabase ? 'animate-spin' : ''}`} />
                    <span>Pull from Supabase</span>
                  </button>
                </>
              )}

              <button
                type="submit"
                disabled={connectingSupabase}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{connectingSupabase ? 'Verifying & Syncing...' : 'Connect & Sync'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Quick Setup Guide Box */}
        <div className="mt-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              1-Click Supabase Table Setup (SQL Editor)
            </span>
            <button
              type="button"
              onClick={handleCopySql}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
            >
              {copiedSql ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL Script'}</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Create a project on{' '}
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 inline-flex items-center gap-0.5 hover:underline font-medium"
            >
              supabase.com <ExternalLink className="w-2.5 h-2.5" />
            </a>
            , navigate to <strong>SQL Editor</strong>, paste this script, and click <strong>Run</strong>. Then paste your Project URL and API Key above!
          </p>

          <pre className="p-2.5 bg-slate-900 text-slate-200 rounded text-[10px] font-mono overflow-x-auto leading-relaxed border border-slate-800">
            {SQL_SCHEMA_SNIPPET}
          </pre>
        </div>
      </div>

      {/* Account Session & Sign Out */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <LogOut className="w-4 h-4 text-rose-500" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Account Session
          </h3>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
          <div>
            <p className="text-xs font-medium text-slate-900 dark:text-white">
              Signed in as <span className="font-semibold">{user?.name}</span> ({user?.email})
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              End your active session securely and return to the authentication portal.
            </p>
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg text-xs font-semibold transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
