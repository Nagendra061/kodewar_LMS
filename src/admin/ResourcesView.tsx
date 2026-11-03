import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { ResourceItem, Course, Batch, ResourceCategory, ResourceAudience, ResourceStatus } from '../types/index.ts';
import {
  FolderOpen,
  Plus,
  FileText,
  Link2,
  Download,
  Eye,
  Trash2,
  Filter,
  CheckCircle,
  X,
  FileCode,
  FileArchive,
  Book,
} from 'lucide-react';

export const ResourcesView: React.FC = () => {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [previewResource, setPreviewResource] = useState<ResourceItem | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ResourceCategory>('Lecture Notes');
  const [type, setType] = useState<'file' | 'link'>('file');
  const [url, setUrl] = useState('https://docs.kodewar.com/sample-guide.pdf');
  const [fileName, setFileName] = useState('module-guide.pdf');
  const [fileSize, setFileSize] = useState('1.5 MB');
  const [audience, setAudience] = useState<ResourceAudience>('course');
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState<ResourceStatus>('published');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resRes, crsRes, bchRes] = await Promise.all([
        api.getResources({
          category: categoryFilter || undefined,
          status: statusFilter || undefined,
        }),
        api.getCourses(),
        api.getBatches(),
      ]);
      setResources(resRes.resources);
      setCourses(crsRes.courses);
      setBatches(bchRes.batches);

      if (crsRes.courses.length > 0 && !courseId) {
        setCourseId(crsRes.courses[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [categoryFilter, statusFilter]);

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createResource({
        title,
        description,
        category,
        type,
        url,
        fileName: type === 'file' ? fileName : undefined,
        fileSize: type === 'file' ? fileSize : undefined,
        audience,
        courseId: audience === 'course' || audience === 'batch' ? courseId : undefined,
        batchId: audience === 'batch' ? batchId : undefined,
        status,
      });
      setShowAddModal(false);
      setTitle('');
      setDescription('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to publish resource');
    }
  };

  const handleDeleteResource = async (id: string, title?: string) => {
    if (!confirm(`Are you sure you want to permanently delete this resource${title ? ` ("${title}")` : ''}?`)) return;
    try {
      await api.deleteResource(id, false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete resource');
    }
  };

  const getCategoryIcon = (cat: ResourceCategory) => {
    switch (cat) {
      case 'Syllabus':
        return <Book className="w-4 h-4 text-blue-500" />;
      case 'Code Samples':
        return <FileCode className="w-4 h-4 text-emerald-500" />;
      default:
        return <FileText className="w-4 h-4 text-purple-500" />;
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Document & Learning Resources
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Publish course syllabi, assignments, and slides with granular cohort audience targeting (PRD §6.8).
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
          <span>Upload Resource</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Categories</option>
            <option value="Syllabus">Syllabus</option>
            <option value="Lecture Notes">Lecture Notes</option>
            <option value="Code Samples">Code Samples</option>
            <option value="Assignment">Assignment</option>
            <option value="Cheat Sheet">Cheat Sheet</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <span className="text-xs text-slate-500">
          Showing {resources.length} resources
        </span>
      </div>

      {/* Resources Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : resources.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-xs text-slate-400">
          No resources found. Click "Upload Resource" to publish your first learning material.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {resources.map((res) => (
            <div
              key={res.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {getCategoryIcon(res.category)}
                    <span>{res.category}</span>
                  </span>
                  <span
                    className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                      res.status === 'published'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                    }`}
                  >
                    {res.status}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {res.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {res.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
                <div>
                  Audience:{' '}
                  <strong className="text-slate-700 dark:text-slate-300 capitalize">
                    {res.audience === 'batch'
                      ? `Batch: ${res.batchName || 'Assigned Batch'}`
                      : res.audience === 'course'
                      ? `Course: ${res.courseName || 'Assigned Course'}`
                      : 'All Enrolled Candidates'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>{res.fileName || 'External Web Link'}</span>
                  {res.fileSize && <span className="tabular-nums font-mono">{res.fileSize}</span>}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={() => setPreviewResource(res)}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>

                <div className="flex items-center gap-1">
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    title="Direct Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => handleDeleteResource(res.id, res.title)}
                    className="p-1.5 rounded hover:bg-rose-50 text-rose-600 dark:text-rose-400"
                    title="Delete Resource"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Upload / Create Resource */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
              Publish Learning Resource
            </h3>

            {error && (
              <div className="mb-3 p-3 bg-rose-50 text-rose-700 rounded-lg text-xs">{error}</div>
            )}

            <form onSubmit={handleCreateResource} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Resource Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Distributed Database Architecture Slides"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Lecture Notes">Lecture Notes</option>
                    <option value="Syllabus">Syllabus</option>
                    <option value="Assignment">Assignment</option>
                    <option value="Code Samples">Code Samples</option>
                    <option value="Cheat Sheet">Cheat Sheet</option>
                    <option value="Reference">Reference</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target Audience (PRD §6.8)
                  </label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="course">Entire Course</option>
                    <option value="batch">Specific Batch</option>
                    <option value="all">All Candidates</option>
                  </select>
                </div>
              </div>

              {audience !== 'all' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Course
                    </label>
                    <select
                      value={courseId}
                      onChange={(e) => {
                        setCourseId(e.target.value);
                        const matching = batches.filter((b) => b.courseId === e.target.value);
                        if (matching.length > 0) setBatchId(matching[0].id);
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

                  {audience === 'batch' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Batch Cohort
                      </label>
                      <select
                        value={batchId}
                        onChange={(e) => setBatchId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        {batches
                          .filter((b) => b.courseId === courseId)
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  File Download URL or External Resource Link *
                </label>
                <input
                  type="text"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://... or /assets/..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Overview of topics and instructions for students..."
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
                  Publish Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resource Document Preview Modal */}
      {previewResource && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
                  {previewResource.category}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {previewResource.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewResource(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl text-xs space-y-2">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {previewResource.description || 'No description provided.'}
              </p>
              <div className="pt-2 text-[11px] text-slate-500 font-mono">
                Source: {previewResource.url}
              </div>
            </div>

            {/* Document simulator frame */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-8 bg-white dark:bg-slate-950 text-center space-y-3">
              <FileText className="w-12 h-12 text-slate-400 mx-auto" />
              <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                {previewResource.fileName || 'External Resource Document'}
              </div>
              <p className="text-[11px] text-slate-400">
                Authorized preview mode verified for {previewResource.audience} audience.
              </p>
              <a
                href={previewResource.url}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
              >
                <Download className="w-4 h-4" />
                <span>Open or Download Original File</span>
              </a>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewResource(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
