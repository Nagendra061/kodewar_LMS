import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { Batch, Course, CandidateUser } from '../types/index.ts';
import { Layers, Plus, Users, ArrowRightLeft, Calendar, Info, X, CheckCircle2, Edit2, Trash2 } from 'lucide-react';

export const BatchesView: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [candidates, setCandidates] = useState<CandidateUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [activeRosterBatch, setActiveRosterBatch] = useState<Batch | null>(null);
  const [rosterCandidates, setRosterCandidates] = useState<CandidateUser[]>([]);

  // Add Batch form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [capacity, setCapacity] = useState('30');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Transfer form state
  const [transferCandidateId, setTransferCandidateId] = useState('');
  const [destinationBatchId, setDestinationBatchId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [bchRes, crsRes, candRes] = await Promise.all([
        api.getBatches(),
        api.getCourses(),
        api.getCandidates({ status: 'active' }),
      ]);
      setBatches(bchRes.batches);
      setCourses(crsRes.courses);
      setCandidates(candRes.candidates);

      if (crsRes.courses.length > 0 && !courseId) {
        setCourseId(crsRes.courses[0].id);
      }
      if (candRes.candidates.length > 0 && !transferCandidateId) {
        setTransferCandidateId(candRes.candidates[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createBatch({
        code,
        name,
        courseId,
        capacity: Number(capacity),
        startDate,
        endDate,
        notes,
      });
      setShowAddModal(false);
      setCode('');
      setName('');
      setNotes('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create batch');
    }
  };

  const handleUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;
    try {
      await api.updateBatch(editingBatch.id, {
        code: editingBatch.code,
        name: editingBatch.name,
        courseId: editingBatch.courseId,
        capacity: Number(editingBatch.capacity),
        startDate: editingBatch.startDate,
        endDate: editingBatch.endDate,
        status: editingBatch.status,
        notes: editingBatch.notes,
      });
      setEditingBatch(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update batch');
    }
  };

  const handleDeleteBatch = async (batchId: string, batchName: string) => {
    if (!confirm(`Are you sure you want to delete batch "${batchName}"?\n\nAssociated meeting schedules and cohort allocations will be removed.`)) {
      return;
    }
    try {
      await api.deleteBatch(batchId, true);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete batch');
    }
  };

  const handleOpenRoster = async (batch: Batch) => {
    setActiveRosterBatch(batch);
    setShowRosterModal(true);
    try {
      const res = await api.getBatchRoster(batch.id);
      setRosterCandidates(res.roster);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);
    setTransferSuccess(null);
    setTransferLoading(true);

    try {
      const res = await api.transferBatch({
        candidateId: transferCandidateId,
        destinationBatchId,
        effectiveDate: transferDate,
        reason: transferReason,
      });
      setTransferSuccess(res.message);
      loadData();
      setTimeout(() => {
        setTransferSuccess(null);
        setShowTransferModal(false);
      }, 2500);
    } catch (err: any) {
      setTransferError(err.message || 'Transfer failed');
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Batches & Cohort Allocation
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Organize student cohorts, observe seat capacities, and perform auditable batch transfers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setTransferError(null);
              setTransferSuccess(null);
              setShowTransferModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Transfer Candidate</span>
          </button>

          <button
            onClick={() => {
              setError(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Batch</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : batches.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <Layers className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Batches Created Yet</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Create your first cohort batch under an available course to enroll candidates and schedule sessions.
          </p>
          <button
            onClick={() => {
              setError(null);
              setShowAddModal(true);
            }}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Batch</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {batches.map((batch) => {
            const seatsLeft = Math.max(0, batch.capacity - (batch.candidateCount || 0));
            const fillRate = Math.min(100, Math.round(((batch.candidateCount || 0) / batch.capacity) * 100));

            return (
              <div
                key={batch.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded">
                      {batch.code}
                    </span>
                    <span className="text-[11px] font-medium text-emerald-600 capitalize">
                      {batch.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                    {batch.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Course: <strong className="text-slate-700 dark:text-slate-300">{batch.courseName}</strong>
                  </p>
                  {batch.notes && (
                    <p className="text-[11px] text-slate-500 italic mt-2">{batch.notes}</p>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Enrollment Capacity:</span>
                    <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                      {batch.candidateCount || 0} / {batch.capacity} ({seatsLeft} open)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-600 dark:bg-purple-500 h-full rounded-full transition-all"
                      style={{ width: `${fillRate}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                    <span>Start: {batch.startDate}</span>
                    {batch.endDate && <span>End: {batch.endDate}</span>}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenRoster(batch)}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Roster ({batch.candidateCount || 0})</span>
                    </button>
                    <button
                      onClick={() => {
                        setDestinationBatchId(batch.id);
                        setShowTransferModal(true);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      Transfer
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingBatch(batch)}
                      title="Edit Batch"
                      className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBatch(batch.id, batch.name)}
                      title="Delete Batch"
                      className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Batch */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
              Create New Batch
            </h3>

            {error && (
              <div className="mb-3 p-3 bg-rose-50 text-rose-700 rounded-lg text-xs">{error}</div>
            )}

            <form onSubmit={handleCreateBatch} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Batch Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. B-2026-04"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Capacity (Seats) *
                  </label>
                  <input
                    type="number"
                    required
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Batch Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Spring 2026 Cohort Gamma"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Associated Course *
                </label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Schedule Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Weekdays 10:00 - 11:30 AM"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-xs font-semibold"
                >
                  Create Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Candidate Batch Transfer (BR-08, BR-09) */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Transfer Candidate Between Batches
                </h3>
                <p className="text-xs text-slate-500">Enforces BR-08: Exactly one active batch assignment.</p>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {transferError && (
              <div className="mb-3 p-3 bg-rose-50 text-rose-700 rounded-lg text-xs">{transferError}</div>
            )}
            {transferSuccess && (
              <div className="mb-3 p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{transferSuccess}</span>
              </div>
            )}

            <form onSubmit={handleTransferSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Select Candidate to Transfer *
                </label>
                <select
                  required
                  value={transferCandidateId}
                  onChange={(e) => setTransferCandidateId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.candidateId}) — Currently in {c.batchName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Destination Batch *
                </label>
                <select
                  required
                  value={destinationBatchId}
                  onChange={(e) => setDestinationBatchId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">Select destination batch...</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.courseName}) — {b.capacity - (b.candidateCount || 0)} seats open
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Effective Transfer Date *
                </label>
                <input
                  type="date"
                  required
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Transfer (Mandatory for audit trail) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="e.g. Schedule conflict with morning timings; candidate moved to evening batch."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferLoading}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {transferLoading ? 'Transferring...' : 'Execute Batch Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Batch Roster */}
      {showRosterModal && activeRosterBatch && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Batch Roster: {activeRosterBatch.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {rosterCandidates.length} enrolled candidates (Capacity: {activeRosterBatch.capacity})
                </p>
              </div>
              <button
                onClick={() => setShowRosterModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {rosterCandidates.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No candidates currently assigned to this batch.
                </div>
              ) : (
                rosterCandidates.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{c.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{c.candidateId} · {c.email}</div>
                    </div>
                    <span className="capitalize font-medium text-emerald-600">{c.status}</span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowRosterModal(false)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Batch */}
      {editingBatch && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Edit Batch Details
              </h3>
              <button
                onClick={() => setEditingBatch(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateBatch} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Batch Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingBatch.code}
                    onChange={(e) => setEditingBatch({ ...editingBatch, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Capacity (Seats) *
                  </label>
                  <input
                    type="number"
                    required
                    value={editingBatch.capacity}
                    onChange={(e) => setEditingBatch({ ...editingBatch, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Batch Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingBatch.name}
                  onChange={(e) => setEditingBatch({ ...editingBatch, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Associated Course
                  </label>
                  <select
                    value={editingBatch.courseId}
                    onChange={(e) => setEditingBatch({ ...editingBatch, courseId: e.target.value })}
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
                    Status
                  </label>
                  <select
                    value={editingBatch.status}
                    onChange={(e) => setEditingBatch({ ...editingBatch, status: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editingBatch.startDate}
                    onChange={(e) => setEditingBatch({ ...editingBatch, startDate: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editingBatch.endDate || ''}
                    onChange={(e) => setEditingBatch({ ...editingBatch, endDate: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={editingBatch.notes || ''}
                  onChange={(e) => setEditingBatch({ ...editingBatch, notes: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingBatch(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-xs font-semibold"
                >
                  Save Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
