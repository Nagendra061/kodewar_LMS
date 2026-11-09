import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { ResourceItem, Batch } from '../types/index.ts';
import {
  FolderOpen,
  Plus,
  Search,
  ExternalLink,
  Trash2,
  FileText,
  Video,
  Link as LinkIcon,
  Archive,
  BookOpen,
  X,
  AlertCircle,
  Tag,
} from 'lucide-react';

export const TutorResourcesView: React.FC = () => {
  const { user } = useAuth();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');

  // Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'pdf' | 'link' | 'video' | 'zip' | 'doc'>('pdf');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('Lecture Notes');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const tutorPermissions = (user as any)?.permissions || {};

  const loadData = async () => {
    try {
      setLoading(true);
      const [resRes, batchRes] = await Promise.all([
        api.getTutorResources(),
        api.getTutorBatches(),
      ]);
      setResources(resRes.resources);
      setBatches(batchRes.batches);
    } catch (err) {
      console.error('Failed to load resources:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim() || !url.trim()) {
      setFormError('Resource title and URL are required.');
      return;
    }
    setSubmitting(true);
    try {
      const selectedBatch = batches.find((b) => b.id === selectedBatchId);
      await api.createTutorResource({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        url: url.trim(),
        category,
        batchId: selectedBatchId || undefined,
        courseId: selectedBatch?.courseId,
        isRequired,
        tags: tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : [],
      });
      setShowUploadModal(false);
      setTitle('');
      setDescription('');
      setUrl('');
      setTagsInput('');
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to upload resource');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (res: ResourceItem) => {
    if (!confirm(`Are you sure you want to delete "${res.title}"?`)) return;
    try {
      await api.deleteTutorResource(res.id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete resource');
    }
  };

  const filteredResources = resources.filter((r) => {
    const matchesSearch =
      !searchTerm ||
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;
    const matchesBatch = batchFilter === 'all' || r.batchId === batchFilter;
    return matchesSearch && matchesCategory && matchesBatch;
  });

  const categories = Array.from(new Set(resources.map((r) => r.category).filter(Boolean)));

  const getIconForType = (resType: string) => {
    switch (resType) {
      case 'video':
        return <Video className="w-4 h-4 text-rose-500" />;
      case 'link':
        return <LinkIcon className="w-4 h-4 text-blue-500" />;
      case 'zip':
        return <Archive className="w-4 h-4 text-amber-500" />;
      case 'doc':
      case 'pdf':
      default:
        return <FileText className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <span>Course & Batch Learning Resources</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Access slides, lecture documentation, code repositories, and supplemental study guides for your assigned cohorts.
          </p>
        </div>

        {tutorPermissions.canUploadResources && (
          <button
            onClick={() => {
              setFormError(null);
              setShowUploadModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Upload New Material</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search materials by title..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Category Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 text-[11px] font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Batch Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 text-[11px] font-medium">Batch:</span>
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 max-w-[180px] truncate"
            >
              <option value="all">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Resources Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Resources Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm || categoryFilter !== 'all' || batchFilter !== 'all'
              ? 'No learning items matched your filter criteria.'
              : 'No learning resources currently published for your assigned cohorts.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredResources.map((res) => {
            const isOwner = res.uploadedBy === user?.email || (res as any).uploadedByRole === 'tutor';
            const canDelete = tutorPermissions.canManageOwnResources && isOwner;

            return (
              <div
                key={res.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      {getIconForType(res.type)}
                      <span>{res.category}</span>
                    </span>

                    {res.batchName && (
                      <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded">
                        {res.batchName}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                    {res.title}
                  </h3>

                  {res.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {res.description}
                    </p>
                  )}

                  {res.tags && res.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {res.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] bg-slate-50 dark:bg-slate-800 text-slate-500 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {res.dateAdded || (res as any).createdAt ? new Date(res.dateAdded || (res as any).createdAt).toLocaleDateString() : 'Active Material'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-purple-600 text-white hover:bg-slate-800 dark:hover:bg-purple-500 flex items-center gap-1"
                    >
                      <span>Open Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(res)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Delete Resource"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================== UPLOAD RESOURCE MODAL ===================== */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-600" />
                <span>Upload Learning Material</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-xs">{formError}</div>
            )}

            <form onSubmit={handleUpload} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Resource Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Session 05 - React Hooks Deep Dive Slides"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Lecture Notes">Lecture Notes</option>
                    <option value="Slides & Presentation">Slides & Presentation</option>
                    <option value="Assignment Brief">Assignment Brief</option>
                    <option value="Code Repository">Code Repository</option>
                    <option value="Reference Guide">Reference Guide</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Format / Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="pdf">PDF Document</option>
                    <option value="link">External URL</option>
                    <option value="video">Video Recording</option>
                    <option value="zip">ZIP / Archive</option>
                    <option value="doc">Word Document</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Resource URL / Link *
                </label>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://drive.google.com/... or https://github.com/..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Batch (Optional)
                </label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">All Assigned Batches</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.courseName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summary of what this document covers..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="react, state, context"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50"
                >
                  {submitting ? 'Uploading...' : 'Publish Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

