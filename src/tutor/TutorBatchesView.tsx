import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { Batch, Course, CandidateUser, MeetingSession, ResourceItem } from '../types/index.ts';
import {
  Users,
  BookOpen,
  Calendar,
  Clock,
  Search,
  ExternalLink,
  FolderOpen,
  Mail,
  Phone,
  GraduationCap,
  ChevronRight,
  X,
  FileText,
  AlertCircle,
} from 'lucide-react';

export const TutorBatchesView: React.FC = () => {
  const [batches, setBatches] = useState<(Batch & { candidateCount: number; courseName: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected batch for detail drawer
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchDetail, setBatchDetail] = useState<{
    batch: Batch;
    course: Course | null;
    roster: CandidateUser[];
    upcomingMeetings: MeetingSession[];
    completedMeetings: MeetingSession[];
    resources: ResourceItem[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'roster' | 'meetings' | 'resources'>('roster');

  const loadBatches = async () => {
    try {
      setLoading(true);
      const res = await api.getTutorBatches();
      setBatches(res.batches);
    } catch (err) {
      console.error('Failed to load tutor batches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const openBatchDetails = async (batchId: string) => {
    setSelectedBatchId(batchId);
    setDetailLoading(true);
    setActiveTab('roster');
    try {
      const res = await api.getTutorBatchById(batchId);
      setBatchDetail(res);
    } catch (err: any) {
      alert(err.message || 'Failed to load batch details');
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredBatches = batches.filter(
    (b) =>
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <span>My Assigned Batches</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Access student rosters, live schedules, and learning materials exclusively for cohorts assigned to your instructor profile.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search batches by name or code..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Batches Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {searchTerm ? 'No Matching Batches Found' : 'No Batches Assigned'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'Try modifying your search criteria.'
              : 'You have not been assigned to any course batches yet. Contact the Super Administrator for batch assignments.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBatches.map((batch) => (
            <div
              key={batch.id}
              onClick={() => openBatchDetails(batch.id)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded">
                    {batch.code}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {batch.status.toUpperCase()}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  {batch.name}
                </h3>
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-0.5 flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>{batch.courseName}</span>
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{batch.timing || 'Schedule TBA'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {batch.startDate} → {batch.endDate || 'Ongoing'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Users className="w-3.5 h-3.5 text-purple-500" />
                  <span>{batch.candidateCount} Enrolled Students</span>
                </span>
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                  <span>View Details</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===================== BATCH DETAILS DRAWER ===================== */}
      {selectedBatchId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div>
              {/* Drawer Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {batchDetail?.batch.code}
                    </span>
                    <span className="text-xs text-emerald-600 font-semibold uppercase">
                      {batchDetail?.batch.status}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {batchDetail?.batch.name || 'Batch Details'}
                  </h3>
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    {batchDetail?.course?.name || batchDetail?.batch.courseName}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedBatchId(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {detailLoading ? (
                <div className="py-16 text-center text-xs text-slate-500 animate-pulse">
                  Loading batch roster, schedule, and resources...
                </div>
              ) : batchDetail ? (
                <div className="mt-4 space-y-4">
                  {/* Tab Selector */}
                  <div className="flex items-center gap-1 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <button
                      onClick={() => setActiveTab('roster')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                        activeTab === 'roster'
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Roster ({batchDetail.roster.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('meetings')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                        activeTab === 'meetings'
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        Sessions ({batchDetail.upcomingMeetings.length + batchDetail.completedMeetings.length})
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveTab('resources')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                        activeTab === 'resources'
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Resources ({batchDetail.resources.length})</span>
                    </button>
                  </div>

                  {/* Tab 1: Candidates Roster */}
                  {activeTab === 'roster' && (
                    <div className="space-y-3">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Enrolled Students ({batchDetail.roster.length})
                      </div>

                      {batchDetail.roster.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-6 text-center">
                          No candidates enrolled in this batch.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {batchDetail.roster.map((student) => (
                            <div
                              key={student.id}
                              className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs flex items-center justify-between"
                            >
                              <div className="space-y-0.5">
                                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                  <span>{student.name}</span>
                                  <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300">
                                    {student.candidateId}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {student.email}
                                </div>
                              </div>

                              <div className="text-right text-[11px] text-slate-400">
                                <div>Joined: {student.enrollmentDate}</div>
                                <div className="text-[10px] text-emerald-600 font-medium">
                                  {student.status.toUpperCase()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Sessions & Meetings */}
                  {activeTab === 'meetings' && (
                    <div className="space-y-4">
                      {/* Upcoming */}
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Upcoming Sessions ({batchDetail.upcomingMeetings.length})
                        </div>
                        {batchDetail.upcomingMeetings.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2">No upcoming sessions</p>
                        ) : (
                          <div className="space-y-2">
                            {batchDetail.upcomingMeetings.map((m) => (
                              <div
                                key={m.id}
                                className="p-3 rounded-lg border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/20 dark:bg-indigo-950/10 text-xs flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-semibold text-slate-900 dark:text-white">
                                    {m.title}
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                    <Clock className="w-3 h-3" />
                                    <span>
                                      {m.date} · {m.startTime} - {m.endTime}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 px-2 py-0.5 rounded font-semibold">
                                  Scheduled
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Completed */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Past Sessions ({batchDetail.completedMeetings.length})
                        </div>
                        {batchDetail.completedMeetings.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2">No completed sessions</p>
                        ) : (
                          <div className="space-y-2">
                            {batchDetail.completedMeetings.map((m) => (
                              <div
                                key={m.id}
                                className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-medium text-slate-900 dark:text-white">
                                    {m.title}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    {m.date} · {m.startTime}
                                  </div>
                                </div>
                                <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
                                  Completed
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Resources */}
                  {activeTab === 'resources' && (
                    <div className="space-y-3">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Available Resources ({batchDetail.resources.length})
                      </div>
                      {batchDetail.resources.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-6 text-center">
                          No learning materials posted for this batch yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {batchDetail.resources.map((res) => (
                            <div
                              key={res.id}
                              className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2.5">
                                <FileText className="w-4 h-4 text-purple-600" />
                                <div>
                                  <div className="font-semibold text-slate-900 dark:text-white">
                                    {res.title}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {res.category} · {res.type.toUpperCase()}
                                  </div>
                                </div>
                              </div>
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-medium text-[11px]"
                              >
                                <span>Open</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedBatchId(null)}
                className="w-full py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800"
              >
                Close Batch Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

