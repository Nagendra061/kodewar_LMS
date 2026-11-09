import React from 'react';
import type { LeaveApplication, LeavePolicy } from '../../../types/index.ts';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Plus,
  ArrowRight,
  Info,
  RotateCcw,
  Eye,
} from 'lucide-react';

interface CandidateLeaveOverviewProps {
  applications: LeaveApplication[];
  policy: LeavePolicy;
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
    totalApprovedDays: number;
  };
  onOpenApplyModal: () => void;
  onNavigateApplications: () => void;
  onSelectApplication: (app: LeaveApplication) => void;
}

export const CandidateLeaveOverview: React.FC<CandidateLeaveOverviewProps> = ({
  applications,
  policy,
  summary,
  onOpenApplyModal,
  onNavigateApplications,
  onSelectApplication,
}) => {
  const recentApps = [...applications].slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Top Banner / Callout */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <h2 className="text-lg font-bold tracking-tight">
            Candidate Leave Portal
          </h2>
          <p className="text-xs text-blue-100 leading-relaxed">
            Need time off from classes, lectures, or assessments? Submit a formal leave application for administrative review and track approval status in real-time.
          </p>
          <div className="flex items-center gap-2 pt-2 text-[11px] text-blue-200">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>
              Policy: Calculated in{' '}
              <span className="font-semibold text-white uppercase">
                {policy.calculationMode === 'working_days' ? 'Working Days (Mon-Fri)' : 'Calendar Days'}
              </span>
              . Retrospective leave is {policy.allowRetrospective ? 'allowed' : 'not permitted'}.
            </span>
          </div>
        </div>

        <button
          onClick={onOpenApplyModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-blue-700 font-bold text-xs shadow-md hover:bg-blue-50 transition-colors shrink-0 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Total Requests
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {summary.total}
          </div>
          <span className="text-[10px] text-slate-400">submitted</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
            Pending Review
          </span>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {summary.pending}
          </div>
          <span className="text-[10px] text-amber-600/80 font-medium">under evaluation</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
            Approved
          </span>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {summary.approved}
          </div>
          <span className="text-[10px] text-slate-400">leaves granted</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
            Rejected
          </span>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
            {summary.rejected}
          </div>
          <span className="text-[10px] text-slate-400">with reason</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
            Days Taken
          </span>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
            {summary.totalApprovedDays}
          </div>
          <span className="text-[10px] text-slate-400">approved leave days</span>
        </div>
      </div>

      {/* Recent Applications Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Recent Leave Submissions
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Your most recent leave requests and current approval statuses.
            </p>
          </div>
          <button
            onClick={onNavigateApplications}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>View All Applications</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentApps.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400 space-y-2">
            <Calendar className="w-8 h-8 mx-auto opacity-30" />
            <p>You have not submitted any leave applications yet.</p>
            <button
              onClick={onOpenApplyModal}
              className="text-blue-600 font-semibold hover:underline"
            >
              Submit your first leave request
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {recentApps.map((app) => (
              <div
                key={app.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 rounded-xl px-2 transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {app.applicationNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {app.leaveTypeName}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {app.startDate} to {app.endDate} · {app.totalDays} Day{app.totalDays === 1 ? '' : 's'}
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
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-[11px]"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Details</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

