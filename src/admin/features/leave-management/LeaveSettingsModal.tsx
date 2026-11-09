import React, { useState } from 'react';
import type { LeaveType, LeavePolicy } from '../../../types/index.ts';
import {
  X,
  Settings,
  Plus,
  Edit2,
  Trash2,
  Check,
  AlertCircle,
  FileCheck,
  Calendar,
  Layers,
  Save,
} from 'lucide-react';

interface LeaveSettingsModalProps {
  leaveTypes: LeaveType[];
  policy: LeavePolicy;
  onClose: () => void;
  onCreateLeaveType: (data: Partial<LeaveType>) => Promise<void>;
  onUpdateLeaveType: (id: string, data: Partial<LeaveType>) => Promise<void>;
  onDeleteLeaveType: (id: string) => Promise<void>;
  onUpdatePolicy: (policy: Partial<LeavePolicy>) => Promise<void>;
}

export const LeaveSettingsModal: React.FC<LeaveSettingsModalProps> = ({
  leaveTypes,
  policy,
  onClose,
  onCreateLeaveType,
  onUpdateLeaveType,
  onDeleteLeaveType,
  onUpdatePolicy,
}) => {
  const [activeTab, setActiveTab] = useState<'types' | 'policy'>('types');
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form states for leave type
  const [typeName, setTypeName] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [typeDesc, setTypeDesc] = useState('');
  const [typeRequiresDoc, setTypeRequiresDoc] = useState(false);
  const [typeMaxDays, setTypeMaxDays] = useState(12);
  const [typeColor, setTypeColor] = useState('blue');
  const [typeIsActive, setTypeIsActive] = useState(true);

  // Form states for policy
  const [calcMode, setCalcMode] = useState<'working_days' | 'calendar_days'>(
    policy.calculationMode || 'working_days'
  );
  const [allowRetro, setAllowRetro] = useState(policy.allowRetrospective || false);
  const [maxConsecutive, setMaxConsecutive] = useState(policy.maxConsecutiveDays || 30);
  const [docThreshold, setDocThreshold] = useState(policy.requireAttachmentAboveDays || 2);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetTypeForm = () => {
    setEditingType(null);
    setIsAddingNew(false);
    setTypeName('');
    setTypeCode('');
    setTypeDesc('');
    setTypeRequiresDoc(false);
    setTypeMaxDays(12);
    setTypeColor('blue');
    setTypeIsActive(true);
    setError(null);
  };

  const handleStartEdit = (t: LeaveType) => {
    setEditingType(t);
    setIsAddingNew(false);
    setTypeName(t.name);
    setTypeCode(t.code);
    setTypeDesc(t.description || '');
    setTypeRequiresDoc(!!t.requiresDocument);
    setTypeMaxDays(t.maxDaysPerYear || 12);
    setTypeColor(t.color || 'blue');
    setTypeIsActive(t.isActive !== false);
    setError(null);
  };

  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      if (editingType) {
        await onUpdateLeaveType(editingType.id, {
          name: typeName.trim(),
          code: typeCode.trim().toUpperCase(),
          description: typeDesc.trim(),
          requiresDocument: typeRequiresDoc,
          maxDaysPerYear: Number(typeMaxDays),
          color: typeColor,
          isActive: typeIsActive,
        });
        setSuccess(`Leave type "${typeName}" updated successfully.`);
      } else {
        await onCreateLeaveType({
          name: typeName.trim(),
          code: typeCode.trim().toUpperCase(),
          description: typeDesc.trim(),
          requiresDocument: typeRequiresDoc,
          maxDaysPerYear: Number(typeMaxDays),
          color: typeColor,
          isActive: typeIsActive,
        });
        setSuccess(`Leave type "${typeName}" created successfully.`);
      }
      resetTypeForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save leave type.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteType = async (t: LeaveType) => {
    if (!window.confirm(`Are you sure you want to remove or deactivate "${t.name}"?`)) return;
    setError(null);
    try {
      await onDeleteLeaveType(t.id);
      setSuccess(`Leave type "${t.name}" processed.`);
    } catch (err: any) {
      setError(err.message || 'Failed to delete leave type.');
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await onUpdatePolicy({
        calculationMode: calcMode,
        allowRetrospective: allowRetro,
        maxConsecutiveDays: Number(maxConsecutive),
        requireAttachmentAboveDays: Number(docThreshold),
      });
      setSuccess('Leave policy configuration saved successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to save leave policy.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl flex flex-col my-8 max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/40 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Leave Policy & Types Configuration
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure organizational leave types, duration calculation rules, and validation limits.
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

        {/* Tab switcher */}
        <div className="px-6 pt-3 border-b border-slate-200 dark:border-slate-800 flex gap-4 text-xs font-semibold">
          <button
            onClick={() => {
              setActiveTab('types');
              setError(null);
            }}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'types'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Configurable Leave Types ({leaveTypes.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('policy');
              setError(null);
            }}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'policy'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Company Calculation & Validation Policy</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* TAB 1: LEAVE TYPES */}
          {activeTab === 'types' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Defined Leave Categories
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Candidates select from these categories when submitting leave applications.
                  </p>
                </div>
                {!isAddingNew && !editingType && (
                  <button
                    onClick={() => {
                      setIsAddingNew(true);
                      setEditingType(null);
                      setTypeName('');
                      setTypeCode('');
                      setTypeDesc('');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Leave Type</span>
                  </button>
                )}
              </div>

              {/* Add / Edit Form */}
              {(isAddingNew || editingType) && (
                <form
                  onSubmit={handleSaveType}
                  className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20 space-y-4 text-xs"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-blue-100 dark:border-blue-900">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {editingType ? `Edit Leave Type: ${editingType.name}` : 'Create New Leave Type'}
                    </span>
                    <button
                      type="button"
                      onClick={resetTypeForm}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Leave Type Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={typeName}
                        onChange={(e) => setTypeName(e.target.value)}
                        placeholder="e.g. Bereavement Leave"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        System Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={typeCode}
                        onChange={(e) => setTypeCode(e.target.value)}
                        placeholder="e.g. BEREAVEMENT"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white uppercase font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Description / Guidelines for Candidates
                    </label>
                    <input
                      type="text"
                      value={typeDesc}
                      onChange={(e) => setTypeDesc(e.target.value)}
                      placeholder="e.g. Leave granted in case of bereavement in immediate family."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Badge Color
                      </label>
                      <select
                        value={typeColor}
                        onChange={(e) => setTypeColor(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="rose">Rose / Pink (Sick)</option>
                        <option value="blue">Blue (Personal)</option>
                        <option value="amber">Amber / Orange (Emergency)</option>
                        <option value="purple">Purple (Academic)</option>
                        <option value="emerald">Emerald / Green</option>
                        <option value="slate">Slate / Neutral</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Annual Allowance (Days)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={typeMaxDays}
                        onChange={(e) => setTypeMaxDays(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="flex flex-col justify-end space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={typeRequiresDoc}
                          onChange={(e) => setTypeRequiresDoc(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Require supporting document</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={typeIsActive}
                          onChange={(e) => setTypeIsActive(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Active for candidate selection</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-blue-100 dark:border-blue-900">
                    <button
                      type="button"
                      onClick={resetTypeForm}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : editingType ? 'Save Changes' : 'Create Type'}
                    </button>
                  </div>
                </form>
              )}

              {/* Leave Types Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Leave Type</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Requires Doc</th>
                      <th className="px-4 py-3">Max Days</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {leaveTypes.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {t.name}
                            </span>
                          </div>
                          {t.description && (
                            <span className="text-[11px] text-slate-400 block truncate max-w-xs">
                              {t.description}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300 text-[11px]">
                          {t.code}
                        </td>
                        <td className="px-4 py-3">
                          {t.requiresDocument ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                              <FileCheck className="w-3 h-3" />
                              Mandatory
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Optional</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {t.maxDaysPerYear || 12} d/yr
                        </td>
                        <td className="px-4 py-3">
                          {t.isActive ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleStartEdit(t)}
                              title="Edit type"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteType(t)}
                              title="Deactivate / Delete type"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: COMPANY POLICY SETTINGS */}
          {activeTab === 'policy' && (
            <form onSubmit={handleSavePolicy} className="space-y-6 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Duration Calculation Policy
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Controls whether leave days count standard working days (Mon-Fri) or all calendar days.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      calcMode === 'working_days'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <input
                      type="radio"
                      name="calcMode"
                      value="working_days"
                      checked={calcMode === 'working_days'}
                      onChange={() => setCalcMode('working_days')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        Working Days Only (Recommended)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block leading-relaxed">
                        Excludes Saturdays and Sundays. Only actual instructional and lecture working days count toward total leave duration.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      calcMode === 'calendar_days'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <input
                      type="radio"
                      name="calcMode"
                      value="calendar_days"
                      checked={calcMode === 'calendar_days'}
                      onChange={() => setCalcMode('calendar_days')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        Calendar Days
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block leading-relaxed">
                        Counts all consecutive calendar days between start and end date inclusive, including weekends and holidays.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Validation Constraints */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Application Rules & Limits
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Submission timing and documentation requirements enforced during candidate application.
                  </p>
                </div>

                <div className="space-y-4 pt-1">
                  {/* Retrospective Leave Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white block">
                        Allow Retrospective Leave
                      </span>
                      <span className="text-[11px] text-slate-500 mt-0.5 block">
                        When enabled, candidates can apply for leave starting on past dates. When disabled, start date must be today or future.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowRetro}
                        onChange={(e) => setAllowRetro(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Max Consecutive Leave Days
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={maxConsecutive}
                        onChange={(e) => setMaxConsecutive(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Prevents candidates from applying for excessively long blocks without manual admin intervention.
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Mandatory Document Threshold (Days)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={docThreshold}
                        onChange={(e) => setDocThreshold(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Applications exceeding this duration strictly require at least one supporting document.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving Policy...' : 'Save Company Policy'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

