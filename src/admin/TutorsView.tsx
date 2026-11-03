import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { Tutor, Course } from '../types/index.ts';
import { GraduationCap, Plus, Mail, Phone, BookOpen, Edit2, Trash2 } from 'lucide-react';

export const TutorsView: React.FC = () => {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTutor, setEditingTutor] = useState<Tutor | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tutRes, crsRes] = await Promise.all([api.getTutors(), api.getCourses()]);
      setTutors(tutRes.tutors);
      setCourses(crsRes.courses);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createTutor({
        name,
        email,
        phone,
        specialization,
        assignedCourseIds: selectedCourseIds,
        notes,
      });
      setShowAddModal(false);
      setName('');
      setEmail('');
      setPhone('');
      setSpecialization('');
      setSelectedCourseIds([]);
      setNotes('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create tutor');
    }
  };

  const handleUpdateTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTutor) return;
    try {
      await api.updateTutor(editingTutor.id, {
        name: editingTutor.name,
        email: editingTutor.email,
        phone: editingTutor.phone,
        specialization: editingTutor.specialization,
        status: editingTutor.status,
        assignedCourseIds: editingTutor.assignedCourseIds,
        notes: editingTutor.notes,
      });
      setEditingTutor(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update tutor');
    }
  };

  const handleDeleteTutor = async (tutorId: string, tutorName: string) => {
    if (!confirm(`Are you sure you want to delete tutor "${tutorName}"?`)) {
      return;
    }
    try {
      await api.deleteTutor(tutorId, true);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete tutor');
    }
  };

  const toggleCourseSelection = (cId: string, current: string[], setter: (ids: string[]) => void) => {
    if (current.includes(cId)) {
      setter(current.filter((id) => id !== cId));
    } else {
      setter([...current, cId]);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Tutor & Instructor Profiles
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Operational instructor records for session assignments. (Per PRD BR-30: Tutors have no login portal in MVP).
          </p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Tutor</span>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : tutors.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <GraduationCap className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Tutors Registered Yet</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Add instructors to assign them to batches and live scheduled meeting sessions.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Tutor</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tutors.map((tutor) => (
            <div
              key={tutor.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {tutor.tutorId}
                  </span>
                  <span
                    className={`text-[11px] font-medium ${
                      tutor.status === 'active' ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {tutor.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {tutor.name}
                </h3>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-0.5">
                  {tutor.specialization}
                </p>

                {tutor.notes && (
                  <p className="text-[11px] text-slate-500 italic mt-2">{tutor.notes}</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs space-y-2">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{tutor.email}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{tutor.phone || 'No phone recorded'}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 font-medium">Assigned Courses:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tutor.assignedCourseNames && tutor.assignedCourseNames.length > 0 ? (
                      tutor.assignedCourseNames.map((cn, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded"
                        >
                          {cn}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400">None assigned</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end items-center gap-1.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setEditingTutor(tutor)}
                  className="px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit Details</span>
                </button>
                <button
                  onClick={() => handleDeleteTutor(tutor.id, tutor.name)}
                  title="Delete Tutor"
                  className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Tutor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
              Add New Tutor
            </h3>

            {error && (
              <div className="mb-3 p-3 bg-rose-50 text-rose-700 rounded-lg text-xs">{error}</div>
            )}

            <form onSubmit={handleCreateTutor} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Sharma"
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tutor@kodewar.com"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Specialization / Domain
                </label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. Distributed Systems & React Architecture"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Courses
                </label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-700 p-2 rounded-lg">
                  {courses.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCourseIds.includes(c.id)}
                        onChange={() => toggleCourseSelection(c.id, selectedCourseIds, setSelectedCourseIds)}
                        className="rounded text-blue-600"
                      />
                      <span>{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Internal Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instructor bio, scheduling availability..."
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
                  Create Tutor Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Tutor Modal */}
      {editingTutor && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
              Edit Tutor: {editingTutor.name}
            </h3>

            <form onSubmit={handleUpdateTutor} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editingTutor.name}
                  onChange={(e) => setEditingTutor({ ...editingTutor, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={editingTutor.email}
                    onChange={(e) => setEditingTutor({ ...editingTutor, email: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editingTutor.phone}
                    onChange={(e) => setEditingTutor({ ...editingTutor, phone: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Specialization
                </label>
                <input
                  type="text"
                  value={editingTutor.specialization}
                  onChange={(e) => setEditingTutor({ ...editingTutor, specialization: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={editingTutor.status}
                  onChange={(e) => setEditingTutor({ ...editingTutor, status: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Internal Notes
                </label>
                <textarea
                  rows={2}
                  value={editingTutor.notes || ''}
                  onChange={(e) => setEditingTutor({ ...editingTutor, notes: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTutor(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
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
