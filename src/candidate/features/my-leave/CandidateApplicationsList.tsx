import React, { useState } from 'react';
import type { LeaveApplication, LeaveStatus } from '../../../types/index.ts';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Eye,
  FileText,
  AlertCircle,
  MessageSquare,
  Plus,
} from 'lucide-react';

interface CandidateApplicationsListProps {
  applications: LeaveApplication[];
  onSelectApplication: (app: LeaveApplication) => void;
  onOpenApplyModal: () => void;
  onCancelApplication: (app: LeaveApplication) => void;
}

export const CandidateApplicationsList: React.FC<CandidateApplicationsListProps> = ({
  applications,
  onSelectApplication,
  onOpenApplyModal,
  onCancelApplication,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('');

  const filtered = applications.filter((app) => {
    if (statusFilter && app.status !== statusFilter) return false;
    return true;
  });

  const getStatusBadge = (status: LeaveStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <RotateCcw className="w-3.5 h-3.5" />
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs & Action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs overflow-x-auto">
          {['', 'pending', 'approved', 'rejected', 'cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg font-medium transition-colors whitespace-nowrap capitalize text-[11px] ${
                statusFilter === st
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {st === '' ? 'All Applications' : st}
            </button>
          ))}
        </div>

        <button
          onClick={onOpenApplyModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {/* Applications Cards List */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-400 space-y-3">
          <Calendar className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              No leave applications found.
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {statusFilter
                ? `You have no ${statusFilter} leave applications.`
                : 'You have not submitted any leave applications yet.'}
            </p>
          </div>
          <button
            onClick={onOpenApplyModal}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs shadow-xs hover:bg-blue-500"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Apply Now</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <div
              key={app.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3 text-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {app.applicationNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    {app.leaveTypeName}
                  </span>
                  {app.attachments?.length > 0 && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                      <FileText className="w-3 h-3" />
                      {app.attachments.length} attachment{app.attachments.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">
                    Applied on {new Date(app.appliedAt).toLocaleDateString()}
                  </span>
                  {getStatusBadge(app.status)}
                </div>
              </div>

              {/* Main Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Duration Period
                  </span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5 block">
                    {app.startDate} <span className="text-slate-400 font-normal">to</span> {app.endDate}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Calculated Leave Days
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 mt-0.5 block">
                    {app.totalDays} Day{app.totalDays === 1 ? '' : 's'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Course & Batch
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 mt-0.5 block truncate">
                    {app.courseName} · {app.batchName}
                  </span>
                </div>
              </div>

              {/* Reason statement */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                <span className="font-semibold text-slate-900 dark:text-white">Reason: </span>
                {app.reason}
              </div>

              {/* Rejection notice if rejected */}
              {app.status === 'rejected' && app.rejectionReason && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-[11px] flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Rejection Reason: </span>
                    {app.rejectionReason}
                  </div>
                </div>
              )}

              {/* Admin remarks */}
              {app.adminRemarks && (
                <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 text-[11px] flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Admin Feedback: </span>
                    {app.adminRemarks}
                  </div>
                </div>
              )}

              {/* Card Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                {app.status === 'pending' && (
                  <button
                    onClick={() => onCancelApplication(app)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium text-[11px] transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Cancel Request</span>
                  </button>
                )}

                <button
                  onClick={() => onSelectApplication(app)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 font-medium text-[11px] transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Full Details</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

