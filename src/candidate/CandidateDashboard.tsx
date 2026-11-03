import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import type { MeetingSession, ResourceItem, AppNotification } from '../types/index.ts';
import {
  Calendar,
  Clock,
  Radio,
  Video,
  ExternalLink,
  BookOpen,
  FolderOpen,
  CheckCircle2,
  Bell,
  RefreshCw,
  AlertCircle,
  FileText,
  Lock,
} from 'lucide-react';

interface CandidateDashboardProps {
  onNavigate: (tab: any) => void;
}

export const CandidateDashboard: React.FC<CandidateDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<(MeetingSession & { isJoinable: boolean })[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [attendanceMetrics, setAttendanceMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joiningMeeting, setJoiningMeeting] = useState(false);

  const cand = user as any;

  const loadData = async () => {
    try {
      const [meetRes, resRes, notifRes, attRes] = await Promise.all([
        api.getCandidateMeetings(),
        api.getCandidateResources(),
        api.getCandidateNotifications(),
        api.getCandidateAttendance(),
      ]);

      setMeetings(meetRes.meetings);
      setResources(resRes.resources);
      setNotifications(notifRes.notifications);
      setAttendanceMetrics(attRes.metrics);
    } catch (err) {
      console.error('Failed to load candidate data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Periodic refresh check every 15s to catch instructor toggling access
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Find next upcoming scheduled meeting
  const nextMeeting = meetings.find((m) => m.status === 'scheduled');

  const handleJoinMeeting = async (meetingId: string) => {
    setJoiningMeeting(true);
    try {
      // Backend authorization check: PRD BR-20
      const res = await api.joinCandidateMeeting(meetingId);
      window.open(res.meetingUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      alert(err.message || 'Unable to join meeting at this time.');
      loadData();
    } finally {
      setJoiningMeeting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-48" />
        <div className="h-44 bg-slate-100 dark:bg-slate-800 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-300 font-mono mb-1">
            <span>Candidate ID: {cand?.candidateId}</span>
            <span>·</span>
            <span>Enrolled: {cand?.enrollmentDate}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">
            Welcome back, {user?.name}
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Current Course: <strong>{cand?.courseName}</strong> · Cohort: <strong>{cand?.batchName}</strong>
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start md:self-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
          title="Refresh meeting access state"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Primary Hero Card: Next Scheduled Meeting Spotlight */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Next Scheduled Session Spotlight
            </span>
          </div>

          {nextMeeting && (
            <span
              className={`text-xs font-medium flex items-center gap-1.5 ${
                nextMeeting.isJoinable
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${nextMeeting.isJoinable ? 'animate-pulse' : ''}`} />
              <span>{nextMeeting.isJoinable ? 'Meeting Access Live' : 'Access Waiting for Instructor'}</span>
            </span>
          )}
        </div>

        {nextMeeting ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {nextMeeting.title}
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                    {nextMeeting.date} ({nextMeeting.startTime} - {nextMeeting.endTime} {nextMeeting.timezone})
                  </span>
                </div>
                <span>·</span>
                <span>Tutor: {nextMeeting.tutorName}</span>
                <span>·</span>
                <span className="font-mono text-[11px]">{nextMeeting.meetingPlatform}</span>
              </div>
              {nextMeeting.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {nextMeeting.description}
                </p>
              )}
            </div>

            <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
              {nextMeeting.isJoinable ? (
                <button
                  onClick={() => handleJoinMeeting(nextMeeting.id)}
                  disabled={joiningMeeting}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <Video className="w-4 h-4" />
                  <span>{joiningMeeting ? 'Connecting to Room...' : 'Join Live Meeting'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="space-y-1 text-right">
                  <button
                    disabled
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed flex items-center gap-2 border border-slate-200 dark:border-slate-700"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Join Meeting (Waiting)</span>
                  </button>
                  <p className="text-[10px] text-slate-400 text-left md:text-right">
                    Instructor will unlock meeting access right before session start.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400">
            No upcoming sessions scheduled for your cohort at this time.
          </div>
        )}
      </div>

      {/* Grid: Attendance Summary + Announcements */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Attendance Summary */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              My Attendance Summary
            </h3>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Details
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-emerald-500 flex items-center justify-center font-bold text-xl text-slate-900 dark:text-white tabular-nums">
              {attendanceMetrics?.attendanceRate || 100}%
            </div>
            <div className="space-y-1 text-xs">
              <div className="text-slate-600 dark:text-slate-400">
                Qualifying: <strong>{attendanceMetrics?.qualifyingAttended || 0}</strong> /{' '}
                {attendanceMetrics?.eligibleSessions || 0} sessions
              </div>
              <div className="text-[11px] text-slate-500 flex gap-2">
                <span>Present: {attendanceMetrics?.presentCount || 0}</span>
                <span>Late: {attendanceMetrics?.lateCount || 0}</span>
                <span>Absent: {attendanceMetrics?.absentCount || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Announcements */}
        <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Course Announcements & Notices
            </h3>
            <button
              onClick={() => onNavigate('notifications')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              All Notices ({notifications.length})
            </button>
          </div>

          <div className="space-y-2.5">
            {notifications.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No announcements posted for your course at this time.
              </div>
            ) : (
              notifications.slice(0, 2).map((n) => (
                <div
                  key={n.id}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">{n.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] line-clamp-2">
                    {n.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Assigned Learning Materials */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Latest Course Documents & Materials
            </h3>
            <p className="text-[11px] text-slate-400">Filtered strictly to your enrolled curriculum and batch.</p>
          </div>
          <button
            onClick={() => onNavigate('resources')}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span>All Documents</span>
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
        </div>

        {resources.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No learning materials uploaded for your cohort yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {resources.slice(0, 3).map((r) => (
              <div
                key={r.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-3"
              >
                <div>
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">
                    {r.category}
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                    {r.title}
                  </h4>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400 font-mono">{r.fileSize || 'Link'}</span>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
