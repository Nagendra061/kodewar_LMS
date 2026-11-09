import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import type { LeaveApplication, LeaveType, Course, Batch } from '../../../types/index.ts';
import {
  BarChart3,
  Download,
  Calendar,
  Layers,
  Users,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  TrendingUp,
  FileText,
} from 'lucide-react';

interface LeaveReportsProps {
  applications: LeaveApplication[];
  leaveTypes: LeaveType[];
  courses: Course[];
  batches: Batch[];
}

export const LeaveReports: React.FC<LeaveReportsProps> = ({
  applications,
  leaveTypes,
  courses,
  batches,
}) => {
  // Filters for reports view & export
  const [courseFilter, setCourseFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Filtered dataset
  const filteredApps = applications.filter((app) => {
    if (courseFilter && app.courseId !== courseFilter) return false;
    if (batchFilter && app.batchId !== batchFilter) return false;
    if (typeFilter && app.leaveTypeId !== typeFilter) return false;
    if (statusFilter && app.status !== statusFilter) return false;
    if (startDateFilter && app.startDate < startDateFilter) return false;
    if (endDateFilter && app.endDate > endDateFilter) return false;
    return true;
  });

  const totalFiltered = filteredApps.length;
  const approvedFiltered = filteredApps.filter((a) => a.status === 'approved');
  const totalApprovedDays = approvedFiltered.reduce((sum, a) => sum + (a.totalDays || 0), 0);
  const pendingCount = filteredApps.filter((a) => a.status === 'pending').length;
  const rejectedCount = filteredApps.filter((a) => a.status === 'rejected').length;
  const approvalRate = totalFiltered > 0 ? Math.round((approvedFiltered.length / totalFiltered) * 100) : 0;
  const avgDaysPerLeave = approvedFiltered.length > 0 ? (totalApprovedDays / approvedFiltered.length).toFixed(1) : '0';

  // Breakdown by leave type
  const typeMap: Record<string, { name: string; count: number; approvedDays: number }> = {};
  leaveTypes.forEach((t) => {
    typeMap[t.id] = { name: t.name, count: 0, approvedDays: 0 };
  });
  filteredApps.forEach((a) => {
    if (!typeMap[a.leaveTypeId]) {
      typeMap[a.leaveTypeId] = { name: a.leaveTypeName, count: 0, approvedDays: 0 };
    }
    typeMap[a.leaveTypeId].count++;
    if (a.status === 'approved') {
      typeMap[a.leaveTypeId].approvedDays += a.totalDays || 0;
    }
  });

  // Breakdown by Batch
  const batchMap: Record<string, { batchName: string; courseName: string; totalApps: number; approvedDays: number }> = {};
  filteredApps.forEach((a) => {
    if (!batchMap[a.batchId]) {
      batchMap[a.batchId] = {
        batchName: a.batchName,
        courseName: a.courseName,
        totalApps: 0,
        approvedDays: 0,
      };
    }
    batchMap[a.batchId].totalApps++;
    if (a.status === 'approved') {
      batchMap[a.batchId].approvedDays += a.totalDays || 0;
    }
  });

  // Candidate summary
  const candidateMap: Record<
    string,
    { candidateName: string; candidateCustomId: string; batchName: string; totalApps: number; approvedDays: number }
  > = {};
  filteredApps.forEach((a) => {
    if (!candidateMap[a.candidateId]) {
      candidateMap[a.candidateId] = {
        candidateName: a.candidateName,
        candidateCustomId: a.candidateCustomId,
        batchName: a.batchName,
        totalApps: 0,
        approvedDays: 0,
      };
    }
    candidateMap[a.candidateId].totalApps++;
    if (a.status === 'approved') {
      candidateMap[a.candidateId].approvedDays += a.totalDays || 0;
    }
  });

  const topCandidates = Object.values(candidateMap)
    .sort((a, b) => b.approvedDays - a.approvedDays)
    .slice(0, 10);

  // Export to Excel / CSV
  const handleExport = (format: 'xlsx' | 'csv') => {
    const dataToExport = filteredApps.map((a) => ({
      'Application Number': a.applicationNumber,
      'Candidate ID': a.candidateCustomId,
      'Candidate Name': a.candidateName,
      'Candidate Email': a.candidateEmail,
      Course: a.courseName,
      Batch: a.batchName,
      'Leave Type': a.leaveTypeName,
      'Start Date': a.startDate,
      'End Date': a.endDate,
      'Total Days': a.totalDays,
      Status: a.status.toUpperCase(),
      'Applied On': new Date(a.appliedAt).toLocaleDateString(),
      'Reason For Leave': a.reason,
      'Rejection Reason': a.rejectionReason || '',
      'Admin Remarks': a.adminRemarks || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leave_Report');

    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `Kodewar_Leave_Report_${timestamp}.${format}`;

    if (format === 'xlsx') {
      XLSX.writeFile(workbook, fileName);
    } else {
      XLSX.writeFile(workbook, fileName, { bookType: 'csv' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter and Export Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>Leave Reporting & Analytics</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Comprehensive candidate, batch, and category leave distribution with formatted Excel/CSV export.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleExport('xlsx')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel (.xlsx)</span>
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2 text-xs">
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Course
            </label>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Batch
            </label>
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Leave Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="">All Categories</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Matching Requests
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {totalFiltered}
            </span>
            <span className="text-xs text-slate-500">applications</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Total Approved Days
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {totalApprovedDays}
            </span>
            <span className="text-xs text-slate-500">days taken</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Approval Rate
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {approvalRate}%
            </span>
            <span className="text-xs text-slate-500">of submitted</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Avg Days / Leave
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400 tabular-nums">
              {avgDaysPerLeave}
            </span>
            <span className="text-xs text-slate-500">days / approval</span>
          </div>
        </div>
      </div>

      {/* Grid: Type Breakdown & Top Leave Applicants */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Type Breakdown Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Distribution by Leave Type
          </h4>
          <div className="space-y-3">
            {Object.values(typeMap).map((t, idx) => {
              const maxVal = Math.max(...Object.values(typeMap).map((x) => x.count), 1);
              const percentage = Math.round((t.count / maxVal) * 100);
              return (
                <div key={idx} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {t.name}
                    </span>
                    <span className="text-slate-500 tabular-nums font-mono">
                      {t.count} apps ({t.approvedDays} approved days)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Batch Breakdown Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Distribution by Academic Batch
          </h4>
          {Object.keys(batchMap).length === 0 ? (
            <div className="text-xs text-slate-400 py-6 text-center">
              No leave activity recorded in the selected filter period.
            </div>
          ) : (
            <div className="space-y-3">
              {Object.values(batchMap).map((b, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">
                      {b.batchName}
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {b.courseName}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-blue-600 dark:text-blue-400 block tabular-nums">
                      {b.approvedDays} approved days
                    </span>
                    <span className="text-[10px] text-slate-400">{b.totalApps} applications</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Leave Takers Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Top Candidates by Approved Leave Duration
        </h4>

        {topCandidates.length === 0 ? (
          <div className="text-xs text-slate-400 py-6 text-center">
            No approved leaves found matching current criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-2.5">Candidate</th>
                  <th className="px-4 py-2.5">Batch</th>
                  <th className="px-4 py-2.5">Total Applications</th>
                  <th className="px-4 py-2.5 text-right">Approved Leave Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {topCandidates.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                      {c.candidateName}{' '}
                      <span className="font-mono text-slate-400 text-[11px]">({c.candidateCustomId})</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{c.batchName}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{c.totalApps}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-blue-600 dark:text-blue-400">
                      {c.approvedDays} Days
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

