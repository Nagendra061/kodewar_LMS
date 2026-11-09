import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { Tutor, Course, Batch, TutorPermissions } from '../types/index.ts';
import {
  GraduationCap,
  Plus,
  Mail,
  Phone,
  BookOpen,
  Edit2,
  Trash2,
  Search,
  Filter,
  KeyRound,
  ShieldCheck,
  Activity,
  Copy,
  Check,
  X,
  Users,
  Calendar,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Briefcase,
} from 'lucide-react';

const DEFAULT_PERMISSIONS: TutorPermissions = {
  canViewAssignedBatches: true,
  canViewAssignedCandidates: true,
  canViewAssignedMeetings: true,
  canViewMeetingLinks: true,
  canManageMeetingAccess: false,
  canRecordAttendance: true,
  canEditAttendance: false,
  attendanceEditWindowHours: 24,
  canViewResources: true,
  canUploadResources: false,
  canManageOwnResources: false,
};

export const TutorsView: React.FC = () => {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  // Modals & Drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTutor, setEditingTutor] = useState<Tutor | null>(null);
  const [permissionsTutor, setPermissionsTutor] = useState<Tutor | null>(null);
  const [activityTutor, setActivityTutor] = useState<Tutor | null>(null);
  const [activityData, setActivityData] = useState<any>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  // Password Reset / Creation Credentials Modal
  const [credentialModal, setCredentialModal] = useState<{
    isOpen: boolean;
    tutorName: string;
    email: string;
    tempPassword: string;
    isReset: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form states for Add Tutor
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formSpecialization, setFormSpecialization] = useState('');
  const [formCourseIds, setFormCourseIds] = useState<string[]>([]);
  const [formBatchIds, setFormBatchIds] = useState<string[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [formPermissions, setFormPermissions] = useState<TutorPermissions>({ ...DEFAULT_PERMISSIONS });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states for Edit Tutor
  const [editPermissions, setEditPermissions] = useState<TutorPermissions>({ ...DEFAULT_PERMISSIONS });

  const loadData = async () => {
    try {
      setLoading(true);
      const [tutRes, crsRes, bchRes] = await Promise.all([
        api.getTutors(),
        api.getCourses(),
        api.getBatches(),
      ]);
      setTutors(tutRes.tutors);
      setCourses(crsRes.courses);
      setBatches(bchRes.batches);
    } catch (err) {
      console.error('Failed to load tutor data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormDesignation('Lead Technical Instructor');
    setFormSpecialization('');
    setFormCourseIds([]);
    setFormBatchIds([]);
    setFormNotes('');
    setFormPermissions({ ...DEFAULT_PERMISSIONS });
    setFormError(null);
    setShowAddModal(true);
  };

  const handleCreateTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formName.trim() || !formEmail.trim()) {
      setFormError('Full name and email address are required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createTutor({
        name: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        phone: formPhone.trim(),
        designation: formDesignation.trim(),
        specialization: formSpecialization.trim(),
        assignedCourseIds: formCourseIds,
        assignedBatchIds: formBatchIds,
        notes: formNotes.trim(),
        permissions: formPermissions,
      } as any);

      setShowAddModal(false);
      await loadData();

      // Show credentials
      const createdTutor = res.tutor as any;
      if (createdTutor.tempPassword) {
        setCredentialModal({
          isOpen: true,
          tutorName: createdTutor.name,
          email: createdTutor.email,
          tempPassword: createdTutor.tempPassword,
          isReset: false,
        });
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to create tutor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTutor) return;
    setSubmitting(true);
    try {
      await api.updateTutor(editingTutor.id, {
        name: editingTutor.name,
        email: editingTutor.email,
        phone: editingTutor.phone,
        designation: editingTutor.designation,
        specialization: editingTutor.specialization,
        status: editingTutor.status,
        assignedCourseIds: editingTutor.assignedCourseIds,
        assignedBatchIds: editingTutor.assignedBatchIds,
        notes: editingTutor.notes,
      });
      setEditingTutor(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update tutor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!permissionsTutor) return;
    setSubmitting(true);
    try {
      await api.updateTutor(permissionsTutor.id, {
        permissions: editPermissions,
      });
      setPermissionsTutor(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update permissions');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (tutor: Tutor) => {
    if (!confirm(`Reset login password for ${tutor.name}? A new temporary password will be generated.`)) {
      return;
    }
    try {
      const res = await api.resetTutorPassword(tutor.id);
      setCredentialModal({
        isOpen: true,
        tutorName: tutor.name,
        email: tutor.email,
        tempPassword: res.tempPassword,
        isReset: true,
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    }
  };

  const handleToggleStatus = async (tutor: Tutor) => {
    const newStatus = tutor.status === 'active' ? 'inactive' : 'active';
    try {
      await api.updateTutor(tutor.id, { status: newStatus });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle tutor status');
    }
  };

  const handleDeleteTutor = async (tutorId: string, tutorName: string) => {
    if (!confirm(`Are you sure you want to delete tutor "${tutorName}"? Associated meetings will be unassigned.`)) {
      return;
    }
    try {
      await api.deleteTutor(tutorId, true);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete tutor');
    }
  };

  const openActivityDrawer = async (tutor: Tutor) => {
    setActivityTutor(tutor);
    setActivityLoading(true);
    try {
      const res = await api.getTutorActivity(tutor.id);
      setActivityData(res.activity);
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filtered tutors list
  const filteredTutors = tutors.filter((t) => {
    const matchesSearch =
      !searchTerm ||
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.tutorId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.specialization && t.specialization.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.designation && t.designation.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

    const matchesCourse =
      courseFilter === 'all' ||
      (t.assignedCourseIds && t.assignedCourseIds.includes(courseFilter));

    return matchesSearch && matchesStatus && matchesCourse;
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Tutor & Instructor Management</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Provision tutor accounts, configure fine-grained portal permissions, assign batches, and monitor instructor activity.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Tutor Account</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, ID, email, expertise..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 text-[11px] font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All ({tutors.length})</option>
              <option value="active">Active ({tutors.filter((t) => t.status === 'active').length})</option>
              <option value="inactive">Inactive ({tutors.filter((t) => t.status === 'inactive').length})</option>
            </select>
          </div>

          {/* Course Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 text-[11px] font-medium">Course:</span>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[180px] truncate"
            >
              <option value="all">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tutors Grid / List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : filteredTutors.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <GraduationCap className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Tutors Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'all' || courseFilter !== 'all'
              ? 'No instructors matched your search or active filter criteria.'
              : 'Add your first tutor account to assign them to batches and grant dedicated portal access.'}
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Tutor Account</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTutors.map((tutor) => {
            const assignedBatches = batches.filter(
              (b) => tutor.assignedBatchIds && tutor.assignedBatchIds.includes(b.id)
            );

            return (
              <div
                key={tutor.id}
                className={`bg-white dark:bg-slate-900 border rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4 transition-all hover:shadow-md ${
                  tutor.status === 'active'
                    ? 'border-slate-200 dark:border-slate-800'
                    : 'border-amber-200/80 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                      {tutor.tutorId}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(tutor)}
                      title="Click to toggle status"
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                        tutor.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                      }`}
                    >
                      {tutor.status === 'active' ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  {/* Tutor Identity */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-200 dark:border-blue-800">
                      {tutor.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">
                        {tutor.name}
                      </h3>
                      <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                        <Briefcase className="w-3 h-3 shrink-0" />
                        <span className="truncate">{tutor.designation || 'Instructor'}</span>
                      </p>
                      {tutor.specialization && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {tutor.specialization}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-mono text-[11px]">{tutor.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[11px]">{tutor.phone || 'No phone recorded'}</span>
                    </div>
                  </div>

                  {/* Assigned Batches & Courses */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Assigned Batches ({assignedBatches.length}):
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {assignedBatches.length > 0 ? (
                          assignedBatches.map((b) => (
                            <span
                              key={b.id}
                              className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded"
                            >
                              {b.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No batches assigned</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Assigned Courses:
                      </span>
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
                          <span className="text-[11px] text-slate-400 italic">None assigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions Bar */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openActivityDrawer(tutor)}
                      title="View Activity & History"
                      className="px-2 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 text-[11px] font-medium"
                    >
                      <Activity className="w-3.5 h-3.5 text-blue-500" />
                      <span>Activity</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPermissionsTutor(tutor);
                        setEditPermissions(tutor.permissions || { ...DEFAULT_PERMISSIONS });
                      }}
                      title="Manage Tutor Permissions"
                      className="px-2 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 text-[11px] font-medium"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Permissions</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleResetPassword(tutor)}
                      title="Reset Password"
                      className="p-1 rounded text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingTutor({ ...tutor })}
                      title="Edit Profile"
                      className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteTutor(tutor.id, tutor.name)}
                      title="Delete Tutor"
                      className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
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

      {/* ===================== ADD TUTOR MODAL ===================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-600" />
                <span>Create Tutor Account</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTutor} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Vinay Sharma"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="vinay@kodewar.com"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Professional Designation
                  </label>
                  <input
                    type="text"
                    value={formDesignation}
                    onChange={(e) => setFormDesignation(e.target.value)}
                    placeholder="e.g. Senior Tech Mentor"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Skills & Subject Expertise
                </label>
                <input
                  type="text"
                  value={formSpecialization}
                  onChange={(e) => setFormSpecialization(e.target.value)}
                  placeholder="e.g. React, Node.js, Cloud Architectures, System Design"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Course Assignment Multi-select */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Assign Courses
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/50">
                  {courses.map((course) => {
                    const checked = formCourseIds.includes(course.id);
                    return (
                      <label key={course.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormCourseIds([...formCourseIds, course.id]);
                            } else {
                              setFormCourseIds(formCourseIds.filter((id) => id !== course.id));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                        />
                        <span className="truncate text-slate-800 dark:text-slate-200">{course.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Batch Assignment Multi-select */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Assign Batches
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/50">
                  {batches.map((batch) => {
                    const checked = formBatchIds.includes(batch.id);
                    return (
                      <label key={batch.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormBatchIds([...formBatchIds, batch.id]);
                            } else {
                              setFormBatchIds(formBatchIds.filter((id) => id !== batch.id));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                        />
                        <span className="truncate text-slate-800 dark:text-slate-200">{batch.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Internal Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Internal Notes
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional internal administrative notes..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== EDIT TUTOR MODAL ===================== */}
      {editingTutor && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <span>Edit Tutor: {editingTutor.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingTutor(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTutor} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingTutor.name}
                    onChange={(e) => setEditingTutor({ ...editingTutor, name: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={editingTutor.email}
                    onChange={(e) => setEditingTutor({ ...editingTutor, email: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editingTutor.phone || ''}
                    onChange={(e) => setEditingTutor({ ...editingTutor, phone: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Professional Designation
                  </label>
                  <input
                    type="text"
                    value={editingTutor.designation || ''}
                    onChange={(e) => setEditingTutor({ ...editingTutor, designation: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Skills / Specialization
                  </label>
                  <input
                    type="text"
                    value={editingTutor.specialization || ''}
                    onChange={(e) => setEditingTutor({ ...editingTutor, specialization: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Account Status
                  </label>
                  <select
                    value={editingTutor.status}
                    onChange={(e) => setEditingTutor({ ...editingTutor, status: e.target.value as any })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active (Access Granted)</option>
                    <option value="inactive">Inactive (Access Suspended)</option>
                  </select>
                </div>
              </div>

              {/* Course Assignment */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Courses
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/50">
                  {courses.map((course) => {
                    const checked = (editingTutor.assignedCourseIds || []).includes(course.id);
                    return (
                      <label key={course.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const cur = editingTutor.assignedCourseIds || [];
                            const updated = e.target.checked
                              ? [...cur, course.id]
                              : cur.filter((id) => id !== course.id);
                            setEditingTutor({ ...editingTutor, assignedCourseIds: updated });
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                        />
                        <span className="truncate text-slate-800 dark:text-slate-200">{course.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Batch Assignment */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Batches
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/50">
                  {batches.map((batch) => {
                    const checked = (editingTutor.assignedBatchIds || []).includes(batch.id);
                    return (
                      <label key={batch.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const cur = editingTutor.assignedBatchIds || [];
                            const updated = e.target.checked
                              ? [...cur, batch.id]
                              : cur.filter((id) => id !== batch.id);
                            setEditingTutor({ ...editingTutor, assignedBatchIds: updated });
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                        />
                        <span className="truncate text-slate-800 dark:text-slate-200">{batch.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Internal Notes
                </label>
                <textarea
                  rows={2}
                  value={editingTutor.notes || ''}
                  onChange={(e) => setEditingTutor({ ...editingTutor, notes: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTutor(null)}
                  className="px-3.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MANAGE PERMISSIONS MODAL ===================== */}
      {permissionsTutor && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Configure Tutor Permissions</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Customizing capabilities for {permissionsTutor.name} ({permissionsTutor.tutorId})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPermissionsTutor(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Batches & Candidates
                </h4>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                  <div>
                    <span className="text-xs font-medium text-slate-900 dark:text-white block">
                      View Assigned Batches
                    </span>
                    <span className="text-[11px] text-slate-500">Access batch schedules, course info, and batch stats</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editPermissions.canViewAssignedBatches}
                    onChange={(e) =>
                      setEditPermissions({ ...editPermissions, canViewAssignedBatches: e.target.checked })
                    }
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                  <div>
                    <span className="text-xs font-medium text-slate-900 dark:text-white block">
                      View Assigned Candidates
                    </span>
                    <span className="text-[11px] text-slate-500">View roster of enrolled students in assigned batches</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editPermissions.canViewAssignedCandidates}
                    onChange={(e) =>
                      setEditPermissions({ ...editPermissions, canViewAssignedCandidates: e.target.checked })
                    }
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Meeting Sessions
                </h4>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                  <div>
                    <span className="text-xs font-medium text-slate-900 dark:text-white block">
                      View Assigned Meetings
                    </span>
                    <span className="text-[11px] text-slate-500">See scheduled live class sessions</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editPermissions.canViewAssignedMeetings}
                    onChange={(e) =>
                      setEditPermissions({ ...editPermissions, canViewAssignedMeetings: e.target.checked })
                    }
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                  <div>
                    <span className="text-xs font-medium text-slate-900 dark:text-white block">
                      View Meeting Links
                    </span>
                    <span className="text-[11px] text-slate-500">View live Google Meet / Zoom meeting links</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editPermissions.canViewMeetingLinks}
                    onChange={(e) =>
                      setEditPermissions({ ...editPermissions, canViewMeetingLinks: e.target.checked })
                    }
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                  <div>
                    <span className="text-xs font-medium text-slate-900 dark:text-white block">
                      Manage Meeting Access Toggle
                    </span>
                    <span className="text-[11px] text-slate-500">Enable/disable candidate join button for assigned meetings</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editPermissions.canManageMeetingAccess}
                    onChange={(e) =>
                      setEditPermissions({ ...editPermissions, canManageMeetingAccess: e.target.checked })
                    }
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Attendance Operations
                </h4>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                  <div>
                    <span className="text-xs font-medium text-slate-900 dark:text-white block">
                      Record Attendance
                    </span>
                    <span className="text-[11px] text-slate-500">Mark session roll calls for assigned batches</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editPermissions.canRecordAttendance}
                    onChange={(e) =>
                      setEditPermissions({ ...editPermissions, canRecordAttendance: e.target.checked })
                    }
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                  <div>
                    <span className="text-xs font-medium text-slate-900 dark:text-white block">
                      Edit & Correct Attendance
                    </span>
                    <span className="text-[11px] text-slate-500">Modify previously submitted attendance records</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editPermissions.canEditAttendance}
                    onChange={(e) =>
                      setEditPermissions({ ...editPermissions, canEditAttendance: e.target.checked })
                    }
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <label className="block text-xs font-medium text-slate-900 dark:text-white mb-1">
                    Attendance Correction Window (Hours)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Hours after meeting finish during which tutor is permitted to submit corrections.
                  </p>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={editPermissions.attendanceEditWindowHours || 24}
                    onChange={(e) =>
                      setEditPermissions({
                        ...editPermissions,
                        attendanceEditWindowHours: parseInt(e.target.value) || 24,
                      })
                    }
                    className="w-32 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Learning Materials & Resources
                </h4>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                  <div>
                    <span className="text-xs font-medium text-slate-900 dark:text-white block">
                      View Learning Resources
                    </span>
                    <span className="text-[11px] text-slate-500">View materials for assigned courses and batches</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editPermissions.canViewResources}
                    onChange={(e) =>
                      setEditPermissions({ ...editPermissions, canViewResources: e.target.checked })
                    }
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                  <div>
                    <span className="text-xs font-medium text-slate-900 dark:text-white block">
                      Upload Resources
                    </span>
                    <span className="text-[11px] text-slate-500">Publish guides, documentation, and slides to students</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editPermissions.canUploadResources}
                    onChange={(e) =>
                      setEditPermissions({ ...editPermissions, canUploadResources: e.target.checked })
                    }
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                  <div>
                    <span className="text-xs font-medium text-slate-900 dark:text-white block">
                      Delete Own Uploaded Resources
                    </span>
                    <span className="text-[11px] text-slate-500">Remove materials previously uploaded by this tutor</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editPermissions.canManageOwnResources}
                    onChange={(e) =>
                      setEditPermissions({ ...editPermissions, canManageOwnResources: e.target.checked })
                    }
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPermissionsTutor(null)}
                className="px-3.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={submitting}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== ACTIVITY & HISTORY DRAWER ===================== */}
      {activityTutor && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      {activityTutor.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {activityTutor.tutorId} · {activityTutor.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActivityTutor(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {activityLoading ? (
                <div className="py-12 text-center text-xs text-slate-500 animate-pulse">
                  Loading tutor metrics and history...
                </div>
              ) : activityData ? (
                <div className="mt-5 space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 p-3 rounded-xl">
                      <div className="text-[11px] font-medium text-blue-700 dark:text-blue-300">
                        Assigned Batches
                      </div>
                      <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                        {activityData.assignedBatchesCount}
                      </div>
                    </div>

                    <div className="bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 p-3 rounded-xl">
                      <div className="text-[11px] font-medium text-purple-700 dark:text-purple-300">
                        Total Candidates
                      </div>
                      <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                        {activityData.totalCandidates}
                      </div>
                    </div>

                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-3 rounded-xl">
                      <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        Completed Sessions
                      </div>
                      <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                        {activityData.completedMeetingsCount}
                      </div>
                    </div>

                    <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 p-3 rounded-xl">
                      <div className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                        Attendance Recorded
                      </div>
                      <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                        {activityData.attendanceSessionsMarked}
                      </div>
                    </div>
                  </div>

                  {/* Assigned Batches List */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Active Batches ({activityData.batches.length})
                    </h4>
                    {activityData.batches.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No batches assigned</p>
                    ) : (
                      <div className="space-y-2">
                        {activityData.batches.map((b: any) => (
                          <div
                            key={b.id}
                            className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs flex items-center justify-between"
                          >
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {b.name}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {b.code} · {b.timing}
                              </div>
                            </div>
                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                              {b.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Upcoming Meetings */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Upcoming Sessions ({activityData.upcomingMeetings.length})
                    </h4>
                    {activityData.upcomingMeetings.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No upcoming sessions scheduled</p>
                    ) : (
                      <div className="space-y-2">
                        {activityData.upcomingMeetings.slice(0, 5).map((m: any) => (
                          <div
                            key={m.id}
                            className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs space-y-1"
                          >
                            <div className="font-medium text-slate-900 dark:text-white">{m.title}</div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {m.date}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {m.startTime} - {m.endTime}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActivityTutor(null)}
                className="w-full py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800"
              >
                Close Activity Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== CREDENTIALS DISPLAY MODAL ===================== */}
      {credentialModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <KeyRound className="w-6 h-6" />
            </div>

            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {credentialModal.isReset ? 'Password Reset Successfully' : 'Tutor Account Provisioned'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Share these login credentials securely with <strong>{credentialModal.tutorName}</strong>.
              The tutor will be required to change this temporary password upon first login.
            </p>

            <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Login Email / Username
                </span>
                <span className="font-mono text-xs text-slate-900 dark:text-white font-medium select-all">
                  {credentialModal.email}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Temporary Password
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 select-all">
                    {credentialModal.tempPassword}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(credentialModal.tempPassword)}
                    className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-white"
                    title="Copy Password"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCredentialModal(null)}
              className="mt-5 w-full py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
