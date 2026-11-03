import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { SystemSettings } from '../types/index.ts';
import { Save, CheckCircle2, Globe, Mail, BookOpen } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

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
  }, []);

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
    </div>
  );
};
