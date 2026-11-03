import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { Course } from '../types/index.ts';
import {
  BookOpen,
  Plus,
  Edit3,
  Layers,
  Users,
  Calendar,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';

export const CoursesView: React.FC = () => {
  const [courses, setCourses] = useState<(Course & { batchCount: number; candidateCount: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  // Deletion modal states
  const [deletingCourse, setDeletingCourse] = useState<(Course & { batchCount: number; candidateCount: number }) | null>(null);
  const [deleteCascade, setDeleteCascade] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('16 Weeks');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const res = await api.getCourses();
      setCourses(res.courses);
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createCourse({
        code,
        name,
        description,
        duration,
        startDate,
        endDate,
      });
      setShowAddModal(false);
      setCode('');
      setName('');
      setDescription('');
      setActionSuccess(`Course "${name}" created successfully.`);
      loadCourses();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to create course');
    }
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    try {
      await api.updateCourse(editingCourse.id, {
        name: editingCourse.name,
        description: editingCourse.description,
        duration: editingCourse.duration,
        status: editingCourse.status,
      });
      const updatedName = editingCourse.name;
      setEditingCourse(null);
      setActionSuccess(`Course "${updatedName}" updated successfully.`);
      loadCourses();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update course');
    }
  };

  const handleDeleteCourse = async () => {
    if (!deletingCourse) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await api.deleteCourse(deletingCourse.id, deleteCascade);
      setActionSuccess(res.message || `Course "${deletingCourse.name}" deleted successfully.`);
      setDeletingCourse(null);
      if (editingCourse?.id === deletingCourse.id) {
        setEditingCourse(null);
      }
      loadCourses();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete course');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Heading */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Course Catalog Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Maintain curricula, configure cohort tracks, and manage training programs.
          </p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Course</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Courses in Catalog</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Get started by creating your first course curriculum to organize batches and enroll candidates.
          </p>
          <button
            onClick={() => {
              setError(null);
              setShowAddModal(true);
            }}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Course</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => (
            <div
              key={course.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded">
                    {course.code}
                  </span>
                  <span
                    className={`text-[11px] font-medium ${
                      course.status === 'active' ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {course.status === 'active' ? 'Active' : 'Archived'}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {course.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {course.description || 'No description provided.'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Duration:</span>
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">{course.duration}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span>Batches:</span>
                  </span>
                  <span className="font-medium tabular-nums">{course.batchCount} active</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Enrolled:</span>
                  </span>
                  <span className="font-medium tabular-nums">{course.candidateCount} candidates</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteCascade(false);
                    setDeletingCourse(course);
                  }}
                  title="Delete Course"
                  className="px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-200 dark:hover:border-rose-800 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <button
                  onClick={() => setEditingCourse(course)}
                  className="px-3 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 font-medium"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Course Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Add New Course
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 rounded-lg text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateCourse} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. FSWD-101"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Duration *
                  </label>
                  <input
                    type="text"
                    required
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 16 Weeks"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Course Title *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Full Stack Web Development"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summary of skills, tech stack, and deliverables..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                >
                  Create Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Course Modal */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Edit Course: {editingCourse.code}
              </h3>
              <button
                onClick={() => setEditingCourse(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateCourse} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Course Name
                </label>
                <input
                  type="text"
                  required
                  value={editingCourse.name}
                  onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Duration
                </label>
                <input
                  type="text"
                  required
                  value={editingCourse.duration}
                  onChange={(e) => setEditingCourse({ ...editingCourse, duration: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={editingCourse.status}
                  onChange={(e) => setEditingCourse({ ...editingCourse, status: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editingCourse.description}
                  onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const target = courses.find((c) => c.id === editingCourse.id);
                    if (target) {
                      setDeleteError(null);
                      setDeleteCascade(false);
                      setDeletingCourse(target);
                    }
                  }}
                  className="text-xs font-medium text-rose-600 hover:text-rose-700 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Course</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCourse(null)}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Course Confirmation Modal */}
      {deletingCourse && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Delete Course
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {deletingCourse.code} · {deletingCourse.name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDeletingCourse(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300">
                {deleteError}
              </div>
            )}

            {/* Case A: Enrolled Candidates exist -> Block deletion */}
            {deletingCourse.candidateCount > 0 ? (
              <div className="space-y-3">
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Cannot Delete: Active Candidates Enrolled</span>
                  </div>
                  <p className="leading-relaxed">
                    This course currently has <strong>{deletingCourse.candidateCount} candidate(s)</strong> enrolled.
                    To maintain academic record integrity (PRD BR-08), you must transfer or remove all candidates before this course can be deleted.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setDeletingCourse(null)}
                    className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                  >
                    Understood
                  </button>
                </div>
              </div>
            ) : deletingCourse.batchCount > 0 ? (
              /* Case B: Associated Batches exist but no candidates -> Require cascade confirmation */
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                  <p>
                    This course has <strong>{deletingCourse.batchCount} cohort batch(es)</strong> with zero candidates enrolled.
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Deleting the course will also clean up its empty batch records, scheduled session templates, and linked resources.
                  </p>
                </div>

                <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={deleteCascade}
                    onChange={(e) => setDeleteCascade(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span>
                    Confirm removing this course and its {deletingCourse.batchCount} associated batch(es).
                  </span>
                </label>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDeletingCourse(null)}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!deleteCascade || deleteLoading}
                    onClick={handleDeleteCourse}
                    className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {deleteLoading ? 'Deleting...' : 'Delete Course & Batches'}
                  </button>
                </div>
              </div>
            ) : (
              /* Case C: No batches and no candidates -> Direct delete */
              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Are you sure you want to permanently delete <strong>{deletingCourse.name} ({deletingCourse.code})</strong>?
                  This curriculum will be removed from the catalog. This action cannot be undone.
                </p>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDeletingCourse(null)}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteLoading}
                    onClick={handleDeleteCourse}
                    className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50"
                  >
                    {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
