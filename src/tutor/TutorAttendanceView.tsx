import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { MeetingSession, Batch, AttendanceRecord } from '../types/index.ts';
import {
  CheckSquare,
  Users,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock3,
  HelpCircle,
  Save,
  Lock,
  Edit2,
  Info,
} from 'lucide-react';

interface TutorAttendanceViewProps {
  initialSessionId?: string | null;
}

export const TutorAttendanceView: React.FC<TutorAttendanceViewProps> = ({
  initialSessionId,
}) => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<MeetingSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId || '');
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Session attendance payload
  const [sessionData, setSessionData] = useState<{
    session: MeetingSession;
    batch: Batch | null;
    attendance: AttendanceRecord[];
    summary: {
      total: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
      unmarked: number;
    };
    canEditAttendance: boolean;
    canRecordAttendance: boolean;
    isWindowExpired: boolean;
    windowHours: number;
  } | null>(null);

  // Roster entries being edited
  const [rosterDraft, setRosterDraft] = useState<
    Array<{
      candidateId: string;
      candidateName: string;
      candidateCustomId: string;
      status: 'present' | 'absent' | 'late' | 'excused';
      remarks: string;
      existingRecordId?: string;
    }>
  >([]);

  // Correction Modal
  const [correctingRecord, setCorrectingRecord] = useState<{
    id: string;
    candidateName: string;
    currentStatus: string;
    newStatus: 'present' | 'absent' | 'late' | 'excused';
    correctionReason: string;
    remarks: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Load tutor meetings to populate the session selector
  const loadMeetings = async () => {
    try {
      setLoading(true);
      const res = await api.getTutorMeetings();
      setMeetings(res.meetings);
      if (!selectedSessionId && res.meetings.length > 0) {
        setSelectedSessionId(res.meetings[0].id);
      }
    } catch (err) {
      console.error('Failed to load meetings for attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  // 2. Load selected session attendance details
  const loadSessionAttendance = async (sessionId: string) => {
    if (!sessionId) return;
    setSessionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await api.getTutorSessionAttendance(sessionId);
      setSessionData(res);

      // If batch roster exists, map existing records or populate from batch candidates
      if (res.attendance && res.attendance.length > 0) {
        setRosterDraft(
          res.attendance.map((rec) => ({
            candidateId: rec.candidateId,
            candidateName: rec.candidateName || 'Candidate',
            candidateCustomId: rec.candidateCustomId || '',
            status: rec.status,
            remarks: rec.remarks || '',
            existingRecordId: rec.id,
          }))
        );
      } else {
        // Fetch batch roster to populate default list
        const batchRes = await api.getTutorBatchById(res.session.batchId);
        setRosterDraft(
          batchRes.roster.map((c) => ({
            candidateId: c.id,
            candidateName: c.name,
            candidateCustomId: c.candidateId,
            status: 'present', // Default to present for convenience
            remarks: '',
          }))
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load session attendance');
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      loadSessionAttendance(selectedSessionId);
    }
  }, [selectedSessionId]);

  const handleStatusChange = (index: number, newStatus: 'present' | 'absent' | 'late' | 'excused') => {
    setRosterDraft((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status: newStatus };
      return updated;
    });
  };

  const handleRemarksChange = (index: number, newRemarks: string) => {
    setRosterDraft((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], remarks: newRemarks };
      return updated;
    });
  };

  const setAllStatus = (status: 'present' | 'absent') => {
    setRosterDraft((prev) => prev.map((entry) => ({ ...entry, status })));
  };

  const handleSaveAttendance = async () => {
    if (!selectedSessionId || rosterDraft.length === 0) return;
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const recordsToSubmit = rosterDraft.map((d) => ({
        candidateId: d.candidateId,
        status: d.status,
        remarks: d.remarks || undefined,
      }));
      await api.markTutorAttendance(selectedSessionId, recordsToSubmit);
      setSuccessMessage('Attendance roll call submitted and saved successfully.');
      await loadSessionAttendance(selectedSessionId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCorrection = async () => {
    if (!correctingRecord) return;
    if (!correctingRecord.correctionReason.trim()) {
      alert('Please provide a reason for correcting this attendance record.');
      return;
    }
    setSaving(true);
    try {
      await api.correctTutorAttendance(correctingRecord.id, {
        status: correctingRecord.newStatus,
        remarks: correctingRecord.remarks || undefined,
        correctionReason: correctingRecord.correctionReason.trim(),
      });
      setCorrectingRecord(null);
      setSuccessMessage('Attendance correction submitted successfully.');
      await loadSessionAttendance(selectedSessionId);
    } catch (err: any) {
      alert(err.message || 'Failed to correct attendance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            <span>Meeting Attendance & Roll Call</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Conduct student roll calls for assigned sessions and manage records within your designated editing window.
          </p>
        </div>
      </div>

      {/* Session Selector Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="w-full md:w-96">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Select Class Session:
          </label>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {meetings.length === 0 ? (
              <option value="">No sessions scheduled</option>
            ) : (
              meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.date} · {m.title} ({m.batchName}) - {m.status.toUpperCase()}
                </option>
              ))
            )}
          </select>
        </div>

        {sessionData?.session && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
            <div>
              <span className="text-slate-400 block text-[10px]">Batch:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {sessionData.session.batchName}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Timing:</span>
              <span className="font-medium">
                {sessionData.session.startTime} - {sessionData.session.endTime}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Status:</span>
              <span className="font-medium text-emerald-600">
                {sessionData.session.status.toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Alert Messages */}
      {successMessage && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Permission Restriction Notice */}
      {sessionData && !sessionData.canRecordAttendance && (
        <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
          <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-900 dark:text-white">
              Attendance Marking Restricted
            </span>
            <p className="mt-0.5 text-slate-500">
              The Super Administrator currently manages attendance records for this application. If you require permission to record session attendance directly, please contact the administrator.
            </p>
          </div>
        </div>
      )}

      {/* Window Expired Notice */}
      {sessionData && sessionData.isWindowExpired && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            The {sessionData.windowHours}-hour editing window for this session has closed. Contact the administrator for retroactive updates.
          </span>
        </div>
      )}

      {/* Session Attendance Summary Cards */}
      {sessionData?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Total Enrolled</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {sessionData.summary.total}
            </div>
          </div>

          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-3 rounded-xl">
            <span className="text-[10px] uppercase font-semibold text-emerald-600">Present</span>
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
              {sessionData.summary.present}
            </div>
          </div>

          <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 p-3 rounded-xl">
            <span className="text-[10px] uppercase font-semibold text-rose-600">Absent</span>
            <div className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">
              {sessionData.summary.absent}
            </div>
          </div>

          <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 p-3 rounded-xl">
            <span className="text-[10px] uppercase font-semibold text-amber-600">Late</span>
            <div className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">
              {sessionData.summary.late}
            </div>
          </div>

          <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 p-3 rounded-xl">
            <span className="text-[10px] uppercase font-semibold text-blue-600">Excused</span>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-1">
              {sessionData.summary.excused}
            </div>
          </div>
        </div>
      )}

      {/* Roster Roll Call Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Roll Call Roster ({rosterDraft.length} Students)
            </h3>
          </div>

          {sessionData?.canRecordAttendance && !sessionData?.isWindowExpired && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAllStatus('present')}
                className="px-2.5 py-1 text-xs rounded border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                Mark All Present
              </button>
              <button
                type="button"
                onClick={() => setAllStatus('absent')}
                className="px-2.5 py-1 text-xs rounded border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                Mark All Absent
              </button>
            </div>
          )}
        </div>

        {sessionLoading ? (
          <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
            Loading session roster and attendance records...
          </div>
        ) : rosterDraft.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No enrolled students found for this session's batch.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-2.5">Student</th>
                  <th className="pb-2.5">ID</th>
                  <th className="pb-2.5">Roll Call Status</th>
                  <th className="pb-2.5">Remarks</th>
                  {sessionData?.canEditAttendance && <th className="pb-2.5 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rosterDraft.map((student, idx) => (
                  <tr key={student.candidateId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 font-semibold text-slate-900 dark:text-white">
                      {student.candidateName}
                    </td>
                    <td className="py-3 font-mono text-[11px] text-slate-500">
                      {student.candidateCustomId}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        {(['present', 'absent', 'late', 'excused'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            disabled={!sessionData?.canRecordAttendance || sessionData?.isWindowExpired}
                            onClick={() => handleStatusChange(idx, st)}
                            className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors capitalize ${
                              student.status === st
                                ? st === 'present'
                                  ? 'bg-emerald-600 text-white'
                                  : st === 'absent'
                                  ? 'bg-rose-600 text-white'
                                  : st === 'late'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3">
                      <input
                        type="text"
                        disabled={!sessionData?.canRecordAttendance || sessionData?.isWindowExpired}
                        value={student.remarks}
                        onChange={(e) => handleRemarksChange(idx, e.target.value)}
                        placeholder="Optional note..."
                        className="w-full max-w-xs px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </td>
                    {sessionData?.canEditAttendance && (
                      <td className="py-3 text-right">
                        {student.existingRecordId && !sessionData?.isWindowExpired ? (
                          <button
                            type="button"
                            onClick={() =>
                              setCorrectingRecord({
                                id: student.existingRecordId!,
                                candidateName: student.candidateName,
                                currentStatus: student.status,
                                newStatus: student.status,
                                correctionReason: '',
                                remarks: student.remarks,
                              })
                            }
                            className="p-1 rounded text-slate-500 hover:text-blue-600"
                            title="Correct Attendance Record"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Save Bar */}
        {sessionData?.canRecordAttendance && !sessionData?.isWindowExpired && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={handleSaveAttendance}
              disabled={saving || rosterDraft.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-sm disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Submitting...' : 'Save Attendance Roll Call'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ===================== CORRECTION MODAL ===================== */}
      {correctingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Correct Attendance: {correctingRecord.candidateName}
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Updated Status *
              </label>
              <select
                value={correctingRecord.newStatus}
                onChange={(e) =>
                  setCorrectingRecord({
                    ...correctingRecord,
                    newStatus: e.target.value as any,
                  })
                }
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="excused">Excused</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reason for Correction *
              </label>
              <textarea
                required
                rows={2}
                value={correctingRecord.correctionReason}
                onChange={(e) =>
                  setCorrectingRecord({
                    ...correctingRecord,
                    correctionReason: e.target.value,
                  })
                }
                placeholder="e.g. Joined class late after audio technical difficulties..."
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCorrectingRecord(null)}
                className="px-3.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCorrection}
                disabled={saving}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {saving ? 'Submitting...' : 'Save Correction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
