import React, { useState } from 'react';
import type { LeaveApplication, LeaveStatus } from '../../../types/index.ts';
import {
  X,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Download,
  RotateCcw,
  History,
  MessageSquare,
} from 'lucide-react';

interface CandidateLeaveDetailsModalProps {
  application: LeaveApplication;
  onClose: () => void;
  onCancelApplication: (id: string, reason?: string) => Promise<void>;
}

export const CandidateLeaveDetailsModal: React.FC<CandidateLeaveDetailsModalProps> = ({
  application,
  onClose,
  onCancelApplication,
}) => {
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStatusBadge = (status: LeaveStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <RotateCcw className="w-3.5 h-3.5" />
            Cancelled / Revoked
          </span>
        );
    }
  };

  const handleConfirmCancel = async () => {
    setError(null);
    setCancelling(true);
    try {
      await onCancelApplication(application.id, cancelReason.trim() || undefined);
      setShowCancelPrompt(false);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel application.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col my-8 max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/40 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                  {application.applicationNumber}
                </span>
                {getStatusBadge(application.status)}
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                My Leave Application
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Details Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block">Leave Category</span>
              <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                {application.leaveTypeName}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Duration</span>
              <span className="font-mono font-medium text-slate-900 dark:text-white mt-0.5 block">
                {application.startDate} to {application.endDate}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Total Days</span>
              <span className="font-bold text-blue-600 dark:text-blue-400 mt-0.5 block text-sm">
                {application.totalDays} Day{application.totalDays === 1 ? '' : 's'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Submission Date</span>
              <span className="text-slate-700 dark:text-slate-300 mt-0.5 block">
                {new Date(application.appliedAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Reason Box */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              Submitted Reason
            </span>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {application.reason}
            </div>
          </div>

          {/* Rejection notice if rejected */}
          {application.status === 'rejected' && application.rejectionReason && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-1">
              <span className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600" />
                Administrative Rejection Reason
              </span>
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                {application.rejectionReason}
              </p>
            </div>
          )}

          {/* Admin Remarks if present */}
          {application.adminRemarks && (
            <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-1">
              <span className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                Administrator Feedback
              </span>
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                {application.adminRemarks}
              </p>
            </div>
          )}

          {/* Supporting Documents */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              Attached Documents ({application.attachments?.length || 0})
            </span>
            {!application.attachments || application.attachments.length === 0 ? (
              <div className="p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 text-center">
                No supporting documents attached.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {application.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <span className="font-medium text-slate-900 dark:text-white truncate block">
                          {att.fileName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {(att.fileSize / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>

                    {att.dataUrl && (
                      <a
                        href={att.dataUrl}
                        download={att.fileName}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 flex items-center gap-1 text-[11px]"
                      >
                        <Download className="w-3 h-3" />
                        <span>View</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-400" />
              Application History
            </span>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {application.history?.map((h) => (
                <div key={h.id} className="p-3 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block capitalize">
                      {h.status === 'pending'
                        ? 'Application Submitted'
                        : `Status changed to ${h.status}`}
                    </span>
                    {h.reason && (
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        {h.reason}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {new Date(h.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Cancellation Prompt */}
          {showCancelPrompt && (
            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 space-y-3 text-xs">
              <div>
                <span className="font-bold text-rose-800 dark:text-rose-300 block">
                  Confirm Application Cancellation
                </span>
                <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5">
                  Are you sure you want to cancel this pending leave application? Once cancelled, you will need to submit a new application if your plans change.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Cancellation (Optional)
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Schedule changed, personal plans resolved..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCancelPrompt(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Keep Application
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={handleConfirmCancel}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-xs disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 rounded-b-2xl flex items-center justify-between gap-3">
          {application.status === 'pending' && !showCancelPrompt ? (
            <button
              onClick={() => setShowCancelPrompt(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Cancel Pending Application</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

