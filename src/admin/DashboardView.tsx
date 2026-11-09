import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { MeetingSession } from '../types/index.ts';
import {
  Users,
  Layers,
  BookOpen,
  CheckCircle,
  Calendar,
  CalendarClock,
  PlusCircle,
  Upload,
  ArrowRight,
  Radio,
  Clock,
  Video,
  ExternalLink,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [summary, setSummary] = useState<any>(null);
  const [todayMeetings, setTodayMeetings] = useState<MeetingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const sum = await api.getReportsSummary();
      setSummary(sum);

      const meetingsRes = await api.getMeetings();
      const todayStr = new Date().toISOString().split('T')[0];
      setTodayMeetings(meetingsRes.meetings.filter((m) => m.date === todayStr));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleAccess = async (session: MeetingSession) => {
    const nextStatus = session.accessStatus === 'enabled' ? 'disabled' : 'enabled';
    try {
      await api.setMeetingAccess(session.id, nextStatus);
      setActionMessage(`Meeting access for "${session.title}" changed to ${nextStatus.toUpperCase()}.`);
      loadData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update access status');
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Heading */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Super Admin Operational Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time candidate registrations, active batch allocations, and live meeting access control.
          </p>
        </div>

        {/* Quick action shortcuts */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onNavigate('candidates')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Candidate</span>
          </button>
          <button
            onClick={() => onNavigate('meetings')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Schedule Meeting</span>
          </button>
          <button
            onClick={() => onNavigate('leave-management')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <CalendarClock className="w-3.5 h-3.5 text-blue-600" />
            <span>Leave Management</span>
          </button>
          <button
            onClick={() => onNavigate('resources')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Resource</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">Total Candidates</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {summary?.candidates?.total || 0}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {summary?.candidates?.active || 0} active
            </span>
            <span>·</span>
            <span>{summary?.candidates?.pending || 0} pending setup</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">Active Batches</span>
            <Layers className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {summary?.academics?.activeBatches || 0}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Across {summary?.academics?.courses || 0} courses · {summary?.academics?.activeTutors || 0} tutors
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">Attendance Rate</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {summary?.attendance?.totalRecords > 0 ? `${summary.attendance.presentRate}%` : '0%'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {summary?.attendance?.totalRecords || 0} total verified records
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">Scheduled Sessions</span>
            <Calendar className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {summary?.meetings?.upcoming + summary?.meetings?.today || 0}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {summary?.meetings?.today || 0} today · {summary?.meetings?.completed || 0} completed
          </div>
        </div>
      </div>

      {/* Today's Meetings & Access Control Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Today's Scheduled Sessions & Access Controls
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Meeting access defaults to Disabled. Candidates cannot view raw URL or join until you explicitly Enable Access.
            </p>
          </div>
          <button
            onClick={() => onNavigate('meetings')}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span>Full Scheduler</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {todayMeetings.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            No sessions scheduled for today. You can schedule one in the Meeting Scheduler.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {todayMeetings.map((session) => {
              const isEnabled = session.accessStatus === 'enabled';
              return (
                <div key={session.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">
                        {session.title}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">·</span>
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">
                        {session.batchName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span className="tabular-nums">
                        {session.startTime} - {session.endTime} ({session.timezone})
                      </span>
                      <span>·</span>
                      <span>Tutor: {session.tutorName}</span>
                      <span>·</span>
                      <span className="font-mono text-slate-400">{session.meetingPlatform}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span
                        className={`text-[11px] font-medium ${
                          isEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {isEnabled ? 'Access is Enabled' : 'Access is Disabled'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleToggleAccess(session)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                        isEnabled
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                          : 'bg-emerald-600 text-white hover:bg-emerald-500'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>{isEnabled ? 'Revoke Access' : 'Enable Access'}</span>
                    </button>

                    <button
                      onClick={() => onNavigate('attendance')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                    >
                      Attendance
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
