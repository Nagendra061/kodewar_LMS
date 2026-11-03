import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { User, KeyRound, Lock, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';

export const CandidateProfileView: React.FC = () => {
  const { user, updateUserPassword, logout } = useAuth();
  const cand = user as any;

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword.length < 6) {
      setPwError('New password must contain at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }

    setPwSubmitting(true);
    try {
      await updateUserPassword(newPassword, currentPassword);
      setPwSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(null), 3000);
    } catch (err: any) {
      setPwError(err.message || 'Failed to update password');
    } finally {
      setPwSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          My Candidate Profile & Security
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Review your enrolled curriculum, active cohort assignment, and update security credentials (PRD §7.6).
        </p>
      </div>

      {/* Enrolled Details Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold flex items-center justify-center text-sm">
            {cand?.name ? cand.name.charAt(0) : 'C'}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{cand?.name}</h2>
            <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
              Candidate ID: {cand?.candidateId}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
            <span className="text-slate-400 font-medium block">Registered Email</span>
            <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
              {cand?.email}
            </span>
            <span className="text-[10px] text-slate-400">Used for official account notifications</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
            <span className="text-slate-400 font-medium block">Phone Contact</span>
            <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
              {cand?.phone || 'Not provided'}
            </span>
            <span className="text-[10px] text-slate-400">Candidate emergency contact</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
            <span className="text-slate-400 font-medium block">Enrolled Course Curriculum</span>
            <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
              {cand?.courseName}
            </span>
            <span className="text-[10px] text-slate-400">Admin-managed credential track</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
            <span className="text-slate-400 font-medium block">Active Cohort Batch (BR-08)</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              {cand?.batchName}
            </span>
            <span className="text-[10px] text-slate-400">Only 1 active batch permitted per candidate</span>
          </div>
        </div>
      </div>

      {/* Security: Change Password Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <KeyRound className="w-4 h-4 text-blue-500" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Change Account Password
          </h3>
        </div>

        {pwError && (
          <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{pwError}</span>
          </div>
        )}

        {pwSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{pwSuccess}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter existing password"
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              New Password (min 6 characters)
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={pwSubmitting}
            className="px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            {pwSubmitting ? 'Updating Password...' : 'Save New Password'}
          </button>
        </form>
      </div>

      {/* Session Sign Out */}
      <div className="pt-2 flex justify-end">
        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 text-xs font-semibold"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out of Account</span>
        </button>
      </div>
    </div>
  );
};
