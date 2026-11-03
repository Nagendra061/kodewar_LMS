import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { AttendanceRecord } from '../types/index.ts';
import { CheckSquare, CheckCircle2, Clock, XCircle, ShieldCheck, AlertCircle, HelpCircle } from 'lucide-react';

export const CandidateAttendanceView: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const res = await api.getCandidateAttendance();
        setRecords(res.records);
        setMetrics(res.metrics);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return (
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Present</span>
          </span>
        );
      case 'late':
        return (
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Late</span>
          </span>
        );
      case 'absent':
        return (
          <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-0.5 rounded flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            <span>Absent</span>
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded capitalize">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          My Session Attendance & Records
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Session-by-session roll-calls verified by your instructors (PRD §7.5). Read-only ledger.
        </p>
      </div>

      {/* Metrics Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {metrics?.attendanceRate || 100}%
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold uppercase">Overall</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Course Attendance Score
              </h3>
              <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                Calculated as{' '}
                <strong className="text-slate-700 dark:text-slate-300">
                  {metrics?.qualifyingAttended || 0} qualifying attended sessions
                </strong>{' '}
                divided by {metrics?.eligibleSessions || 0} eligible sessions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 text-center text-xs border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-6">
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
              <div className="text-[10px] text-slate-400 font-medium">Present</div>
              <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {metrics?.presentCount || 0}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
              <div className="text-[10px] text-slate-400 font-medium">Late</div>
              <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {metrics?.lateCount || 0}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
              <div className="text-[10px] text-slate-400 font-medium">Absent</div>
              <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {metrics?.absentCount || 0}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
              <div className="text-[10px] text-slate-400 font-medium">Excused</div>
              <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {metrics?.excusedCount || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session-by-Session Records Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Verified Roll-Call Ledger
          </h3>
          <span className="text-xs text-slate-400">{records.length} logged sessions</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
            Loading attendance history...
          </div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No attendance roll-calls recorded for your account yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Session Title</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Remarks</th>
                  <th className="py-3 px-4 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-900 dark:text-white font-medium">
                      {r.sessionDate}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{r.sessionTitle}</div>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(r.status)}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {r.remarks || '—'}
                      {r.correctionReason && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                          Amended: {r.correctionReason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-400">
                      Verified by Admin
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
