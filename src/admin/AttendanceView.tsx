import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { Course, Batch, MeetingSession, AttendanceRecord, AttendanceStatus } from '../types/index.ts';
import {
  CheckSquare,
  Users,
  Save,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  HelpCircle,
  Edit2,
  X,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

export const AttendanceView: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [meetings, setMeetings] = useState<MeetingSession[]>([]);

  // Selection state
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState('');

  // Roster and marks
  const [roster, setRoster] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Correction Modal State (BR-27)
  const [correctingRecord, setCorrectingRecord] = useState<any | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<AttendanceStatus>('present');
  const [correctionRemarks, setCorrectionRemarks] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionLoading, setCorrectionLoading] = useState(false);

  const loadInitial = async () => {
    try {
      const [crsRes, bchRes] = await Promise.all([api.getCourses(), api.getBatches()]);
      setCourses(crsRes.courses);
      setBatches(bchRes.batches);

      if (crsRes.courses.length > 0) {
        setSelectedCourseId(crsRes.courses[0].id);
        const matchingBatches = bchRes.batches.filter((b) => b.courseId === crsRes.courses[0].id);
        if (matchingBatches.length > 0) {
          setSelectedBatchId(matchingBatches[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadInitial();
  }, []);

  // When selectedBatchId changes, load meetings for this batch
  useEffect(() => {
    if (!selectedBatchId) return;
    const fetchMeetings = async () => {
      try {
        const res = await api.getMeetings({ batchId: selectedBatchId });
        setMeetings(res.meetings);
        if (res.meetings.length > 0) {
          setSelectedMeetingId(res.meetings[0].id);
        } else {
          setSelectedMeetingId('');
          setRoster([]);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchMeetings();
  }, [selectedBatchId]);

  // When selectedMeetingId changes, load roster and existing attendance
  useEffect(() => {
    if (!selectedMeetingId) {
      setRoster([]);
      return;
    }
    const loadSessionRoster = async () => {
      setLoading(true);
      try {
        const res = await api.getSessionAttendance(selectedMeetingId);
        setRoster(res.roster);

        const initialMarks: Record<string, { status: AttendanceStatus; remarks: string }> = {};
        res.roster.forEach((cand: any) => {
          initialMarks[cand.candidateId] = {
            status: cand.status === 'unmarked' ? 'present' : cand.status,
            remarks: cand.remarks || '',
          };
        });
        setMarks(initialMarks);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadSessionRoster();
  }, [selectedMeetingId]);

  const handleStatusChange = (candidateId: string, status: AttendanceStatus) => {
    setMarks((prev) => ({
      ...prev,
      [candidateId]: {
        ...prev[candidateId],
        status,
      },
    }));
  };

  const handleRemarksChange = (candidateId: string, remarks: string) => {
    setMarks((prev) => ({
      ...prev,
      [candidateId]: {
        ...prev[candidateId],
        remarks,
      },
    }));
  };

  const handleMarkAllPresent = () => {
    const updated = { ...marks };
    roster.forEach((c) => {
      updated[c.candidateId] = {
        ...updated[c.candidateId],
        status: 'present',
      };
    });
    setMarks(updated);
  };

  const handleSaveAttendance = async () => {
    if (!selectedMeetingId) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      const recordsToSave = roster.map((c) => ({
        candidateId: c.candidateId,
        status: marks[c.candidateId]?.status || 'present',
        remarks: marks[c.candidateId]?.remarks || '',
      }));

      await api.markAttendance(selectedMeetingId, recordsToSave);
      setStatusMessage('Attendance saved and verified in permanent ledger.');

      // Reload
      const res = await api.getSessionAttendance(selectedMeetingId);
      setRoster(res.roster);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const handleResetAttendance = async () => {
    if (!selectedMeetingId) return;
    if (!confirm('Are you sure you want to clear/reset recorded attendance for this session?')) return;
    try {
      await api.resetSessionAttendance(selectedMeetingId);
      const res = await api.getSessionAttendance(selectedMeetingId);
      setRoster(res.roster);
      setStatusMessage('Session attendance reset successfully.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to reset attendance');
    }
  };

  const handleOpenCorrection = (cand: any) => {
    setCorrectingRecord(cand);
    setCorrectionStatus(cand.status);
    setCorrectionRemarks(cand.remarks || '');
    setCorrectionReason('');
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingRecord || !correctingRecord.recordId) return;
    setCorrectionLoading(true);
    try {
      await api.correctAttendance(correctingRecord.recordId, {
        status: correctionStatus,
        remarks: correctionRemarks,
        correctionReason,
      });

      // Reload
      const res = await api.getSessionAttendance(selectedMeetingId);
      setRoster(res.roster);
      setCorrectingRecord(null);
      alert('Attendance correction recorded with mandatory audit log.');
    } catch (err: any) {
      alert(err.message || 'Correction failed');
    } finally {
      setCorrectionLoading(false);
    }
  };

  const currentMeeting = meetings.find((m) => m.id === selectedMeetingId);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Manual Attendance Recording & Corrections
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Super Admin authoritative roll-call per session. Enforces unique attendance per candidate and auditability of corrections (PRD BR-25, BR-27).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllPresent}
            disabled={roster.length === 0}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            Mark All Present
          </button>
          <button
            onClick={handleResetAttendance}
            disabled={roster.length === 0}
            title="Clear all recorded attendance for this session"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            onClick={handleSaveAttendance}
            disabled={saving || roster.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Recording...' : 'Save Attendance'}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Selectors Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            1. Select Course
          </label>
          <select
            value={selectedCourseId}
            onChange={(e) => {
              setSelectedCourseId(e.target.value);
              const matching = batches.filter((b) => b.courseId === e.target.value);
              setSelectedBatchId(matching.length > 0 ? matching[0].id : '');
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
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            2. Select Batch Cohort
          </label>
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            {batches
              .filter((b) => b.courseId === selectedCourseId)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            3. Select Meeting Session
          </label>
          <select
            value={selectedMeetingId}
            onChange={(e) => setSelectedMeetingId(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            {meetings.length === 0 ? (
              <option value="">No sessions for this batch</option>
            ) : (
              meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.date} — {m.title} ({m.startTime})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Roster & Attendance Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Candidate Roll Call: {currentMeeting?.title || 'Selected Session'}
            </h3>
            {currentMeeting && (
              <p className="text-[11px] text-slate-500">
                Date: {currentMeeting.date} ({currentMeeting.startTime} - {currentMeeting.endTime}) · Tutor: {currentMeeting.tutorName}
              </p>
            )}
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {roster.length} eligible candidates
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
            Loading candidate roster and previous marks...
          </div>
        ) : roster.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No candidates enrolled in this batch or no session selected.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Candidate ID</th>
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">Attendance Status</th>
                  <th className="py-3 px-4">Remarks</th>
                  <th className="py-3 px-4 text-right">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {roster.map((cand) => {
                  const currentStatus = marks[cand.candidateId]?.status || 'present';
                  const currentRemarks = marks[cand.candidateId]?.remarks || '';

                  return (
                    <tr key={cand.candidateId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-white tabular-nums">
                        {cand.candidateCustomId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{cand.candidateName}</div>
                        <div className="text-[11px] text-slate-500">{cand.candidateEmail}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleStatusChange(cand.candidateId, st)}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold capitalize transition-all ${
                                currentStatus === st
                                  ? st === 'present'
                                    ? 'bg-emerald-600 text-white'
                                    : st === 'late'
                                    ? 'bg-amber-600 text-white'
                                    : st === 'absent'
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-slate-700 text-white'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={currentRemarks}
                          onChange={(e) => handleRemarksChange(cand.candidateId, e.target.value)}
                          placeholder="Optional notes..."
                          className="w-full px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        {cand.recordId ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Recorded</span>
                            </span>
                            <button
                              onClick={() => handleOpenCorrection(cand)}
                              title="Make audit-logged correction"
                              className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Unsubmitted</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Formal Attendance Correction (BR-27) */}
      {correctingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Correct Attendance Record
                </h3>
                <p className="text-xs text-slate-500">
                  Per PRD BR-27: Corrections require an explicit reason and generate an audit log.
                </p>
              </div>
              <button
                onClick={() => setCorrectingRecord(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCorrection} className="space-y-3.5">
              <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg">
                <div>Candidate: <strong>{correctingRecord.candidateName}</strong> ({correctingRecord.candidateCustomId})</div>
                <div>Previously Recorded Status: <strong className="capitalize">{correctingRecord.status}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Amended Status *
                </label>
                <select
                  value={correctionStatus}
                  onChange={(e) => setCorrectionStatus(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="excused">Excused</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Correction (Mandatory) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Candidate joined late due to verified connectivity outage."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Updated Remarks
                </label>
                <input
                  type="text"
                  value={correctionRemarks}
                  onChange={(e) => setCorrectionRemarks(e.target.value)}
                  placeholder="Additional operational note"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCorrectingRecord(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={correctionLoading}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {correctionLoading ? 'Saving...' : 'Commit Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
