import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { TutorTab } from './TutorSidebar.tsx';
import {
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  FolderOpen,
  ArrowRight,
  ExternalLink,
  BookOpen,
  Bell,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

interface TutorDashboardProps {
  onNavigate: (tab: TutorTab) => void;
}

export const TutorDashboard: React.FC<TutorDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    tutor: any;
    stats: {
      assignedBatchesCount: number;
      totalCandidates: number;
      upcomingMeetingsCount: number;
      completedMeetingsCount: number;
      pendingAttendanceCount: number;
      totalResourcesCount: number;
    };
    nextSession: any;
    recentMeetings: any[];
    assignedBatches: any[];
    unmarkedSessions: any[];
    notifications: any[];
  } | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getTutorDashboard();
      setData(res);
    } catch (err) {
      console.error('Failed to load tutor dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const tutor = data?.tutor;
  const stats = data?.stats || {
    assignedBatchesCount: 0,
    totalCandidates: 0,
    upcomingMeetingsCount: 0,
    completedMeetingsCount: 0,
    pendingAttendanceCount: 0,
    totalResourcesCount: 0,
  };
  const nextSession = data?.nextSession;
  const unmarkedSessions = data?.unmarkedSessions || [];
  const assignedBatches = data?.assignedBatches || [];
  const recentMeetings = data?.recentMeetings || [];
  const notifications = data?.notifications || [];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 shadow-sm border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold border border-indigo-500/30">
              <Sparkles className="w-3 h-3" />
              <span>Instructor Workspace</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Welcome back, {user?.name || tutor?.name || 'Instructor'}
            </h1>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              {tutor?.designation || 'Technical Mentor'} · ID: <span className="font-mono">{tutor?.tutorId}</span>
              {tutor?.specialization && ` · Focus: ${tutor.specialization}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate('attendance')}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm"
            >
              Mark Attendance
            </button>
            <button
              onClick={() => onNavigate('batches')}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/15 text-white backdrop-blur-sm transition-colors border border-white/10"
            >
              View My Batches
            </button>
          </div>
        </div>
      </div>

      {/* Unmarked Attendance Alerts */}
      {unmarkedSessions.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
              {unmarkedSessions.length} Completed Session{unmarkedSessions.length > 1 ? 's' : ''} Require Attendance Marking
            </h4>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
              Roll call records have not been submitted for your recent classes. Please record attendance promptly.
            </p>
          </div>
          <button
            onClick={() => onNavigate('attendance')}
            className="px-3 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shrink-0"
          >
            Review Sessions
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Batches</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-2">
            {stats.assignedBatchesCount}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Assigned cohorts</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Candidates</span>
            <GraduationCap className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-2">
            {stats.totalCandidates}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Enrolled learners</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Upcoming</span>
            <Calendar className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-2">
            {stats.upcomingMeetingsCount}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Scheduled classes</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-2">
            {stats.completedMeetingsCount}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Conducted sessions</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Attendance</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-2">
            {stats.pendingAttendanceCount}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Pending records</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Resources</span>
            <FolderOpen className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-2">
            {stats.totalResourcesCount}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Available files</span>
        </div>
      </div>

      {/* Main Grid: Next Session Spotlight & Assigned Batches */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Next Class Spotlight & Recent Meetings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Next Class Spotlight Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Next Scheduled Session
                </h3>
              </div>
              <button
                onClick={() => onNavigate('meetings')}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>View all meetings</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {nextSession ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {nextSession.batchName || 'Assigned Batch'}
                  </span>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {nextSession.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {nextSession.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {nextSession.startTime} - {nextSession.endTime} ({nextSession.durationMinutes} mins)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {nextSession.meetingLink && tutor?.permissions?.canViewMeetingLinks ? (
                    <a
                      href={nextSession.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Join Room</span>
                    </a>
                  ) : null}
                  <button
                    onClick={() => onNavigate('meetings')}
                    className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Details
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No upcoming sessions scheduled right now.
              </div>
            )}
          </div>

          {/* Recent Meetings Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Recent Meeting History
              </h3>
              <button
                onClick={() => onNavigate('meetings')}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                View all
              </button>
            </div>

            {recentMeetings.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No recent meeting records found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="pb-2.5">Topic / Session</th>
                      <th className="pb-2.5">Batch</th>
                      <th className="pb-2.5">Date & Time</th>
                      <th className="pb-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentMeetings.slice(0, 5).map((m: any) => (
                      <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 font-medium text-slate-900 dark:text-white">
                          {m.title}
                        </td>
                        <td className="py-3 text-slate-600 dark:text-slate-300">
                          {m.batchName}
                        </td>
                        <td className="py-3 text-slate-500 font-mono text-[11px]">
                          {m.date} · {m.startTime}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              m.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : m.status === 'cancelled'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 span): Assigned Batches & Notification Feed */}
        <div className="space-y-6">
          {/* Assigned Batches List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-600" />
                <span>My Batches ({assignedBatches.length})</span>
              </h3>
              <button
                onClick={() => onNavigate('batches')}
                className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
              >
                Manage
              </button>
            </div>

            {assignedBatches.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                No active batches currently assigned.
              </p>
            ) : (
              <div className="space-y-2.5">
                {assignedBatches.map((batch: any) => (
                  <div
                    key={batch.id}
                    onClick={() => onNavigate('batches')}
                    className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-purple-200 dark:hover:border-purple-800/60 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          {batch.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {batch.courseName}
                        </div>
                      </div>
                      <span className="text-[10px] bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 px-2 py-0.5 rounded-full font-semibold">
                        {batch.candidateCount} students
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent In-App Notifications */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                <span>Notifications</span>
              </h3>
              <button
                onClick={() => onNavigate('notifications')}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                View all
              </button>
            </div>

            {notifications.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                No notifications right now.
              </p>
            ) : (
              <div className="space-y-2.5">
                {notifications.slice(0, 4).map((n: any) => (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-lg border text-xs transition-colors ${
                      n.isRead
                        ? 'border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        : 'border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 text-slate-900 dark:text-white'
                    }`}
                  >
                    <div className="font-semibold text-[11px]">{n.title}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {n.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

