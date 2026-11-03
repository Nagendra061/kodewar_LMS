import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../services/api.ts';
import type { CandidateUser, Course, Batch, CandidateBatchAssignment, AttendanceRecord } from '../types/index.ts';
import {
  UserPlus,
  Upload,
  Download,
  Search,
  Filter,
  Eye,
  Edit2,
  Mail,
  History,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Phone,
  Calendar,
  FileSpreadsheet,
  FileText,
  Check,
  Trash2,
} from 'lucide-react';

export const CandidatesView: React.FC = () => {
  const [candidates, setCandidates] = useState<CandidateUser[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals & Drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<CandidateUser | null>(null);

  // Form states
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCustomId, setNewCustomId] = useState('');
  const [newCourseId, setNewCourseId] = useState('');
  const [newBatchId, setNewBatchId] = useState('');
  const [newEnrollmentDate, setNewEnrollmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [newRemarks, setNewRemarks] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ id: string; tempPass: string } | null>(null);

  // Bulk import state
  const [importTab, setImportTab] = useState<'upload' | 'text'>('upload');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [extractedRows, setExtractedRows] = useState<any[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importDefaultCourse, setImportDefaultCourse] = useState('');
  const [importDefaultBatch, setImportDefaultBatch] = useState('');
  const [importPreviewData, setImportPreviewData] = useState<any | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [candRes, crsRes, bchRes] = await Promise.all([
        api.getCandidates({
          courseId: courseFilter || undefined,
          batchId: batchFilter || undefined,
          status: statusFilter || undefined,
          search: search || undefined,
        }),
        api.getCourses(),
        api.getBatches(),
      ]);

      setCandidates(candRes.candidates);
      setCourses(crsRes.courses);
      setBatches(bchRes.batches);

      if (crsRes.courses.length > 0 && !newCourseId) {
        setNewCourseId(crsRes.courses[0].id);
        const matchingBatches = bchRes.batches.filter((b) => b.courseId === crsRes.courses[0].id);
        if (matchingBatches.length > 0) {
          setNewBatchId(matchingBatches[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching candidate data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [courseFilter, batchFilter, statusFilter, search]);

  const handleCourseChangeInForm = (cId: string) => {
    setNewCourseId(cId);
    const matching = batches.filter((b) => b.courseId === cId);
    setNewBatchId(matching.length > 0 ? matching[0].id : '');
  };

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    try {
      const res = await api.createCandidate({
        name: newName,
        email: newEmail,
        phone: newPhone,
        candidateId: newCustomId || undefined,
        courseId: newCourseId,
        batchId: newBatchId,
        enrollmentDate: newEnrollmentDate,
        remarks: newRemarks,
      });

      setFormSuccess(`Candidate ${res.candidate.name} created successfully.`);
      setCreatedCredentials({
        id: res.candidate.candidateId,
        tempPass: res.tempPassword || 'Pass@2026',
      });
      loadAll();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create candidate');
    }
  };

  const handleOpenDetails = async (candidateId: string) => {
    setDrawerLoading(true);
    try {
      const res = await api.getCandidateById(candidateId);
      setSelectedCandidate(res);
    } catch (err: any) {
      alert(err.message || 'Failed to load details');
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleResendActivation = async (candidateId: string) => {
    try {
      const res = await api.resendCandidateActivation(candidateId);
      alert(`Activation instructions resent to candidate email.\nNew Temporary Password: ${res.tempPassword}`);
      loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to resend activation');
    }
  };

  const handleUpdateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCandidate) return;

    try {
      await api.updateCandidate(editingCandidate.id, {
        name: editingCandidate.name,
        email: editingCandidate.email,
        phone: editingCandidate.phone,
        status: editingCandidate.status,
        remarks: editingCandidate.remarks,
        courseId: editingCandidate.courseId,
        batchId: editingCandidate.currentBatchId,
        enrollmentDate: editingCandidate.enrollmentDate,
      });
      setEditingCandidate(null);
      loadAll();
      if (selectedCandidate && selectedCandidate.candidate.id === editingCandidate.id) {
        handleOpenDetails(editingCandidate.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update candidate');
    }
  };

  const handleDeleteCandidate = async (candidateId: string, candidateName: string) => {
    if (!confirm(`Are you sure you want to permanently delete candidate "${candidateName}"?\n\nThis will remove their profile, batch allocations, and attendance records from the system.`)) {
      return;
    }

    try {
      await api.deleteCandidate(candidateId);
      if (selectedCandidate && selectedCandidate.candidate.id === candidateId) {
        setSelectedCandidate(null);
      }
      loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to delete candidate');
    }
  };

  // Template generators
  const downloadExcelTemplate = () => {
    const wsData = [
      ['Full Name', 'Email', 'Phone', 'Candidate ID', 'Remarks'],
      ['Aarav Sharma', 'aarav.sharma@example.com', '+91 9876543210', 'KDL-2026-001', 'Graduate - Computer Science'],
      ['Priya Patel', 'priya.patel@example.com', '+91 9876543211', 'KDL-2026-002', 'Fast learner'],
      ['Rohan Verma', 'rohan.verma@example.com', '+91 9876543212', 'KDL-2026-003', 'Frontend specialist'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
    XLSX.writeFile(wb, 'candidate_import_template.xlsx');
  };

  const downloadCsvTemplate = () => {
    const blob = new Blob([sampleCsvTemplate], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidate_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Excel and CSV file processor
  const handleProcessFile = (file: File) => {
    setFileError(null);
    setUploadedFileName(file.name);
    setImportResult(null);
    setImportPreviewData(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          setFileError('The uploaded file does not contain any worksheets.');
          return;
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          setFileError('No candidate records found in the uploaded file.');
          return;
        }

        const parsedRows = rawJson.map((row: any) => {
          const rowObj: any = {};
          for (const [key, val] of Object.entries(row)) {
            const k = key.trim().toLowerCase();
            const v = String(val).trim();
            if (k.includes('name')) rowObj.name = v;
            else if (k.includes('email')) rowObj.email = v;
            else if (k.includes('phone') || k.includes('mobile') || k.includes('contact')) rowObj.phone = v;
            else if (k.includes('candidate') || (k.includes('id') && !k.includes('course') && !k.includes('batch'))) rowObj.candidateId = v;
            else if (k.includes('remark') || k.includes('note') || k.includes('comment')) rowObj.remarks = v;
            else if (k.includes('course')) rowObj.courseId = v;
            else if (k.includes('batch')) rowObj.batchId = v;
            else if (k.includes('date')) rowObj.enrollmentDate = v;
          }
          return rowObj;
        });

        const candidatesOnly = parsedRows.filter((r) => r.name || r.email);
        if (candidatesOnly.length === 0) {
          setFileError('Could not recognize candidate columns. Please use the downloadable template (Name, Email, Phone, Candidate ID).');
          return;
        }

        setExtractedRows(candidatesOnly);
      } catch (err: any) {
        console.error('File parsing error:', err);
        setFileError(err.message || 'Failed to read spreadsheet file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Bulk Import Preview & Commit
  const handleRunPreview = async () => {
    setImportLoading(true);
    setImportResult(null);
    try {
      let rowsToValidate: any[] = [];
      if (importTab === 'upload') {
        if (extractedRows.length === 0) {
          alert('Please upload an Excel or CSV file first.');
          setImportLoading(false);
          return;
        }
        rowsToValidate = extractedRows;
      } else {
        const lines = importCsvText.trim().split('\n');
        if (lines.length < 2) {
          alert('Please paste at least one header row and one candidate data row.');
          setImportLoading(false);
          return;
        }

        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.split(',').map((c) => c.replace(/(^"|"$)/g, '').trim());
          const rowObj: any = {};
          headers.forEach((h, idx) => {
            if (h.includes('name')) rowObj.name = cols[idx];
            else if (h.includes('email')) rowObj.email = cols[idx];
            else if (h.includes('phone') || h.includes('mobile')) rowObj.phone = cols[idx];
            else if (h.includes('id')) rowObj.candidateId = cols[idx];
            else if (h.includes('remark')) rowObj.remarks = cols[idx];
          });
          rowsToValidate.push(rowObj);
        }
      }

      const previewRes = await api.importPreview(
        rowsToValidate,
        importDefaultCourse || courses[0]?.id,
        importDefaultBatch || batches[0]?.id
      );
      setImportPreviewData(previewRes);
    } catch (err: any) {
      alert(err.message || 'Failed to process import preview');
    } finally {
      setImportLoading(false);
    }
  };

  const handleCommitImport = async () => {
    if (!importPreviewData || importPreviewData.validRows.length === 0) return;
    setImportLoading(true);
    try {
      const res = await api.importCommit(importPreviewData.validRows);
      setImportResult(res);
      setImportPreviewData(null);
      loadAll();
    } catch (err: any) {
      alert(err.message || 'Commit failed');
    } finally {
      setImportLoading(false);
    }
  };

  const sampleCsvTemplate = `Name,Email,Phone,Candidate_ID,Remarks
Aarav Sharma,aarav.sharma@example.com,+91 9876543210,KDL-2026-001,Graduate - Computer Science
Priya Patel,priya.patel@example.com,+91 9876543211,KDL-2026-002,Fast learner
Rohan Verma,rohan.verma@example.com,+91 9876543212,KDL-2026-003,Frontend specialist`;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Primary Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Candidate Directory & Lifecycle
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enforce one-active-batch allocation, manage temporary credentials, and review batch histories.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setImportCsvText(sampleCsvTemplate);
              setImportTab('upload');
              setUploadedFileName(null);
              setExtractedRows([]);
              setFileError(null);
              setImportPreviewData(null);
              setImportResult(null);
              setImportDefaultCourse(courses[0]?.id || '');
              const bchs = batches.filter((b) => b.courseId === courses[0]?.id);
              setImportDefaultBatch(bchs[0]?.id || '');
              setShowImportModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Bulk Candidate Import</span>
          </button>
          <button
            onClick={() => {
              setFormError(null);
              setFormSuccess(null);
              setCreatedCredentials(null);
              setNewName('');
              setNewEmail('');
              setNewPhone('');
              setNewCustomId('');
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Candidate</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate by name, ID, email, or phone..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending_activation">Pending Setup</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Candidates Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Candidate ID</th>
                <th className="py-3 px-4">Name & Email</th>
                <th className="py-3 px-4">Course & Batch</th>
                <th className="py-3 px-4">Enrolled Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No candidates found matching the selected filter criteria.
                  </td>
                </tr>
              ) : (
                candidates.map((cand) => (
                  <tr key={cand.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-white tabular-nums">
                      {cand.candidateId}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-white">{cand.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{cand.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 dark:text-slate-200">{cand.courseName}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{cand.batchName}</div>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-600 dark:text-slate-400">
                      {cand.enrollmentDate}
                    </td>
                    <td className="py-3 px-4">
                      {cand.status === 'active' && (
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </span>
                      )}
                      {cand.status === 'pending_activation' && (
                        <span className="text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Pending Setup</span>
                        </span>
                      )}
                      {cand.status === 'inactive' && (
                        <span className="text-slate-500 font-medium">Inactive</span>
                      )}
                      {cand.status === 'archived' && (
                        <span className="text-rose-600 font-medium">Archived</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenDetails(cand.id)}
                          title="View Profile & Assignment History"
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingCandidate(cand)}
                          title="Edit Candidate"
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {cand.status === 'pending_activation' && (
                          <button
                            onClick={() => handleResendActivation(cand.id)}
                            title="Resend Activation Credentials"
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteCandidate(cand.id, cand.name)}
                          title="Delete Candidate"
                          className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Individual Candidate */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Add New Candidate
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-xs text-rose-700">
                {formError}
              </div>
            )}

            {formSuccess && createdCredentials ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-xs text-emerald-800 dark:text-emerald-300 space-y-2">
                  <p className="font-semibold">{formSuccess}</p>
                  <p>An activation email has been queued in the system email outbox.</p>
                  <div className="mt-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-300 dark:border-emerald-800 font-mono text-xs">
                    <div>Candidate ID: <strong>{createdCredentials.id}</strong></div>
                    <div>Temporary Password: <strong>{createdCredentials.tempPass}</strong></div>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateCandidate} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Maya Iyer"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="e.g. maya@example.com"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+91 98000 00000"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Candidate ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={newCustomId}
                      onChange={(e) => setNewCustomId(e.target.value)}
                      placeholder="Auto-generated if empty"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Course *
                    </label>
                    <select
                      value={newCourseId}
                      onChange={(e) => handleCourseChangeInForm(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Assigned Batch *
                    </label>
                    <select
                      value={newBatchId}
                      onChange={(e) => setNewBatchId(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      {batches
                        .filter((b) => b.courseId === newCourseId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.capacity - (b.candidateCount || 0)} seats left)
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Internal Notes / Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={newRemarks}
                    onChange={(e) => setNewRemarks(e.target.value)}
                    placeholder="Candidate background, special accommodations..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-xs font-semibold"
                  >
                    Create Candidate
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Bulk Excel / CSV Import with Preview */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Bulk Candidate Import
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Upload an Excel workbook (.xlsx, .xls) or CSV spreadsheet to validate and enroll candidates in bulk.
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {importResult ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Successfully imported {importResult.importedCount} candidate records!</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Accounts and initial batch assignments have been created. Temporary activation credentials have been dispatched.
                  </p>
                </div>
              ) : !importPreviewData ? (
                <div className="space-y-4">
                  {/* Download Templates Banner */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Need the standard template?
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Download sample file with pre-formatted column headers
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={downloadExcelTemplate}
                        type="button"
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Excel (.xlsx)</span>
                      </button>
                      <button
                        onClick={downloadCsvTemplate}
                        type="button"
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>CSV (.csv)</span>
                      </button>
                    </div>
                  </div>

                  {/* Course & Batch Default Fallbacks */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Default Course
                      </label>
                      <select
                        value={importDefaultCourse}
                        onChange={(e) => setImportDefaultCourse(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Default Batch
                      </label>
                      <select
                        value={importDefaultBatch}
                        onChange={(e) => setImportDefaultBatch(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Tab Selector: Upload Spreadsheet vs Paste CSV */}
                  <div className="flex border-b border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setImportTab('upload')}
                      className={`pb-2 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                        importTab === 'upload'
                          ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                          : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Upload Excel / CSV File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportTab('text')}
                      className={`pb-2 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                        importTab === 'text'
                          ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                          : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Paste Raw CSV Text</span>
                    </button>
                  </div>

                  {/* Tab Content 1: Upload File */}
                  {importTab === 'upload' && (
                    <div className="space-y-3">
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          if (e.dataTransfer.files?.[0]) {
                            handleProcessFile(e.dataTransfer.files[0]);
                          }
                        }}
                        className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                          isDragging
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                            : uploadedFileName
                            ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10'
                            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-slate-50/50 dark:bg-slate-800/30'
                        }`}
                        onClick={() => {
                          const el = document.getElementById('excel-file-input');
                          if (el) el.click();
                        }}
                      >
                        <input
                          id="excel-file-input"
                          type="file"
                          accept=".xlsx, .xls, .csv"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleProcessFile(e.target.files[0]);
                            }
                          }}
                        />

                        {uploadedFileName ? (
                          <div className="flex flex-col items-center justify-center space-y-1.5">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                              <Check className="w-5 h-5" />
                            </div>
                            <div className="text-xs font-semibold text-slate-900 dark:text-white">
                              {uploadedFileName}
                            </div>
                            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                              Extracted {extractedRows.length} candidate record{extractedRows.length === 1 ? '' : 's'}
                            </div>
                            <span className="text-[10px] text-slate-400 hover:underline pt-1">
                              Click or drop another file to replace
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center space-y-1.5">
                            <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                              <Upload className="w-4 h-4" />
                            </div>
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              Click to select an Excel (.xlsx, .xls) or CSV file
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              or drag and drop your spreadsheet file here
                            </p>
                          </div>
                        )}
                      </div>

                      {fileError && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 rounded-lg flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{fileError}</span>
                        </div>
                      )}

                      {/* Extracted preview snippet */}
                      {extractedRows.length > 0 && (
                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800/40 space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <span>Extracted Records Sample</span>
                            <span className="text-[11px] font-normal text-slate-500">
                              Showing {Math.min(extractedRows.length, 3)} of {extractedRows.length} candidates
                            </span>
                          </div>
                          <div className="max-h-32 overflow-y-auto">
                            <table className="w-full text-left text-[11px]">
                              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-medium">
                                <tr>
                                  <th className="p-1.5">Name</th>
                                  <th className="p-1.5">Email</th>
                                  <th className="p-1.5">Phone</th>
                                  <th className="p-1.5">Candidate ID</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {extractedRows.slice(0, 3).map((r: any, idx: number) => (
                                  <tr key={idx}>
                                    <td className="p-1.5 font-medium text-slate-900 dark:text-white">{r.name || '—'}</td>
                                    <td className="p-1.5 text-slate-600 dark:text-slate-300">{r.email || '—'}</td>
                                    <td className="p-1.5 text-slate-500">{r.phone || '—'}</td>
                                    <td className="p-1.5 font-mono text-[10px] text-slate-500">{r.candidateId || 'Auto'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab Content 2: Raw CSV Text */}
                  {importTab === 'text' && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          CSV Data (Paste or edit template below)
                        </label>
                        <button
                          onClick={() => setImportCsvText(sampleCsvTemplate)}
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Reset to Sample Template
                        </button>
                      </div>
                      <textarea
                        rows={6}
                        value={importCsvText}
                        onChange={(e) => setImportCsvText(e.target.value)}
                        placeholder="Name,Email,Phone,Candidate_ID,Remarks..."
                        className="w-full p-3 font-mono text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* Import Preview Breakdown */
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">Valid Records</div>
                      <div className="text-xl font-bold text-emerald-800 dark:text-emerald-200 tabular-nums">
                        {importPreviewData.summary.valid}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                      <div className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">Duplicates (Skip)</div>
                      <div className="text-xl font-bold text-amber-800 dark:text-amber-200 tabular-nums">
                        {importPreviewData.summary.duplicate}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60">
                      <div className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">Invalid Rows</div>
                      <div className="text-xl font-bold text-rose-800 dark:text-rose-200 tabular-nums">
                        {importPreviewData.summary.invalid}
                      </div>
                    </div>
                  </div>

                  {importPreviewData.validRows.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                        Ready to Commit ({importPreviewData.validRows.length} candidates)
                      </h4>
                      <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-medium">
                            <tr>
                              <th className="p-2">Name</th>
                              <th className="p-2">Email</th>
                              <th className="p-2">Batch</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {importPreviewData.validRows.map((r: any, idx: number) => (
                              <tr key={idx}>
                                <td className="p-2">{r.name}</td>
                                <td className="p-2">{r.email}</td>
                                <td className="p-2">{r.batchName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {importPreviewData.duplicateRows.length > 0 && (
                    <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/60 rounded-lg text-xs">
                      <span className="font-semibold text-amber-800 dark:text-amber-300">Duplicate detection: </span>
                      {importPreviewData.duplicateRows.map((d: any, idx: number) => (
                        <div key={idx} className="text-[11px] text-amber-700 dark:text-amber-400">
                          Row {d.row}: {d.data.email} — {d.reason}
                        </div>
                      ))}
                    </div>
                  )}

                  {importPreviewData.invalidRows?.length > 0 && (
                    <div className="p-3 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/60 rounded-lg text-xs">
                      <span className="font-semibold text-rose-800 dark:text-rose-300">Validation errors: </span>
                      {importPreviewData.invalidRows.map((inv: any, idx: number) => (
                        <div key={idx} className="text-[11px] text-rose-700 dark:text-rose-400">
                          Row {inv.row}: {inv.errors?.join(', ') || 'Incomplete fields'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setImportPreviewData(null);
                  setImportResult(null);
                }}
                className="text-xs text-slate-500 hover:underline"
              >
                {importPreviewData ? 'Back to Editor' : ''}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300"
                >
                  {importResult ? 'Close' : 'Cancel'}
                </button>

                {!importResult && !importPreviewData && (
                  <button
                    onClick={handleRunPreview}
                    disabled={importLoading || (importTab === 'upload' && extractedRows.length === 0)}
                    className="px-4 py-1.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                  >
                    {importLoading ? 'Validating Rows...' : 'Preview Validation'}
                  </button>
                )}

                {importPreviewData && importPreviewData.validRows.length > 0 && (
                  <button
                    onClick={handleCommitImport}
                    disabled={importLoading}
                    className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                  >
                    {importLoading ? 'Importing...' : `Confirm Import (${importPreviewData.validRows.length})`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Profile & Assignment History Drawer */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedCandidate.candidate.name}
                </h3>
                <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                  {selectedCandidate.candidate.candidateId}
                </p>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {selectedCandidate.candidate.email}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phone:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {selectedCandidate.candidate.phone || 'Not recorded'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Course:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {selectedCandidate.candidate.courseName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Active Batch:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {selectedCandidate.candidate.batchName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Enrollment Date:</span>
                <span className="font-mono tabular-nums">
                  {selectedCandidate.candidate.enrollmentDate}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Account Status:</span>
                <span className="capitalize font-medium">
                  {selectedCandidate.candidate.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Batch Assignment & Transfer History */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-purple-500" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Batch Assignment & Transfer History
                </h4>
              </div>

              <div className="space-y-2.5">
                {selectedCandidate.assignments?.map((asg: CandidateBatchAssignment) => (
                  <div
                    key={asg.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {asg.batchName}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                          asg.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {asg.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      <span>Start: {asg.startDate}</span>
                      {asg.endDate && <span> · End: {asg.endDate}</span>}
                    </div>
                    {asg.transferReason && (
                      <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded">
                        Reason: {asg.transferReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Verified Attendance History */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                Session Attendance Records
              </h4>
              {selectedCandidate.attendance?.length === 0 ? (
                <div className="text-xs text-slate-400 py-2">No attendance records yet.</div>
              ) : (
                <div className="space-y-2 text-xs">
                  {selectedCandidate.attendance?.map((att: AttendanceRecord) => (
                    <div
                      key={att.id}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {att.sessionTitle}
                        </div>
                        <div className="text-[11px] text-slate-400">{att.sessionDate}</div>
                      </div>
                      <span className="capitalize font-semibold text-[11px] text-emerald-600">
                        {att.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Candidate Modal */}
      {editingCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
              Edit Candidate Details
            </h3>

            <form onSubmit={handleUpdateCandidate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editingCandidate.name}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={editingCandidate.email}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, email: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editingCandidate.phone || ''}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, phone: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Course
                  </label>
                  <select
                    value={editingCandidate.courseId}
                    onChange={(e) => {
                      const newCId = e.target.value;
                      const matchingBatches = batches.filter((b) => b.courseId === newCId);
                      setEditingCandidate({
                        ...editingCandidate,
                        courseId: newCId,
                        currentBatchId: matchingBatches.length > 0 ? matchingBatches[0].id : '',
                      });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Batch
                  </label>
                  <select
                    value={editingCandidate.currentBatchId}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, currentBatchId: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {batches
                      .filter((b) => !editingCandidate.courseId || b.courseId === editingCandidate.courseId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={editingCandidate.status}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, status: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="active">Active</option>
                  <option value="pending_activation">Pending Setup</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Internal Remarks
                </label>
                <textarea
                  rows={2}
                  value={editingCandidate.remarks || ''}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, remarks: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCandidate(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-xs font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
