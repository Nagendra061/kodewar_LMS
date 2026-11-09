import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { LeaveApplication, LeaveType, LeavePolicy } from '../types/index.ts';
import {
  calculateLeaveDays,
  validateLeaveDates,
  checkLeaveOverlap,
  getTodayDateString,
} from '../common/validation/leaveValidation.ts';
import {
  CalendarClock,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  Calendar,
  AlertCircle,
  FileText,
  Paperclip,
  Trash2,
  X,
  Eye,
  ShieldCheck,
  History,
  BookOpen,
  User,
  GraduationCap,
  Layers,
} from 'lucide-react';

export const TutorLeaveView: React.FC = () => {
  const { user } = useAuth();
  const tutor = user as any;

  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    totalApprovedDays: 0,
  });
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [policy, setPolicy] = useState<LeavePolicy>({
    calculationMode: 'working_days',
    allowRetrospective: false,
    maxConsecutiveDays: 30,
    requireAttachmentAboveDays: 2,
  });

  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<LeaveApplication | null>(null);
  const [cancellingAppId, setCancellingAppId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [leaveRes, typesRes, polRes] = await Promise.all([
        api.getTutorLeave(),
        api.getLeaveTypes(),
        api.getLeavePolicy(),
      ]);

      setApplications(leaveRes.applications);
      setSummary(leaveRes.summary);
      setLeaveTypes(typesRes.leaveTypes);
      setPolicy(polRes.policy);

      if (selectedApp) {
        const updated = leaveRes.applications.find((a) => a.id === selectedApp.id);
        if (updated) setSelectedApp(updated);
      }
    } catch (err: any) {
      console.error('Failed to load instructor leave data:', err);
      setToastMessage({ type: 'error', text: err.message || 'Failed to fetch leave records.' });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleCancelApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingAppId) return;
    setIsCancelling(true);
    try {
      const res = await api.cancelTutorLeave(cancellingAppId, cancelReason.trim() || undefined);
      showToast('success', `Application ${res.application.applicationNumber} has been successfully cancelled.`);
      setCancellingAppId(null);
      setCancelReason('');
      if (selectedApp?.id === cancellingAppId) {
        setSelectedApp(res.application);
      }
      await loadData(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to cancel application.');
    } finally {
      setIsCancelling(false);
    }
  };

  const filteredApplications = applications.filter((app) => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesType = typeFilter === 'all' || app.leaveTypeId === typeFilter;
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      app.applicationNumber.toLowerCase().includes(q) ||
      app.leaveTypeName.toLowerCase().includes(q) ||
      app.reason.toLowerCase().includes(q) ||
      (app.adminRemarks && app.adminRemarks.toLowerCase().includes(q));

    return matchesStatus && matchesType && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <RotateCcw className="w-3 h-3" />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <span>Instructor Leave & Time-Off Management</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Request planned absence, monitor approval workflow, view Super Admin decisions, and manage leave history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(false)}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowApplyModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Apply for Leave</span>
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-xs hover:opacity-75 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Total</span>
            <Calendar className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-2">
            {summary.total}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Total applications</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-2">
            {summary.pending}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Awaiting admin review</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {summary.approved}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Approved leaves</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Rejected</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-2">
            {summary.rejected}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">With explanation</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Cancelled</span>
            <RotateCcw className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-700 dark:text-slate-300 mt-2">
            {summary.cancelled}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Withdrawn requests</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Approved Days</span>
            <CalendarClock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
            {summary.totalApprovedDays}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Cumulative days off</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by reason or application number..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 text-[11px] font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 text-[11px] font-medium">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Types</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <CalendarClock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'No Matching Leave Applications'
              : 'No Leave Applications Submitted Yet'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'Try modifying your search or filter options.'
              : 'You have not submitted any leave applications. Click "Apply for Leave" above to request planned time-off.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">App #</th>
                  <th className="px-4 py-3">Leave Type</th>
                  <th className="px-4 py-3">Dates & Duration</th>
                  <th className="px-4 py-3 text-center">Days</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-purple-700 dark:text-purple-300">
                      {app.applicationNumber}
                    </td>

                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {app.leaveTypeName}
                    </td>

                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {app.startDate} → {app.endDate}
                    </td>

                    <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-white">
                      {app.totalDays}
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={app.reason}>
                      {app.reason}
                    </td>

                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(app.appliedAt).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(app.status)}
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedApp(app)}
                          title="View Details & History"
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>

                        {app.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancellingAppId(app.id);
                              setCancelReason('');
                            }}
                            title="Cancel Pending Application"
                            className="px-2 py-1 text-xs font-semibold rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 dark:text-rose-300 transition-colors flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancel</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== APPLY LEAVE MODAL ===================== */}
      {showApplyModal && (
        <TutorApplyLeaveModal
          leaveTypes={leaveTypes}
          policy={policy}
          existingApplications={applications}
          onClose={() => setShowApplyModal(false)}
          onSuccess={(newApp) => {
            setShowApplyModal(false);
            showToast('success', `Leave request ${newApp.applicationNumber} submitted successfully with status PENDING.`);
            loadData(true);
          }}
        />
      )}

      {/* ===================== DETAILS MODAL ===================== */}
      {selectedApp && (
        <TutorLeaveDetailsModal
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onCancelRequest={() => {
            setCancellingAppId(selectedApp.id);
            setCancelReason('');
          }}
        />
      )}

      {/* ===================== CANCEL CONFIRMATION MODAL ===================== */}
      {cancellingAppId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cancel Leave Application
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to withdraw this leave request? This action cannot be undone.
            </p>

            <form onSubmit={handleCancelApplication} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Cancellation (Optional)
                </label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Schedule rescheduled, no longer required..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => setCancellingAppId(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Keep Application
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors"
                >
                  {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: TUTOR APPLY LEAVE MODAL
// ==========================================
interface TutorApplyModalProps {
  leaveTypes: LeaveType[];
  policy: LeavePolicy;
  existingApplications: LeaveApplication[];
  onClose: () => void;
  onSuccess: (newApp: LeaveApplication) => void;
}

const TutorApplyLeaveModal: React.FC<TutorApplyModalProps> = ({
  leaveTypes,
  policy,
  existingApplications,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const tutor = user as any;

  const todayStr = getTodayDateString('Asia/Kolkata');
  const activeTypes = leaveTypes.filter((t) => t.isActive);

  const [leaveTypeId, setLeaveTypeId] = useState<string>(activeTypes[0]?.id || '');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [reason, setReason] = useState<string>('');
  const [attachments, setAttachments] = useState<
    Array<{ fileName: string; fileSize: number; mimeType: string; dataUrl: string }>
  >([]);

  const [formError, setFormError] = useState<string | null>(null);
  const [calculatedDays, setCalculatedDays] = useState<number>(1);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);

  const selectedType = activeTypes.find((t) => t.id === leaveTypeId) || activeTypes[0];

  useEffect(() => {
    if (!startDate || !endDate) {
      setCalculatedDays(0);
      setOverlapWarning(null);
      return;
    }

    const days = calculateLeaveDays(startDate, endDate, policy.calculationMode || 'working_days');
    setCalculatedDays(days);

    const overlap = checkLeaveOverlap(startDate, endDate, existingApplications);
    if (overlap.hasOverlap && overlap.overlappingApp) {
      const opp = overlap.overlappingApp;
      setOverlapWarning(
        `Warning: You have an existing ${opp.status.toUpperCase()} leave (${opp.applicationNumber} from ${opp.startDate} to ${opp.endDate}) overlapping with these dates.`
      );
    } else {
      setOverlapWarning(null);
    }
  }, [startDate, endDate, policy.calculationMode, existingApplications]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileUploadError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setFileUploadError('Attachment exceeds the 5MB file size limit. Please choose a smaller file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAttachments((prev) => [
        ...prev,
        {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          dataUrl,
        },
      ]);
    };
    reader.onerror = () => {
      setFileUploadError('Failed to read the selected file. Please try another file.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!leaveTypeId) {
      setFormError('Please select a leave type.');
      return;
    }

    const dateVal = validateLeaveDates(startDate, endDate, policy, 'Asia/Kolkata');
    if (!dateVal.isValid) {
      setFormError(dateVal.error || 'Invalid date range.');
      return;
    }

    if (calculatedDays <= 0) {
      setFormError('The selected dates do not result in any billable leave days under the active calendar policy.');
      return;
    }

    if (!reason.trim()) {
      setFormError('Please provide a descriptive reason for your leave application.');
      return;
    }

    if (selectedType?.requiresDocument && attachments.length === 0) {
      setFormError(`Supporting documentation is mandatory for "${selectedType.name}". Please attach a file.`);
      return;
    }

    if (policy.requireAttachmentAboveDays > 0 && calculatedDays > policy.requireAttachmentAboveDays && attachments.length === 0) {
      setFormError(`Company policy mandates supporting documentation for leaves exceeding ${policy.requireAttachmentAboveDays} days.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.applyTutorLeave({
        leaveTypeId,
        startDate,
        endDate,
        reason: reason.trim(),
        attachments,
      });
      onSuccess(res.application);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit leave application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Instructor Leave Application Form
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {overlapWarning && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{overlapWarning}</span>
            </div>
          )}

          {/* Auto-populated Tutor Info Card */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Instructor Name</span>
              <span className="font-semibold text-slate-900 dark:text-white">{tutor?.name || 'Instructor'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Instructor ID</span>
              <span className="font-mono text-purple-600 dark:text-purple-400">{tutor?.tutorId || 'TUT-ID'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Email</span>
              <span className="font-mono text-slate-600 dark:text-slate-300 truncate block">{tutor?.email}</span>
            </div>
          </div>

          {/* Leave Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Leave Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {activeTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.requiresDocument ? '(Document Mandatory)' : ''}
                </option>
              ))}
            </select>
            {selectedType?.description && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {selectedType.description}
              </p>
            )}
          </div>

          {/* Date Range Selection & Total Days */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                min={policy.allowRetrospective ? undefined : todayStr}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) {
                    setEndDate(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                End Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                min={startDate || (policy.allowRetrospective ? undefined : todayStr)}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Auto-calculated Total Leave Duration Badge */}
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-purple-900 dark:text-purple-200 font-medium">
                Calculated Total Duration:
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-purple-700 dark:text-purple-300">
              <span className="text-sm">{calculatedDays}</span>
              <span className="text-xs font-normal">
                day(s) ({policy.calculationMode === 'working_days' ? 'working days' : 'calendar days'})
              </span>
            </div>
          </div>

          {/* Reason for Leave */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reason for Absence <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State the detailed purpose of your leave request so administration can arrange cohort substitute mentors if needed..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* File Attachments */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Supporting Documentation {selectedType?.requiresDocument && <span className="text-rose-500">*</span>}
              </label>
              <span className="text-[11px] text-slate-400">PDF, JPG, PNG, DOCX (Max 5MB)</span>
            </div>

            {fileUploadError && (
              <p className="text-[11px] text-rose-600 mb-1.5">{fileUploadError}</p>
            )}

            <div className="flex items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <Paperclip className="w-3.5 h-3.5" />
                <span>Add Attachment</span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                />
              </label>
            </div>

            {attachments.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span className="truncate font-medium text-slate-900 dark:text-white">{att.fileName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({Math.round(att.fileSize / 1024)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                      title="Remove attachment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-sm disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting Application...' : 'Submit Leave Application'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: TUTOR LEAVE DETAILS MODAL
// ==========================================
interface TutorDetailsModalProps {
  application: LeaveApplication;
  onClose: () => void;
  onCancelRequest: () => void;
}

const TutorLeaveDetailsModal: React.FC<TutorDetailsModalProps> = ({
  application,
  onClose,
  onCancelRequest,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
              {application.applicationNumber}
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Application Details & Audit History
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Status Alert Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              application.status === 'approved'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : application.status === 'rejected'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                : application.status === 'cancelled'
                ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-[11px]">
                Status: {application.status}
              </span>
            </div>
            <span className="text-[11px] font-mono">
              Submitted: {new Date(application.appliedAt).toLocaleDateString()}
            </span>
          </div>

          {/* Rejection / Admin Remarks Notice */}
          {application.status === 'rejected' && application.rejectionReason && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600" />
                Administrative Rejection Reason:
              </span>
              <p className="pl-5 leading-relaxed">{application.rejectionReason}</p>
            </div>
          )}

          {application.adminRemarks && (
            <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-300 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                Administrator Feedback / Remarks:
              </span>
              <p className="pl-5 leading-relaxed">{application.adminRemarks}</p>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3.5 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Leave Type</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">{application.leaveTypeName}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Days</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">{application.totalDays} day(s)</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Start Date</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 block">{application.startDate}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">End Date</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 block">{application.endDate}</span>
            </div>
          </div>

          {/* Reason Section */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Submitted Reason</span>
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 leading-relaxed">
              {application.reason}
            </div>
          </div>

          {/* Attachments Section */}
          {application.attachments && application.attachments.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Supporting Documentation ({application.attachments.length})
              </span>
              <div className="space-y-1.5">
                {application.attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span className="font-medium text-slate-900 dark:text-white truncate">{att.fileName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({Math.round((att.fileSize || 0) / 1024)} KB)
                      </span>
                    </div>

                    {att.dataUrl && (
                      <a
                        href={att.dataUrl}
                        download={att.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 text-xs font-semibold rounded bg-purple-600 hover:bg-purple-500 text-white shrink-0"
                      >
                        Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Timeline */}
          {application.history && application.history.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                <span>Status Change Audit Log</span>
              </span>
              <div className="space-y-2">
                {application.history.map((h) => (
                  <div
                    key={h.id}
                    className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold capitalize text-slate-800 dark:text-slate-200">
                        {h.status}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {new Date(h.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      By: <span className="font-semibold text-slate-700 dark:text-slate-300">{h.changedBy}</span> ({h.changedByRole})
                    </div>
                    {h.reason && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                        Reason: {h.reason}
                      </p>
                    )}
                    {h.remarks && (
                      <p className="text-[11px] text-purple-600 dark:text-purple-400">
                        Remarks: {h.remarks}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            {application.status === 'pending' && (
              <button
                type="button"
                onClick={onCancelRequest}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors"
              >
                Cancel Application
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

