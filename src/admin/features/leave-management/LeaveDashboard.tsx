import React from 'react';
import type { LeaveApplication, LeaveType, LeavePolicy } from '../../../types/index.ts';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertCircle,
  ArrowRight,
  Settings,
  BarChart3,
  FileText,
  Eye,
  ShieldCheck,
} from 'lucide-react';

interface LeaveDashboardProps {
  applications: LeaveApplication[];
  leaveTypes: LeaveType[];
  policy: LeavePolicy;
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
    totalApprovedDays: number;
  };
  onNavigateTab: (tab: 'dashboard' | 'applications' | 'reports') => void;
  onOpenSettings: () => void;
  onSelectApplication: (app: LeaveApplication) => void;
  onQuickApprove: (app: LeaveApplication) => void;
  onQuickReject: (app: LeaveApplication) => void;
}

export const LeaveDashboard: React.FC<LeaveDashboardProps> = ({
  applications,
  leaveTypes,
  policy,
  summary,
  onNavigateTab,
  onOpenSettings,
  onSelectApplication,
  onQuickApprove,
  onQuickReject,
}) => {
  const recentApps = [...applications].slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Policy and Configuration Overview Alert */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Active Leave Calculation Policy:</span>
              <span className="capitalize px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-mono text-[11px]">
                {policy.calculationMode === 'working_days' ? 'Working Days (Excluding Weekends)' : 'Calendar Days'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              Retrospective leave submission is currently{' '}
              <span className="font-semibold">{policy.allowRetrospective ? 'ENABLED' : 'DISABLED'}</span>. Max consecutive duration is{' '}
              <span className="font-semibold">{policy.maxConsecutiveDays} days</span>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configure Policy & Types</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {summary.total}
          </div>
          <span className="text-[10px] text-slate-400">submitted applications</span>
        </div>

        <div
          onClick={() => onNavigateTab('applications')}
          className={`cursor-pointer bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-xs transition-all hover:border-amber-400 ${
            summary.pending > 0
              ? 'border-amber-300 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/10'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums flex items-center gap-1.5">
            <span>{summary.pending}</span>
            {summary.pending > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <span className="text-[10px] text-amber-600/80 font-medium">needs review</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Approved</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {summary.approved}
          </div>
          <span className="text-[10px] text-slate-400">granted leaves</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Rejected</span>
            <XCircle className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
            {summary.rejected}
          </div>
          <span className="text-[10px] text-slate-400">with reason</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Cancelled</span>
            <RotateCcw className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-700 dark:text-slate-300 tabular-nums">
            {summary.cancelled}
          </div>
          <span className="text-[10px] text-slate-400">withdrawn/revoked</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Leave Days</span>
            <Calendar className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
            {summary.totalApprovedDays}
          </div>
          <span className="text-[10px] text-slate-400">total approved days</span>
        </div>
      </div>

      {/* Recent Leave Applications Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Recent Leave Submissions
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              The latest candidate leave applications requiring review or attention.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('applications')}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>View All Applications</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentApps.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No leave applications have been submitted yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {recentApps.map((app) => (
              <div
                key={app.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 rounded-xl px-2 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 font-bold text-xs mt-0.5">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {app.candidateName}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {app.candidateCustomId}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {app.leaveTypeName}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {app.startDate} to {app.endDate} · {app.totalDays} Day{app.totalDays === 1 ? '' : 's'}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1 italic">
                      "{app.reason}"
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                      app.status === 'pending'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                        : app.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : app.status === 'rejected'
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {app.status}
                  </span>

                  <button
                    onClick={() => onSelectApplication(app)}
                    title="View Application Details"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  {app.status === 'pending' && (
                    <>
                      <button
                        onClick={() => onQuickApprove(app)}
                        title="Approve"
                        className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onQuickReject(app)}
                        title="Reject"
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 dark:border-rose-800"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

