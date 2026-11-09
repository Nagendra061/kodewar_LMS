import React, { useState } from 'react';
import type { LeaveApplication, LeaveType, Course, Batch, LeaveStatus } from '../../../types/index.ts';
import {
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Calendar,
  User,
  FileText,
  Clock,
  ArrowUpDown,
} from 'lucide-react';

interface LeaveApplicationsTableProps {
  applications: LeaveApplication[];
  leaveTypes: LeaveType[];
  courses: Course[];
  batches: Batch[];
  onSelectApplication: (app: LeaveApplication) => void;
  onQuickApprove: (app: LeaveApplication) => void;
  onQuickReject: (app: LeaveApplication) => void;
  onQuickRevoke: (app: LeaveApplication) => void;
}

export const LeaveApplicationsTable: React.FC<LeaveApplicationsTableProps> = ({
  applications,
  leaveTypes,
  courses,
  batches,
  onSelectApplication,
  onQuickApprove,
  onQuickReject,
  onQuickRevoke,
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Filter applications
  const filtered = applications.filter((app) => {
    if (roleFilter && (app.applicantRole || 'candidate') !== roleFilter) return false;
    if (courseFilter && app.courseId !== courseFilter) return false;
    if (batchFilter && app.batchId !== batchFilter) return false;
    if (typeFilter && app.leaveTypeId !== typeFilter) return false;
    if (statusFilter && app.status !== statusFilter) return false;
    if (dateFilter && (app.startDate > dateFilter || app.endDate < dateFilter)) return false;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const match =
        app.applicationNumber.toLowerCase().includes(q) ||
        app.candidateName.toLowerCase().includes(q) ||
        app.candidateCustomId.toLowerCase().includes(q) ||
        (app.tutorCustomId && app.tutorCustomId.toLowerCase().includes(q)) ||
        app.candidateEmail.toLowerCase().includes(q) ||
        app.leaveTypeName.toLowerCase().includes(q) ||
        app.reason.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const getStatusBadge = (status: LeaveStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending
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
    }
  };

  const getTypeBadge = (typeName: string) => {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
        {typeName}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search candidate name, ID, application number, or reason..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Quick status tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs shrink-0 overflow-x-auto">
            {['', 'pending', 'approved', 'rejected', 'cancelled'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg font-medium transition-colors whitespace-nowrap capitalize text-[11px] ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {st === '' ? 'All Statuses' : st}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdown filters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1 text-xs">
          <div>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="">All Applicants</option>
              <option value="candidate">Candidates</option>
              <option value="tutor">Instructors (Tutors)</option>
            </select>
          </div>

          <div>
            <select
              value={courseFilter}
              onChange={(e) => {
                setCourseFilter(e.target.value);
                setPage(1);
              }}
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
            <select
              value={batchFilter}
              onChange={(e) => {
                setBatchFilter(e.target.value);
                setPage(1);
              }}
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
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="">All Leave Types</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              placeholder="Active on Date"
            />
          </div>
        </div>
      </div>

      {/* Applications Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">App #</th>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Course / Batch</th>
                <th className="px-4 py-3">Leave Type</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3 text-center">Days</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-slate-600 dark:text-slate-300">
                      No leave applications match the selected filters.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Try clearing search queries or adjusting date and status filters.
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((app) => (
                  <tr
                    key={app.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                      {app.applicationNumber}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {app.candidateName}
                        </span>
                        {app.applicantRole === 'tutor' ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            Instructor
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Candidate
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">
                        {app.tutorCustomId || app.candidateCustomId}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                        {app.courseName}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                        {app.batchName}
                      </div>
                    </td>

                    <td className="px-4 py-3">{getTypeBadge(app.leaveTypeName)}</td>

                    <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {app.startDate} <span className="text-slate-400">to</span> {app.endDate}
                    </td>

                    <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-white tabular-nums">
                      {app.totalDays}
                    </td>

                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(app.appliedAt).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(app.status)}</td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onSelectApplication(app)}
                          title="View Full Application Details"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {app.status === 'pending' && (
                          <>
                            <button
                              onClick={() => onQuickApprove(app)}
                              title="Approve Application"
                              className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onQuickReject(app)}
                              title="Reject Application"
                              className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-800"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {app.status === 'approved' && (
                          <button
                            onClick={() => onQuickRevoke(app)}
                            title="Revoke / Cancel Approval"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} applications
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 font-mono">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

