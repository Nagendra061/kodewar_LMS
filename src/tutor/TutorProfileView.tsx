import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { Tutor, TutorPermissions } from '../types/index.ts';
import {
  User,
  Mail,
  Phone,
  Briefcase,
  GraduationCap,
  Lock,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  BookOpen,
  Users,
  LogOut,
} from 'lucide-react';

export const TutorProfileView: React.FC = () => {
  const { updateUserPassword, logout } = useAuth();
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit fields
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  // Profile update state
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await api.getTutorProfile();
      const tutorData = (res as any).tutor || (res as any).profile || res;
      if (tutorData) {
        setTutor(tutorData);
        setPhone(tutorData.phone || '');
        setDesignation(tutorData.designation || '');
        setSpecialization(tutorData.specialization || '');
        setAvatarUrl(tutorData.avatarUrl || '');
      }
    } catch (err) {
      console.error('Failed to load tutor profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setSavingProfile(true);
    try {
      const res = await api.updateTutorProfile({
        phone: phone.trim(),
        designation: designation.trim(),
        specialization: specialization.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
      } as any);
      const tutorData = (res as any).tutor || (res as any).profile || res;
      if (tutorData) {
        setTutor(tutorData);
      }
      setProfileSuccess('Profile information updated successfully.');
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 6) {
      setPasswordError('New password must contain at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      await updateUserPassword(newPassword, currentPassword || undefined);
      setPasswordSuccess('Your password has been changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
        <div className="h-44 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!tutor) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Tutor account profile not found.
      </div>
    );
  }

  const permissions: Partial<TutorPermissions> = tutor.permissions || {};

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <User className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <span>Instructor Profile & Account Settings</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review your account credentials, update contact information, manage security settings, and check assigned portal permissions.
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>

      {/* Identity Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-xl border border-purple-200 dark:border-purple-800 shrink-0">
            {tutor.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .substring(0, 2)
              .toUpperCase()}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {tutor.name}
              </h2>
              <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                {tutor.tutorId}
              </span>
            </div>

            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-0.5">
              {tutor.designation || 'Technical Instructor'}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-2">
              <span className="flex items-center gap-1 font-mono">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {tutor.email}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {tutor.phone || 'No phone recorded'}
              </span>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Active Account</span>
          </span>
        </div>
      </div>

      {/* Assigned Batches & Courses Badges */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-600" />
          <span>Curriculum Assignments</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Assigned Batches (Cohorts)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {tutor.assignedBatchNames && tutor.assignedBatchNames.length > 0 ? (
                tutor.assignedBatchNames.map((bn, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                  >
                    {bn}
                  </span>
                ))
              ) : (
                <span className="text-slate-400 italic">No batches currently assigned</span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Assigned Courses
            </span>
            <div className="flex flex-wrap gap-1.5">
              {tutor.assignedCourseNames && tutor.assignedCourseNames.length > 0 ? (
                tutor.assignedCourseNames.map((cn, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                  >
                    {cn}
                  </span>
                ))
              ) : (
                <span className="text-slate-400 italic">No courses assigned</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-purple-600" />
          <span>Professional Information</span>
        </h3>

        {profileSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{profileSuccess}</span>
          </div>
        )}

        {profileError && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{profileError}</span>
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Professional Designation
              </label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Lead Technical Mentor"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Skills & Subject Expertise
            </label>
            <input
              type="text"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="e.g. React, TypeScript, Cloud Architecture, DevOps"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingProfile}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-sm disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{savingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Granted Permissions Summary (Read-Only) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Administrator Authorized Permissions</span>
          </h3>
          <span className="text-[11px] text-slate-400">Configured by Super Admin</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
          {[
            { label: 'View Assigned Batches', active: permissions.canViewAssignedBatches },
            { label: 'View Assigned Candidates', active: permissions.canViewAssignedCandidates },
            { label: 'View Assigned Meetings', active: permissions.canViewAssignedMeetings },
            { label: 'View Live Meeting Links', active: permissions.canViewMeetingLinks },
            { label: 'Manage Meeting Access Gates', active: permissions.canManageMeetingAccess },
            { label: 'Record Session Attendance', active: permissions.canRecordAttendance },
            {
              label: `Edit Attendance (within ${permissions.attendanceEditWindowHours || 24}h window)`,
              active: permissions.canEditAttendance,
            },
            { label: 'View Learning Resources', active: permissions.canViewResources },
            { label: 'Upload Learning Resources', active: permissions.canUploadResources },
            { label: 'Manage & Delete Own Resources', active: permissions.canManageOwnResources },
          ].map((perm, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
            >
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {perm.label}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  perm.active
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
              >
                {perm.active ? 'GRANTED' : 'RESTRICTED'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Change Password Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-indigo-600" />
          <span>Security & Password</span>
        </h3>

        {passwordSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{passwordSuccess}</span>
          </div>
        )}

        {passwordError && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={changingPassword}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm disabled:opacity-50 transition-colors"
            >
              <Lock className="w-4 h-4" />
              <span>{changingPassword ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Active Session & Logout Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Active Session & Sign Out</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg">
            Logged in as <span className="font-semibold text-slate-800 dark:text-slate-200">{tutor.name}</span> ({tutor.email}). Safely terminate your active instructor session across this browser.
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors shrink-0 cursor-pointer shadow-xs"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of Tutor Portal</span>
        </button>
      </div>
    </div>
  );
};
