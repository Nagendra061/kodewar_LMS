import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { MeetingSession } from '../types/index.ts';
import {
  Calendar,
  Clock,
  Video,
  ExternalLink,
  Lock,
  Radio,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Info,
} from 'lucide-react';

export const CandidateMeetingsView: React.FC = () => {
  const [meetings, setMeetings] = useState<(MeetingSession & { isJoinable: boolean })[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'joinable' | 'upcoming' | 'completed' | 'cancelled'>('all');
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const loadMeetings = async () => {
    try {
      setLoading(true);
      const res = await api.getCandidateMeetings();
      setMeetings(res.meetings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
    const interval = setInterval(loadMeetings, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleJoin = async (id: string) => {
    setJoiningId(id);
    try {
      // Backend authorization request per PRD BR-20
      const res = await api.joinCandidateMeeting(id);
      window.open(res.meetingUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      alert(err.message || 'Unable to join meeting at this time.');
      loadMeetings();
    } finally {
      setJoiningId(null);
    }
  };

  const filteredMeetings = meetings.filter((m) => {
    if (activeTab === 'joinable') return m.isJoinable;
    if (activeTab === 'upcoming') return m.status === 'scheduled';
    if (activeTab === 'completed') return m.status === 'completed';
    if (activeTab === 'cancelled') return m.status === 'cancelled';
    return true;
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            My Cohort Meetings & Live Sessions
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Access-governed training sessions. Join links become active when your instructor unlocks entry.
          </p>
        </div>

        <button
          onClick={loadMeetings}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Schedule</span>
        </button>
      </div>

      {/* Explanatory Policy Note per PRD §6.6 / §7.2 */}
      <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 rounded-xl text-xs text-blue-900 dark:text-blue-300 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong>Meeting Access Guidance:</strong> The <em>Join Meeting</em> button is enabled only when your instructor manually enables entry for that session. Once you enter Google Meet, external host admission and controls apply.
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 text-xs overflow-x-auto pb-1">
        {[
          { id: 'all', label: `All (${meetings.length})` },
          { id: 'joinable', label: `Join Available (${meetings.filter((m) => m.isJoinable).length})` },
          { id: 'upcoming', label: `Upcoming (${meetings.filter((m) => m.status === 'scheduled').length})` },
          { id: 'completed', label: `Completed (${meetings.filter((m) => m.status === 'completed').length})` },
          { id: 'cancelled', label: `Cancelled (${meetings.filter((m) => m.status === 'cancelled').length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-2 px-2.5 font-semibold whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-slate-900 text-slate-900 dark:border-white dark:text-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Meeting Cards List */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-xs text-slate-400">
          No sessions in this filter view.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMeetings.map((session) => {
            const isJoinable = session.isJoinable;
            const isCancelled = session.status === 'cancelled';
            const isCompleted = session.status === 'completed';

            return (
              <div
                key={session.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {session.title}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      {session.batchName}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-xs text-slate-500">Instructor: {session.tutorName}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                        {session.date} · {session.startTime} - {session.endTime} ({session.timezone})
                      </span>
                    </div>
                    <span>·</span>
                    <span className="font-mono text-[11px] text-slate-500">{session.meetingPlatform}</span>
                  </div>

                  {session.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {session.description}
                    </p>
                  )}

                  {session.rescheduleReason && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg">
                      Reschedule Note: {session.rescheduleReason}
                    </div>
                  )}

                  {session.cancelReason && (
                    <div className="text-[11px] text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 p-2 rounded-lg">
                      Cancellation Reason: {session.cancelReason}
                    </div>
                  )}
                </div>

                {/* Join Button / Status State */}
                <div className="flex flex-col items-start md:items-end gap-1.5 shrink-0">
                  {isJoinable ? (
                    <button
                      onClick={() => handleJoin(session.id)}
                      disabled={joiningId === session.id}
                      className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-2 transition-all"
                    >
                      <Video className="w-4 h-4" />
                      <span>{joiningId === session.id ? 'Connecting...' : 'Join Meeting Now'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  ) : isCancelled ? (
                    <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Session Cancelled</span>
                    </span>
                  ) : isCompleted ? (
                    <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Session Finished</span>
                    </span>
                  ) : (
                    <div className="space-y-1 text-left md:text-right">
                      <button
                        disabled
                        className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                      >
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>Access Disabled</span>
                      </button>
                      <span className="text-[10px] text-slate-400 block">
                        Instructor unlocks access prior to start
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
