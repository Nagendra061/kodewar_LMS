import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { MeetingSession, Course, Batch, Tutor } from '../types/index.ts';
import {
  Calendar,
  Clock,
  Radio,
  Plus,
  Repeat,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Edit2,
  ExternalLink,
  Filter,
  Check,
  X,
  Shield,
  Video,
  Trash2,
} from 'lucide-react';

export const MeetingSchedulerView: React.FC = () => {
  const [meetings, setMeetings] = useState<MeetingSession[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [batchFilter, setBatchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Modals
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingSession, setEditingSession] = useState<MeetingSession | null>(null);
  const [cancellingSession, setCancellingSession] = useState<MeetingSession | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionAlert, setActionAlert] = useState<string | null>(null);

  // Single Meeting Form State
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [tutorId, setTutorId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:30');
  const [meetingPlatform, setMeetingPlatform] = useState('Google Meet');
  const [meetingUrl, setMeetingUrl] = useState('https://meet.google.com/kdl-session');
  const [description, setDescription] = useState('');
  const [singleFormError, setSingleFormError] = useState<string | null>(null);

  // Recurring Series Form State
  const [recTitle, setRecTitle] = useState('');
  const [recCourseId, setRecCourseId] = useState('');
  const [recBatchId, setRecBatchId] = useState('');
  const [recTutorId, setRecTutorId] = useState('');
  const [recStartDate, setRecStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [recEndDate, setRecEndDate] = useState('');
  const [maxOccurrences, setMaxOccurrences] = useState('8');
  const [recStartTime, setRecStartTime] = useState('10:00');
  const [recEndTime, setRecEndTime] = useState('11:30');
  const [recPlatform, setRecPlatform] = useState('Google Meet');
  const [recUrl, setRecUrl] = useState('https://meet.google.com/kdl-recurring');
  const [recurrenceRule, setRecurrenceRule] = useState<'daily' | 'weekly' | 'custom_weekdays'>('weekly');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]); // Mon, Wed, Fri
  const [recDescription, setRecDescription] = useState('');
  const [recurringPreviewDates, setRecurringPreviewDates] = useState<string[]>([]);
  const [recurringLoading, setRecurringLoading] = useState(false);

  // Reschedule Form State
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStartTime, setRescheduleStartTime] = useState('');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [meetRes, crsRes, bchRes, tutRes] = await Promise.all([
        api.getMeetings({
          batchId: batchFilter || undefined,
          status: statusFilter || undefined,
        }),
        api.getCourses(),
        api.getBatches(),
        api.getTutors(),
      ]);

      setMeetings(meetRes.meetings);
      setCourses(crsRes.courses);
      setBatches(bchRes.batches);
      setTutors(tutRes.tutors);

      if (crsRes.courses.length > 0 && !courseId) {
        setCourseId(crsRes.courses[0].id);
        setRecCourseId(crsRes.courses[0].id);
        const bchs = bchRes.batches.filter((b) => b.courseId === crsRes.courses[0].id);
        if (bchs.length > 0) {
          setBatchId(bchs[0].id);
          setRecBatchId(bchs[0].id);
        }
      }
      if (tutRes.tutors.length > 0 && !tutorId) {
        setTutorId(tutRes.tutors[0].id);
        setRecTutorId(tutRes.tutors[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [batchFilter, statusFilter]);

  // Recalculate preview dates for recurring scheduler
  useEffect(() => {
    if (!recStartDate) return;
    const start = new Date(recStartDate);
    const end = recEndDate ? new Date(recEndDate) : new Date(start.getTime() + 60 * 24 * 60 * 60 * 1000);
    const limit = Number(maxOccurrences) || 8;
    const dates: string[] = [];
    let current = new Date(start);

    while (current <= end && dates.length < limit) {
      const day = current.getDay();
      let match = false;
      if (recurrenceRule === 'daily') match = true;
      else if (recurrenceRule === 'weekly') match = day === start.getDay();
      else if (recurrenceRule === 'custom_weekdays') match = selectedDays.includes(day);

      if (match) {
        dates.push(current.toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }
    setRecurringPreviewDates(dates);
  }, [recStartDate, recEndDate, maxOccurrences, recurrenceRule, selectedDays]);

  const handleToggleAccess = async (session: MeetingSession) => {
    const nextStatus = session.accessStatus === 'enabled' ? 'disabled' : 'enabled';
    try {
      await api.setMeetingAccess(session.id, nextStatus);
      setActionAlert(`Meeting access for "${session.title}" changed to ${nextStatus.toUpperCase()}.`);
      loadData();
      setTimeout(() => setActionAlert(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update access status');
    }
  };

  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleFormError(null);
    try {
      const res = await api.createMeeting({
        title,
        courseId,
        batchId,
        tutorId,
        date,
        startTime,
        endTime,
        meetingPlatform,
        meetingUrl,
        description,
      });

      if (res.hasTutorConflict) {
        alert(`Warning: ${res.conflictWarning}`);
      }

      setShowSingleModal(false);
      setTitle('');
      setDescription('');
      loadData();
    } catch (err: any) {
      setSingleFormError(err.message || 'Failed to create meeting');
    }
  };

  const handleCreateRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecurringLoading(true);
    try {
      const res = await api.createRecurringMeetings({
        title: recTitle,
        courseId: recCourseId,
        batchId: recBatchId,
        tutorId: recTutorId,
        startDate: recStartDate,
        endDate: recEndDate || undefined,
        maxOccurrences: Number(maxOccurrences),
        startTime: recStartTime,
        endTime: recEndTime,
        meetingPlatform: recPlatform,
        meetingUrl: recUrl,
        recurrenceRule,
        selectedDays,
        description: recDescription,
      });

      alert(`Generated ${res.occurrencesCount} meeting occurrences successfully!`);
      setShowRecurringModal(false);
      setRecTitle('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to generate recurring series');
    } finally {
      setRecurringLoading(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;
    try {
      await api.updateMeeting(editingSession.id, {
        date: rescheduleDate,
        startTime: rescheduleStartTime,
        endTime: rescheduleEndTime,
        rescheduleReason,
      });
      setEditingSession(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to reschedule meeting');
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingSession) return;
    try {
      await api.cancelMeeting(cancellingSession.id, cancelReason);
      setCancellingSession(null);
      setCancelReason('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel meeting');
    }
  };

  const handleMarkCompleted = async (id: string) => {
    if (!confirm('Mark this meeting session as completed? Access will be closed.')) return;
    try {
      await api.completeMeeting(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to mark session as completed');
    }
  };

  const handleDeleteMeeting = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete session "${title}"?\n\nThis will remove the meeting and all related attendance records.`)) {
      return;
    }
    try {
      await api.deleteMeeting(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete meeting');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Meeting Scheduler & Access Control
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Schedule individual or recurring cohorts. Control candidate access independently per session (PRD BR-16).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setRecTitle('Full-Stack Lab Workshop');
              setShowRecurringModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Repeat className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Recurring Series</span>
          </button>

          <button
            onClick={() => {
              setTitle('');
              setSingleFormError(null);
              setShowSingleModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Session</span>
          </button>
        </div>
      </div>

      {actionAlert && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <span>{actionAlert}</span>
        </div>
      )}

      {/* Access Rule Banner */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-400 flex items-start gap-3">
        <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Security & Meeting URL Isolation Rule (BR-16, BR-20):
          </span>{' '}
          All sessions default to <em>Access Disabled</em>. The backend strips and conceals the meeting URL from candidate API responses until you toggle <strong>Enable Access</strong>. Once a candidate opens the external meeting URL, external platform host controls apply.
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 text-xs font-medium rounded ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            List Agenda
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1 text-xs font-medium rounded ${
              viewMode === 'calendar'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Calendar Grid
          </button>
        </div>
      </div>

      {/* Meetings List View */}
      {viewMode === 'list' ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Session Title</th>
                  <th className="py-3 px-4">Batch & Tutor</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Access Status (BR-16)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {meetings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No meetings found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  meetings.map((m) => {
                    const isAccessEnabled = m.accessStatus === 'enabled';
                    const isCancelled = m.status === 'cancelled';
                    const isCompleted = m.status === 'completed';

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 tabular-nums">
                          <div className="font-semibold text-slate-900 dark:text-white">{m.date}</div>
                          <div className="text-[11px] text-slate-500">
                            {m.startTime} - {m.endTime} ({m.timezone})
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-medium text-slate-900 dark:text-white truncate">
                            {m.title}
                          </div>
                          {m.description && (
                            <div className="text-[11px] text-slate-500 truncate">{m.description}</div>
                          )}
                          {m.rescheduleReason && (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400">
                              Rescheduled: {m.rescheduleReason}
                            </div>
                          )}
                          {m.cancelReason && (
                            <div className="text-[10px] text-rose-600 dark:text-rose-400">
                              Cancelled: {m.cancelReason}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-900 dark:text-white">{m.batchName}</div>
                          <div className="text-[11px] text-slate-500">Tutor: {m.tutorName}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded ${
                              m.status === 'scheduled'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                : m.status === 'completed'
                                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {isCancelled || isCompleted ? (
                            <span className="text-[11px] text-slate-400 italic">Locked ({m.status})</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleToggleAccess(m)}
                                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${
                                  isAccessEnabled
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-rose-100 hover:text-rose-800'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-emerald-600 hover:text-white'
                                }`}
                                title={isAccessEnabled ? 'Click to revoke access' : 'Click to enable access for candidates'}
                              >
                                <Radio className="w-3 h-3" />
                                <span>{isAccessEnabled ? 'Enabled (Joinable)' : 'Disabled'}</span>
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!isCancelled && !isCompleted && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingSession(m);
                                    setRescheduleDate(m.date);
                                    setRescheduleStartTime(m.startTime);
                                    setRescheduleEndTime(m.endTime);
                                    setRescheduleReason('');
                                  }}
                                  title="Reschedule session"
                                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setCancellingSession(m);
                                    setCancelReason('');
                                  }}
                                  title="Cancel session"
                                  className="p-1.5 rounded hover:bg-rose-50 text-rose-600"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleMarkCompleted(m.id)}
                                  title="Mark as Completed"
                                  className="p-1.5 rounded hover:bg-slate-100 text-slate-600 dark:text-slate-300"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteMeeting(m.id, m.title)}
                              title="Delete Session"
                              className="p-1.5 rounded hover:bg-rose-50 text-rose-600 dark:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Calendar / Schedule Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {meetings.map((m) => {
            const isAccessEnabled = m.accessStatus === 'enabled';
            return (
              <div
                key={m.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-900 dark:text-white">{m.date}</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {m.startTime} - {m.endTime}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                    {m.title}
                  </h4>
                  <div className="text-xs text-slate-500 mt-1">
                    {m.batchName} · Tutor: {m.tutorName}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span
                    className={`text-[11px] font-semibold ${
                      isAccessEnabled ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {isAccessEnabled ? 'Joinable' : 'Access Disabled'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {m.status === 'scheduled' && (
                      <button
                        onClick={() => handleToggleAccess(m)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold ${
                          isAccessEnabled ? 'bg-rose-50 text-rose-700' : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {isAccessEnabled ? 'Disable' : 'Enable Access'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteMeeting(m.id, m.title)}
                      title="Delete Session"
                      className="p-1 rounded hover:bg-rose-50 text-rose-600 dark:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Schedule Single Meeting */}
      {showSingleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Schedule Single Meeting Occurrence
              </h3>
              <button
                onClick={() => setShowSingleModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {singleFormError && (
              <div className="mb-3 p-3 bg-rose-50 text-rose-700 rounded-lg text-xs">{singleFormError}</div>
            )}

            <form onSubmit={handleCreateSingle} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Session Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Distributed State & Concurrency"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Course *
                  </label>
                  <select
                    value={courseId}
                    onChange={(e) => {
                      setCourseId(e.target.value);
                      const matching = batches.filter((b) => b.courseId === e.target.value);
                      if (matching.length > 0) setBatchId(matching[0].id);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Batch *
                  </label>
                  <select
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {batches
                      .filter((b) => b.courseId === courseId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Tutor *
                  </label>
                  <select
                    value={tutorId}
                    onChange={(e) => setTutorId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {tutors.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.specialization})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Meeting URL (Google Meet / External) *
                </label>
                <input
                  type="url"
                  required
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://meet.google.com/xyz-abcd-efg"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Session Description & Instructions
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Topics, prerequisites, or preparation notes..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSingleModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-xs font-semibold"
                >
                  Schedule Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Schedule Recurring Series with Preview */}
      {showRecurringModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Schedule Recurring Meeting Series
                </h3>
                <p className="text-xs text-slate-500">
                  Per PRD §6.6: Generates independent occurrences with independent attendance and access state.
                </p>
              </div>
              <button
                onClick={() => setShowRecurringModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRecurring} className="flex-1 overflow-y-auto space-y-3.5 pr-1">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Series Base Title *
                </label>
                <input
                  type="text"
                  required
                  value={recTitle}
                  onChange={(e) => setRecTitle(e.target.value)}
                  placeholder="e.g. Full-Stack Engineering Workshop"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Course *
                  </label>
                  <select
                    value={recCourseId}
                    onChange={(e) => {
                      setRecCourseId(e.target.value);
                      const matching = batches.filter((b) => b.courseId === e.target.value);
                      if (matching.length > 0) setRecBatchId(matching[0].id);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Batch *
                  </label>
                  <select
                    value={recBatchId}
                    onChange={(e) => setRecBatchId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {batches
                      .filter((b) => b.courseId === recCourseId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Recurrence Cadence
                  </label>
                  <select
                    value={recurrenceRule}
                    onChange={(e) => setRecurrenceRule(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="daily">Daily</option>
                    <option value="custom_weekdays">Selected Weekdays</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={recStartDate}
                    onChange={(e) => setRecStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Max Sessions
                  </label>
                  <input
                    type="number"
                    max={20}
                    min={1}
                    value={maxOccurrences}
                    onChange={(e) => setMaxOccurrences(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={recStartTime}
                    onChange={(e) => setRecStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={recEndTime}
                    onChange={(e) => setRecEndTime(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Default Meeting URL
                </label>
                <input
                  type="url"
                  required
                  value={recUrl}
                  onChange={(e) => setRecUrl(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              {/* Preview of Generated Occurrences */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mb-1">
                  Occurrences Preview ({recurringPreviewDates.length} sessions generated)
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {recurringPreviewDates.map((d, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300"
                    >
                      Session {idx + 1}: {d}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRecurringModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recurringLoading || recurringPreviewDates.length === 0}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {recurringLoading ? 'Generating...' : `Confirm & Create Series`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reschedule Occurrence */}
      {editingSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
              Reschedule Session
            </h3>
            <p className="text-xs text-slate-500 mb-4">{editingSession.title}</p>

            <form onSubmit={handleRescheduleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  New Date *
                </label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={rescheduleStartTime}
                    onChange={(e) => setRescheduleStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={rescheduleEndTime}
                    onChange={(e) => setRescheduleEndTime(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Reschedule (Sent to candidates & audited) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Instructor travel schedule adjustment"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                >
                  Confirm Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cancel Session */}
      {cancellingSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-rose-600 mb-2">
              Cancel Session Occurrence
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Cancelling "{cancellingSession.title}" will revoke candidate join access and suppress reminders.
            </p>

            <form onSubmit={handleCancelSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Cancellation Reason (Mandatory) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Instructor emergency leave; makeup session will be scheduled next week."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCancellingSession(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                >
                  Keep Scheduled
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
