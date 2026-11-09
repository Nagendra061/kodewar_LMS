import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { MeetingSession, Batch } from '../types/index.ts';
import {
  Calendar,
  Clock,
  Video,
  ExternalLink,
  Users,
  Search,
  Filter,
  CheckCircle2,
  Lock,
  Unlock,
  AlertCircle,
  CheckSquare,
} from 'lucide-react';

interface TutorMeetingsViewProps {
  onSelectMeetingForAttendance?: (sessionId: string) => void;
}

export const TutorMeetingsView: React.FC<TutorMeetingsViewProps> = ({
  onSelectMeetingForAttendance,
}) => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<MeetingSession[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const tutorPermissions = (user as any)?.permissions || {};

  const loadData = async () => {
    try {
      setLoading(true);
      const [meetRes, batchRes] = await Promise.all([
        api.getTutorMeetings(),
        api.getTutorBatches(),
      ]);
      setMeetings(meetRes.meetings);
      setBatches(batchRes.batches);
    } catch (err) {
      console.error('Failed to load meetings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleAccess = async (meeting: MeetingSession) => {
    if (!tutorPermissions.canManageMeetingAccess) {
      alert('You do not have permission to modify student meeting access.');
      return;
    }
    const newStatus = meeting.accessStatus === 'enabled' ? 'disabled' : 'enabled';
    try {
      await api.setTutorMeetingAccess(meeting.id, newStatus);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update meeting access status');
    }
  };

  const filteredMeetings = meetings.filter((m) => {
    const matchesBatch = selectedBatchId === 'all' || m.batchId === selectedBatchId;
    const matchesStatus = selectedStatus === 'all' || m.status === selectedStatus;
    const matchesSearch =
      !searchTerm ||
      m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.batchName && m.batchName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesBatch && matchesStatus && matchesSearch;
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Video className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Assigned Live Sessions & Schedule</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Conduct scheduled interactive classes, manage student access gates, and record attendance for assigned cohorts.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search sessions by title or batch..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Batch Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 text-[11px] font-medium">Batch:</span>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[180px] truncate"
            >
              <option value="all">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 text-[11px] font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Meetings List */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Sessions Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm || selectedBatchId !== 'all' || selectedStatus !== 'all'
              ? 'No scheduled classes match your active filter criteria.'
              : 'There are currently no meetings scheduled for your assigned cohorts.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredMeetings.map((meeting) => (
            <div
              key={meeting.id}
              className={`bg-white dark:bg-slate-900 border rounded-xl p-5 shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                meeting.status === 'completed'
                  ? 'border-slate-200 dark:border-slate-800 opacity-90'
                  : meeting.status === 'cancelled'
                  ? 'border-rose-200 dark:border-rose-950/60 bg-rose-50/10'
                  : 'border-indigo-100 dark:border-indigo-950/60 hover:border-indigo-300'
              }`}
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {meeting.batchName || 'Assigned Batch'}
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      meeting.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : meeting.status === 'cancelled'
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                    }`}
                  >
                    {meeting.status.toUpperCase()}
                  </span>

                  {meeting.isRecurring && (
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      Recurring Series
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {meeting.title}
                </h3>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{meeting.date}</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {meeting.startTime} - {meeting.endTime} ({meeting.durationMinutes} mins)
                    </span>
                  </span>
                </div>
              </div>

              {/* Action Buttons & Access Controls */}
              <div className="flex flex-wrap items-center gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                {/* Meeting Link Button */}
                {tutorPermissions.canViewMeetingLinks && (meeting.meetingLink || (meeting as any).meetingUrl) ? (
                  <a
                    href={meeting.meetingLink || (meeting as any).meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Join Class</span>
                  </a>
                ) : (
                  <span
                    title="Meeting links are restricted by administrator"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Link Restricted</span>
                  </span>
                )}

                {/* Candidate Access Toggle (if tutor has permission) */}
                {tutorPermissions.canManageMeetingAccess && (
                  <button
                    type="button"
                    onClick={() => handleToggleAccess(meeting)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      meeting.accessStatus === 'enabled'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title="Toggle whether students can join this meeting"
                  >
                    {meeting.accessStatus === 'enabled' ? (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Students Allowed</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Gate Locked</span>
                      </>
                    )}
                  </button>
                )}

                {/* Attendance Action */}
                {onSelectMeetingForAttendance && (
                  <button
                    type="button"
                    onClick={() => onSelectMeetingForAttendance(meeting.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-amber-500" />
                    <span>Attendance</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

