import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.ts';
import type {
  LeaveApplication,
  LeaveType,
  LeavePolicy,
  Course,
  Batch,
} from '../../../types/index.ts';
import { LeaveDashboard } from './LeaveDashboard.tsx';
import { LeaveApplicationsTable } from './LeaveApplicationsTable.tsx';
import { LeaveReports } from './LeaveReports.tsx';
import { LeaveDetailsModal } from './LeaveDetailsModal.tsx';
import { LeaveSettingsModal } from './LeaveSettingsModal.tsx';
import {
  Calendar,
  LayoutDashboard,
  FileText,
  BarChart3,
  Settings,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export const LeaveManagementView: React.FC = () => {
  const [tab, setTab] = useState<'dashboard' | 'applications' | 'reports'>('dashboard');

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
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals state
  const [selectedApp, setSelectedApp] = useState<LeaveApplication | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [appRes, typesRes, polRes, crsRes, bchRes] = await Promise.all([
        api.getLeaveApplications(),
        api.getLeaveTypes(),
        api.getLeavePolicy(),
        api.getCourses(),
        api.getBatches(),
      ]);

      setApplications(appRes.applications);
      setSummary(appRes.summary);
      setLeaveTypes(typesRes.leaveTypes);
      setPolicy(polRes.policy);
      setCourses(crsRes.courses);
      setBatches(bchRes.batches);

      // Keep selected app updated if modal is open
      if (selectedApp) {
        const updated = appRes.applications.find((a) => a.id === selectedApp.id);
        if (updated) setSelectedApp(updated);
      }
    } catch (err: any) {
      console.error('Failed to load leave management data:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to fetch leave data.' });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4500);
  };

  // --- Leave Actions Handlers ---
  const handleApprove = async (id: string, remarks?: string) => {
    try {
      const res = await api.approveLeave(id, remarks);
      showNotification('success', `Application ${res.application.applicationNumber} approved successfully.`);
      await loadData(true);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to approve application.');
      throw err;
    }
  };

  const handleReject = async (id: string, rejectionReason: string, remarks?: string) => {
    try {
      const res = await api.rejectLeave(id, rejectionReason, remarks);
      showNotification('success', `Application ${res.application.applicationNumber} rejected.`);
      await loadData(true);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to reject application.');
      throw err;
    }
  };

  const handleRevoke = async (id: string, revokeReason: string, remarks?: string) => {
    try {
      const res = await api.revokeLeave(id, revokeReason, remarks);
      showNotification('success', `Application ${res.application.applicationNumber} revoked.`);
      await loadData(true);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to revoke application.');
      throw err;
    }
  };

  const handleUpdateRemarks = async (id: string, remarks: string) => {
    try {
      const res = await api.updateLeaveRemarks(id, remarks);
      showNotification('success', `Remarks updated for ${res.application.applicationNumber}.`);
      await loadData(true);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update remarks.');
      throw err;
    }
  };

  // Quick action triggers from table / dashboard
  const handleQuickApprove = async (app: LeaveApplication) => {
    if (!window.confirm(`Are you sure you want to approve leave application ${app.applicationNumber} for ${app.candidateName}?`)) return;
    try {
      await handleApprove(app.id);
    } catch {}
  };

  const handleQuickReject = (app: LeaveApplication) => {
    setSelectedApp(app);
  };

  const handleQuickRevoke = (app: LeaveApplication) => {
    setSelectedApp(app);
  };

  // --- Settings Handlers ---
  const handleCreateLeaveType = async (data: Partial<LeaveType>) => {
    await api.createLeaveType(data);
    await loadData(true);
  };

  const handleUpdateLeaveType = async (id: string, data: Partial<LeaveType>) => {
    await api.updateLeaveType(id, data);
    await loadData(true);
  };

  const handleDeleteLeaveType = async (id: string) => {
    await api.deleteLeaveType(id);
    await loadData(true);
  };

  const handleUpdatePolicy = async (newPolicy: Partial<LeavePolicy>) => {
    await api.updateLeavePolicy(newPolicy);
    await loadData(true);
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4 animate-pulse max-w-7xl mx-auto">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-64" />
        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-96" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Heading */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Candidate Leave Management
            </h1>
            {summary.pending > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 animate-pulse">
                {summary.pending} Pending Review
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review, validate, approve, reject, and export candidate leave applications with complete audit history.
          </p>
        </div>

        {/* Global Action Shortcuts */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => loadData(false)}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Policy & Leave Types</span>
          </button>
        </div>
      </div>

      {/* Toast Notification Alert */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs hover:opacity-75 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setTab('dashboard')}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors ${
            tab === 'dashboard'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Leave Dashboard</span>
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
          <span>All Applications ({summary.total})</span>
          {summary.pending > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">
              {summary.pending}
            </span>
          )}
        </button>

        <button
          onClick={() => setTab('reports')}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors ${
            tab === 'reports'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Reports & Analytics</span>
        </button>
      </div>

      {/* Tab Views */}
      {tab === 'dashboard' && (
        <LeaveDashboard
          applications={applications}
          leaveTypes={leaveTypes}
          policy={policy}
          summary={summary}
          onNavigateTab={setTab}
          onOpenSettings={() => setShowSettings(true)}
          onSelectApplication={(app) => setSelectedApp(app)}
          onQuickApprove={handleQuickApprove}
          onQuickReject={handleQuickReject}
        />
      )}

      {tab === 'applications' && (
        <LeaveApplicationsTable
          applications={applications}
          leaveTypes={leaveTypes}
          courses={courses}
          batches={batches}
          onSelectApplication={(app) => setSelectedApp(app)}
          onQuickApprove={handleQuickApprove}
          onQuickReject={handleQuickReject}
          onQuickRevoke={handleQuickRevoke}
        />
      )}

      {tab === 'reports' && (
        <LeaveReports
          applications={applications}
          leaveTypes={leaveTypes}
          courses={courses}
          batches={batches}
        />
      )}

      {/* Modals */}
      {selectedApp && (
        <LeaveDetailsModal
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onRevoke={handleRevoke}
          onUpdateRemarks={handleUpdateRemarks}
        />
      )}

      {showSettings && (
        <LeaveSettingsModal
          leaveTypes={leaveTypes}
          policy={policy}
          onClose={() => setShowSettings(false)}
          onCreateLeaveType={handleCreateLeaveType}
          onUpdateLeaveType={handleUpdateLeaveType}
          onDeleteLeaveType={handleDeleteLeaveType}
          onUpdatePolicy={handleUpdatePolicy}
        />
      )}
    </div>
  );
};

