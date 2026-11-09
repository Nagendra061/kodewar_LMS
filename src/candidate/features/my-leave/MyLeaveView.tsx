import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.ts';
import type { LeaveApplication, LeaveType, LeavePolicy } from '../../../types/index.ts';
import { CandidateLeaveOverview } from './CandidateLeaveOverview.tsx';
import { CandidateApplicationsList } from './CandidateApplicationsList.tsx';
import { ApplyLeaveModal } from './ApplyLeaveModal.tsx';
import { CandidateLeaveDetailsModal } from './CandidateLeaveDetailsModal.tsx';
import {
  Calendar,
  LayoutDashboard,
  FileText,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export const MyLeaveView: React.FC = () => {
  const [tab, setTab] = useState<'overview' | 'applications'>('overview');

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

  // Modals state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<LeaveApplication | null>(null);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [leaveRes, typesRes, polRes] = await Promise.all([
        api.getCandidateLeave(),
        api.getLeaveTypes(),
        api.getLeavePolicy(),
      ]);

      setApplications(leaveRes.applications);
      setSummary(leaveRes.summary);
      setLeaveTypes(typesRes.leaveTypes);
      setPolicy(polRes.policy);

      // Keep open details modal synchronized
      if (selectedApp) {
        const updated = leaveRes.applications.find((a) => a.id === selectedApp.id);
        if (updated) setSelectedApp(updated);
      }
    } catch (err: any) {
      console.error('Failed to load candidate leave data:', err);
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

  const handleApply = async (data: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason: string;
    attachments?: Array<{ fileName: string; fileSize: number; mimeType: string; dataUrl: string }>;
  }) => {
    const res = await api.applyCandidateLeave(data);
    return res.application;
  };

  const handleApplySuccess = (newApp: LeaveApplication) => {
    setShowApplyModal(false);
    showToast('success', `Leave application ${newApp.applicationNumber} submitted successfully with status PENDING.`);
    loadData(true);
  };

  const handleCancelApplication = async (id: string, reason?: string) => {
    try {
      const res = await api.cancelCandidateLeave(id, reason);
      showToast('success', `Application ${res.application.applicationNumber} has been cancelled.`);
      await loadData(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to cancel application.');
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4 animate-pulse max-w-5xl mx-auto">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-48" />
        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-80" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            My Leave Applications
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Apply for absence, view approval statuses, administrative feedback, and leave history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(false)}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowApplyModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-xs"
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

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setTab('overview')}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors ${
            tab === 'overview'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Leave Overview</span>
        </button>

        <button
          onClick={() => setTab('applications')}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors ${
            tab === 'applications'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>My Applications ({summary.total})</span>
          {summary.pending > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">
              {summary.pending}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {tab === 'overview' && (
        <CandidateLeaveOverview
          applications={applications}
          policy={policy}
          summary={summary}
          onOpenApplyModal={() => setShowApplyModal(true)}
          onNavigateApplications={() => setTab('applications')}
          onSelectApplication={(app) => setSelectedApp(app)}
        />
      )}

      {tab === 'applications' && (
        <CandidateApplicationsList
          applications={applications}
          onSelectApplication={(app) => setSelectedApp(app)}
          onOpenApplyModal={() => setShowApplyModal(true)}
          onCancelApplication={(app) => setSelectedApp(app)}
        />
      )}

      {/* Modals */}
      {showApplyModal && (
        <ApplyLeaveModal
          leaveTypes={leaveTypes}
          policy={policy}
          existingApplications={applications}
          onClose={() => setShowApplyModal(false)}
          onSubmitSuccess={handleApplySuccess}
          onApply={handleApply}
        />
      )}

      {selectedApp && (
        <CandidateLeaveDetailsModal
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onCancelApplication={handleCancelApplication}
        />
      )}
    </div>
  );
};

