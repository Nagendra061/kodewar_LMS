import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext.tsx';
import type { LeaveType, LeavePolicy, LeaveApplication } from '../../../types/index.ts';
import {
  calculateLeaveDays,
  validateLeaveDates,
  checkLeaveOverlap,
  getTodayDateString,
} from '../../../common/validation/leaveValidation.ts';
import {
  X,
  Calendar,
  Clock,
  User,
  BookOpen,
  Layers,
  FileText,
  Upload,
  AlertCircle,
  CheckCircle2,
  Paperclip,
  Trash2,
  ShieldAlert,
} from 'lucide-react';

interface ApplyLeaveModalProps {
  leaveTypes: LeaveType[];
  policy: LeavePolicy;
  existingApplications: LeaveApplication[];
  onClose: () => void;
  onSubmitSuccess: (newApp: LeaveApplication) => void;
  onApply: (data: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason: string;
    attachments?: Array<{ fileName: string; fileSize: number; mimeType: string; dataUrl: string }>;
  }) => Promise<LeaveApplication>;
}

export const ApplyLeaveModal: React.FC<ApplyLeaveModalProps> = ({
  leaveTypes,
  policy,
  existingApplications,
  onClose,
  onSubmitSuccess,
  onApply,
}) => {
  const { user } = useAuth();
  const cand = user as any;

  const todayStr = getTodayDateString('Asia/Kolkata');

  // Active leave types only
  const activeTypes = leaveTypes.filter((t) => t.isActive);

  // Form states
  const [leaveTypeId, setLeaveTypeId] = useState<string>(activeTypes[0]?.id || '');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [reason, setReason] = useState<string>('');
  const [attachments, setAttachments] = useState<
    Array<{ fileName: string; fileSize: number; mimeType: string; dataUrl: string }>
  >([]);

  // Validation & UI states
  const [formError, setFormError] = useState<string | null>(null);
  const [calculatedDays, setCalculatedDays] = useState<number>(1);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);

  // Selected leave type metadata
  const selectedType = activeTypes.find((t) => t.id === leaveTypeId) || activeTypes[0];

  // Real-time calculation and validation effect
  useEffect(() => {
    if (!startDate || !endDate) {
      setCalculatedDays(0);
      setOverlapWarning(null);
      return;
    }

    // 1. Calculate duration
    const days = calculateLeaveDays(startDate, endDate, policy.calculationMode || 'working_days');
    setCalculatedDays(days);

    // 2. Overlap check
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

  // File upload handler (converts file to Base64 for database persistence)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileUploadError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const maxSizeBytes = 5 * 1024 * 1024; // 5 MB max
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
      setFileUploadError('Failed to read the selected file.');
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate dates
    const dateVal = validateLeaveDates(startDate, endDate, policy, 'Asia/Kolkata');
    if (!dateVal.isValid) {
      setFormError(dateVal.error || 'Invalid leave dates.');
      return;
    }

    if (calculatedDays <= 0) {
      setFormError(
        `Selected dates result in 0 days under the ${policy.calculationMode === 'working_days' ? 'working days' : 'calendar days'} policy. Please choose active instructional days.`
      );
      return;
    }

    if (!reason.trim()) {
      setFormError('Please describe the reason for your leave application.');
      return;
    }

    // Check mandatory document requirements
    if (selectedType?.requiresDocument && attachments.length === 0) {
      setFormError(`Supporting documentation is mandatory for "${selectedType.name}". Please attach a document.`);
      return;
    }

    if (
      policy.requireAttachmentAboveDays > 0 &&
      calculatedDays > policy.requireAttachmentAboveDays &&
      attachments.length === 0
    ) {
      setFormError(
        `Company policy requires a supporting attachment for leave exceeding ${policy.requireAttachmentAboveDays} days.`
      );
      return;
    }

    // Check overlap
    const overlap = checkLeaveOverlap(startDate, endDate, existingApplications);
    if (overlap.hasOverlap && overlap.overlappingApp) {
      const opp = overlap.overlappingApp;
      setFormError(
        `Cannot submit: Overlapping leave application (${opp.applicationNumber} from ${opp.startDate} to ${opp.endDate}) already exists.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const newApp = await onApply({
        leaveTypeId,
        startDate,
        endDate,
        reason: reason.trim(),
        attachments,
      });
      onSubmitSuccess(newApp);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit leave application.');
    } finally {
      setIsSubmitting(false);
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
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Submit Leave Application
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Formal candidate leave request validated against institution policy.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {overlapWarning && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{overlapWarning}</span>
            </div>
          )}

          {/* Section 1: Auto-populated Candidate Details (Read-only) */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Applicant Profile (Auto-Populated)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-400 block">Candidate Name</span>
                <span className="font-semibold text-slate-900 dark:text-white block truncate">
                  {cand?.name || 'Enrolled Candidate'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Candidate ID</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 block">
                  {cand?.candidateId || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Course</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">
                  {cand?.courseName || 'Registered Course'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Batch</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">
                  {cand?.batchName || 'Active Batch'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Leave Type Selection */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Leave Category <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {activeTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.requiresDocument ? '(Document Required)' : ''}
                </option>
              ))}
            </select>
            {selectedType?.description && (
              <p className="text-[11px] text-slate-500 mt-1 italic">
                {selectedType.description}
              </p>
            )}
          </div>

          {/* Section 3: Date Range & Live Duration Calculation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Leave Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                min={!policy.allowRetrospective ? todayStr : undefined}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              {!policy.allowRetrospective && (
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Retrospective leave disabled by company policy.
                </span>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Leave End Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Live Calculated Duration Callout */}
          <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <div>
                <span className="text-[11px] font-bold text-slate-900 dark:text-white block">
                  Automatically Calculated Duration
                </span>
                <span className="text-[10px] text-slate-500">
                  {policy.calculationMode === 'working_days'
                    ? 'Working days policy (weekends excluded)'
                    : 'Calendar days policy'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                {calculatedDays} {calculatedDays === 1 ? 'Day' : 'Days'}
              </span>
            </div>
          </div>

          {/* Section 4: Leave Reason */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Detailed Reason for Leave <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400">{reason.length} / 500 chars</span>
            </div>
            <textarea
              required
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please explain the reason for your absence clearly for administrative approval..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Section 5: Supporting Document Attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Supporting Documentation {selectedType?.requiresDocument && <span className="text-rose-500">*</span>}
              </label>
              <span className="text-[10px] text-slate-400">PDF, JPG, PNG up to 5MB</span>
            </div>

            {fileUploadError && (
              <span className="text-[11px] text-rose-600 block">{fileUploadError}</span>
            )}

            {/* Upload Area */}
            <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 dark:bg-slate-800/30 transition-colors">
              <Upload className="w-5 h-5 text-slate-400 mb-1" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Click to upload supporting document
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Medical certificates, doctor slips, tickets, or official letters
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={handleFileUpload}
              />
            </label>

            {/* Uploaded File List */}
            {attachments.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {attachments.map((att, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {att.fileName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({(att.fileSize / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(i)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Remove file"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Validating & Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

