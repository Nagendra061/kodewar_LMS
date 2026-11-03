import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { ResourceItem, ResourceCategory } from '../types/index.ts';
import {
  FolderOpen,
  Search,
  Download,
  Eye,
  FileText,
  FileCode,
  Book,
  X,
  ExternalLink,
} from 'lucide-react';

export const CandidateResourcesView: React.FC = () => {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewResource, setPreviewResource] = useState<ResourceItem | null>(null);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        setLoading(true);
        const res = await api.getCandidateResources();
        setResources(res.resources);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchResources();
  }, []);

  const filtered = resources.filter((r) => {
    const matchCat = !categoryFilter || r.category === categoryFilter;
    const matchSearch =
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

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
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Documents & Learning Resources
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Authorized course syllabi, lecture decks, code repositories, and lab assignment briefs (PRD §7.3).
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search learning materials by title or keyword..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

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
      </div>

      {/* Resources Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-xs text-slate-400">
          No learning materials found for your cohort in this filter category.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {getCategoryIcon(item.category)}
                  <span>{item.category}</span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {item.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 font-mono">
                  {item.fileSize || 'Reference Link'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewResource(item)}
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="p-1 rounded text-blue-600 hover:bg-blue-50"
                    title="Download file"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
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
                {previewResource.description || 'No additional notes provided.'}
              </p>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-8 bg-white dark:bg-slate-950 text-center space-y-3">
              <FileText className="w-12 h-12 text-slate-400 mx-auto" />
              <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                {previewResource.fileName || previewResource.title}
              </div>
              <a
                href={previewResource.url}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
              >
                <Download className="w-4 h-4" />
                <span>Download Original Document</span>
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
