import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { BarChart3, Download, Users, CheckCircle, Calendar, Layers } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await api.getReportsSummary();
        setSummary(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Operational Reports & CSV Exports
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Generate clean, auditable CSV reports for candidate enrollments, attendance summaries, and meeting schedules (PRD §18.1).
        </p>
      </div>

      {/* Export Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Candidates Export</h3>
              <p className="text-[11px] text-slate-500">Rosters, statuses & current batches</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Exports full candidate records including Candidate ID, registered email, phone, enrolled course, current batch, and activation status.
          </p>
          <a
            href="/api/reports/export/candidates"
            download
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Candidates CSV</span>
          </a>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Attendance Export</h3>
              <p className="text-[11px] text-slate-500">Session roll-calls & correction history</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Exports verified attendance rows across all sessions with status (Present, Late, Absent, Excused), remarks, and marker email.
          </p>
          <a
            href="/api/reports/export/attendance"
            download
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Attendance CSV</span>
          </a>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Meetings Schedule Export</h3>
              <p className="text-[11px] text-slate-500">All scheduled & completed sessions</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Exports dates, timings, batch links, tutor allocations, status, and manual access status states across your cohorts.
          </p>
          <a
            href="/api/reports/export/meetings"
            download
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Meetings CSV</span>
          </a>
        </div>
      </div>

      {/* Aggregate Metrics Breakdown */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Company Educational Metrics Summary
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60">
            <div className="text-[11px] text-slate-500">Candidate Enrollment</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
              {summary?.candidates?.total || 0}
            </div>
            <div className="text-[11px] text-emerald-600 mt-0.5">
              {summary?.candidates?.active || 0} currently active
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60">
            <div className="text-[11px] text-slate-500">Active Batches</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
              {summary?.academics?.activeBatches || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Across {summary?.academics?.courses || 0} curriculums
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60">
            <div className="text-[11px] text-slate-500">Attendance Ratio</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
              {summary?.attendance?.presentRate || 100}%
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {summary?.attendance?.totalRecords || 0} logged roll-calls
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60">
            <div className="text-[11px] text-slate-500">Total Sessions</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
              {(summary?.meetings?.upcoming || 0) + (summary?.meetings?.completed || 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {summary?.meetings?.completed || 0} finished
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
