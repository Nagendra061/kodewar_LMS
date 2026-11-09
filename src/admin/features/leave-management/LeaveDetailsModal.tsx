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
  Eye,
  MessageSquare,
  ShieldCheck,
  RotateCcw,
  History,
  Building,
} from 'lucide-react';

interface LeaveDetailsModalProps {
  application: LeaveApplication;
  onClose: () => void;
  onApprove: (id: string, remarks?: string) => Promise<void>;
  onReject: (id: string, rejectionReason: string, remarks?: string) => Promise<void>;
  onRevoke: (id: string, revokeReason: string, remarks?: string) => Promise<void>;
  onUpdateRemarks: (id: string, remarks: string) => Promise<void>;
}

export const LeaveDetailsModal: React.FC<LeaveDetailsModalProps> = ({
  application,
  onClose,
  onApprove,
  onReject,
  onRevoke,
  onUpdateRemarks,
}) => {
  const [actionType, setActionType] = useState<'idle' | 'approve' | 'reject' | 'revoke' | 'remarks'>('idle');
  const [reasonInput, setReasonInput] = useState('');
  const [remarksInput, setRemarksInput] = useState(application.adminRemarks || '');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const handleExecuteAction = async () => {
    setActionError(null);
    setActionLoading(true);
    try {
      if (actionType === 'approve') {
        await onApprove(application.id, remarksInput.trim() || undefined);
        setActionType('idle');
      } else if (actionType === 'reject') {
        if (!reasonInput.trim()) {
          setActionError('A mandatory rejection explanation is required.');
          setActionLoading(false);
          return;
        }
        await onReject(application.id, reasonInput.trim(), remarksInput.trim() || undefined);
        setActionType('idle');
      } else if (actionType === 'revoke') {
        if (!reasonInput.trim()) {
          setActionError('A mandatory revocation reason is required.');
          setActionLoading(false);
          return;
        }
        await onRevoke(application.id, reasonInput.trim(), remarksInput.trim() || undefined);
        setActionType('idle');
      } else if (actionType === 'remarks') {
        await onUpdateRemarks(application.id, remarksInput.trim());
        setActionType('idle');
      }
    } catch (err: any) {
      setActionError(err.message || 'Action failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl flex flex-col my-8 max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/40 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
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
                Leave Application Details
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

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {actionError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Applicant Profile Box */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                {application.applicantRole === 'tutor' ? 'Instructor Information' : 'Candidate Information'}
              </span>
              {application.applicantRole === 'tutor' ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  Instructor Account
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Candidate Account
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                  {application.applicantRole === 'tutor' ? 'Instructor Name' : 'Candidate Name'}
                </span>
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  {application.candidateName}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                  {application.applicantRole === 'tutor' ? 'Instructor ID' : 'Candidate ID'}
                </span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {application.tutorCustomId || application.candidateCustomId}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                  {application.applicantRole === 'tutor' ? 'Assigned Courses' : 'Course'}
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                  {application.courseName}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                  {application.applicantRole === 'tutor' ? 'Assigned Batches' : 'Current Batch'}
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                  {application.batchName}
                </span>
              </div>
            </div>
          </div>

          {/* Leave Information Grid */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">
              Leave Request Details
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Leave Type</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                  {application.leaveTypeName}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Duration Period</span>
                <span className="font-medium text-slate-900 dark:text-white mt-0.5 block font-mono">
                  {application.startDate} <span className="text-slate-400">to</span> {application.endDate}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Total Leave Days</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 mt-0.5 block text-sm">
                  {application.totalDays} Day{application.totalDays === 1 ? '' : 's'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Submission Date</span>
                <span className="text-slate-700 dark:text-slate-300 mt-0.5 block">
                  {new Date(application.appliedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Leave Reason Box */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Candidate's Statement of Reason
            </span>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
              {application.reason}
            </div>
          </div>

          {/* Rejection / Revocation Reason Notice if applicable */}
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

          {/* Admin Remarks (if present) */}
          {application.adminRemarks && (
            <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-1">
              <span className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                Administrative Remarks
              </span>
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                {application.adminRemarks}
              </p>
            </div>
          )}

          {/* Supporting Documents Section */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
              Supporting Attachments ({application.attachments?.length || 0})
            </span>
            {!application.attachments || application.attachments.length === 0 ? (
              <div className="p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 text-center">
                No supporting documents were attached with this application.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {application.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-400">
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
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1 shrink-0 text-[11px]"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>View</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Application Timeline / Audit History */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-400" />
              Application Audit Trail & Status Timeline
            </span>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {application.history?.map((h) => (
                <div key={h.id} className="p-3 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="capitalize font-semibold text-slate-800 dark:text-slate-200">
                        Status changed to {h.status}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        by {h.changedBy} ({h.changedByRole})
                      </span>
                    </div>
                    {h.reason && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="font-medium">Reason:</span> {h.reason}
                      </p>
                    )}
                    {h.remarks && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="font-medium">Remarks:</span> {h.remarks}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(h.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Action Forms (Approve / Reject / Revoke / Add Remarks) */}
          {actionType !== 'idle' && (
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white capitalize">
                  {actionType === 'approve' && 'Approve Leave Application'}
                  {actionType === 'reject' && 'Reject Leave Application (Mandatory Explanation)'}
                  {actionType === 'revoke' && 'Revoke Approved Leave (Mandatory Explanation)'}
                  {actionType === 'remarks' && 'Update Administrative Remarks'}
                </span>
                <button
                  onClick={() => setActionType('idle')}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>

              {(actionType === 'reject' || actionType === 'revoke') && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Explanation / Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    placeholder={
                      actionType === 'reject'
                        ? 'Explain why this leave application is rejected...'
                        : 'Explain why the previously approved leave is being revoked...'
                    }
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Administrative Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={remarksInput}
                  onChange={(e) => setRemarksInput(e.target.value)}
                  placeholder="Internal notes or instructions for record-keeping..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActionType('idle')}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleExecuteAction}
                  className={`px-4 py-1.5 text-xs rounded-lg text-white font-semibold transition-colors disabled:opacity-50 ${
                    actionType === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : actionType === 'reject' || actionType === 'revoke'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-slate-900 dark:bg-blue-600 hover:bg-slate-800'
                  }`}
                >
                  {actionLoading ? 'Processing...' : 'Confirm Decision'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 rounded-b-2xl flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setActionType('remarks')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Edit Remarks</span>
          </button>

          <div className="flex items-center gap-2">
            {application.status === 'pending' && actionType === 'idle' && (
              <>
                <button
                  onClick={() => {
                    setActionType('reject');
                    setReasonInput('');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
                <button
                  onClick={() => setActionType('approve')}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve Application</span>
                </button>
              </>
            )}

            {application.status === 'approved' && actionType === 'idle' && (
              <button
                onClick={() => {
                  setActionType('revoke');
                  setReasonInput('');
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Revoke Approval</span>
              </button>
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
    </div>
  );
};

