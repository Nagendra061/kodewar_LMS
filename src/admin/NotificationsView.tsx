import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { AppNotification, EmailLog, Course, Batch } from '../types/index.ts';
import {
  Bell,
  Send,
  Mail,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  Plus,
  Trash2,
  Eye,
  Edit2,
  Search,
  Filter,
  X,
  Clock,
  Check,
} from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [activeTab, setActiveTab] = useState<'announcements' | 'email-logs'>('announcements');
  const [loading, setLoading] = useState(true);

  // Announcement Modal
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'course' | 'batch'>('all');
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  // Email Outbox CRUD States
  const [emailSearch, setEmailSearch] = useState('');
  const [emailStatusFilter, setEmailStatusFilter] = useState('');
  const [selectedEmailLog, setSelectedEmailLog] = useState<EmailLog | null>(null);
  const [editingEmailLog, setEditingEmailLog] = useState<EmailLog | null>(null);
  const [showComposeModal, setShowComposeModal] = useState(false);

  // Compose Email Log Form State
  const [composeRecipientEmail, setComposeRecipientEmail] = useState('');
  const [composeRecipientName, setComposeRecipientName] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeTemplate, setComposeTemplate] = useState<EmailLog['template']>('activation');
  const [composeStatus, setComposeStatus] = useState<EmailLog['deliveryStatus']>('delivered');
  const [composeFailureReason, setComposeFailureReason] = useState('');
  const [composeSubmitting, setComposeSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [notifRes, emailRes, crsRes, bchRes] = await Promise.all([
        api.getNotifications(),
        api.getEmailLogs(),
        api.getCourses(),
        api.getBatches(),
      ]);
      setNotifications(notifRes.notifications);
      setEmailLogs(emailRes.logs);
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
  }, []);

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.postAnnouncement({
        title,
        message,
        targetAudience,
        courseId: targetAudience !== 'all' ? courseId : undefined,
        batchId: targetAudience === 'batch' ? batchId : undefined,
        sendEmail,
      });

      setAlertMsg(`Announcement published to ${res.recipientCount} eligible candidates.`);
      setShowModal(false);
      setTitle('');
      setMessage('');
      loadData();
      setTimeout(() => setAlertMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to post announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNotification = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete announcement "${title}"?`)) {
      return;
    }
    try {
      await api.deleteNotification(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete announcement');
    }
  };

  // ==========================================
  // TRANSACTIONAL EMAIL OUTBOX CRUD HANDLERS
  // ==========================================

  const handleRetryEmail = async (id: string) => {
    try {
      await api.retryEmail(id);
      loadData();
      setAlertMsg('Email delivery retried successfully.');
      setTimeout(() => setAlertMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Retry failed');
    }
  };

  const handleDeleteEmailLog = async (id: string, subject: string) => {
    if (!confirm(`Are you sure you want to permanently delete email log: "${subject}"?`)) {
      return;
    }
    try {
      await api.deleteEmailLog(id);
      if (selectedEmailLog && selectedEmailLog.id === id) {
        setSelectedEmailLog(null);
      }
      if (editingEmailLog && editingEmailLog.id === id) {
        setEditingEmailLog(null);
      }
      loadData();
      setAlertMsg('Email log deleted from outbox.');
      setTimeout(() => setAlertMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete email log');
    }
  };

  const handleClearAllEmailLogs = async () => {
    if (emailLogs.length === 0) return;
    if (!confirm(`Are you sure you want to clear all ${emailLogs.length} transactional email logs?`)) {
      return;
    }
    try {
      await api.clearEmailLogs();
      loadData();
      setAlertMsg('All email outbox logs cleared.');
      setTimeout(() => setAlertMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to clear email logs');
    }
  };

  const handleCreateEmailLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setComposeSubmitting(true);
    try {
      await api.createEmailLog({
        recipientEmail: composeRecipientEmail,
        recipientName: composeRecipientName || composeRecipientEmail.split('@')[0],
        subject: composeSubject,
        template: composeTemplate,
        deliveryStatus: composeStatus,
        failureReason: composeStatus === 'failed' ? (composeFailureReason || 'SMTP gateway timeout') : undefined,
      });

      setShowComposeModal(false);
      setComposeRecipientEmail('');
      setComposeRecipientName('');
      setComposeSubject('');
      setComposeFailureReason('');
      setAlertMsg('Transactional email dispatched & logged in outbox.');
      loadData();
      setTimeout(() => setAlertMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch email');
    } finally {
      setComposeSubmitting(false);
    }
  };

  const handleUpdateEmailLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmailLog) return;
    try {
      await api.updateEmailLog(editingEmailLog.id, {
        recipientEmail: editingEmailLog.recipientEmail,
        recipientName: editingEmailLog.recipientName,
        subject: editingEmailLog.subject,
        template: editingEmailLog.template,
        deliveryStatus: editingEmailLog.deliveryStatus,
        failureReason: editingEmailLog.deliveryStatus === 'failed' ? (editingEmailLog.failureReason || 'Manual failure override') : undefined,
      });

      setEditingEmailLog(null);
      loadData();
      setAlertMsg('Email log entry updated successfully.');
      setTimeout(() => setAlertMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update email log');
    }
  };

  // Filtered Email Logs
  const filteredEmailLogs = emailLogs.filter((log) => {
    if (emailStatusFilter && log.deliveryStatus !== emailStatusFilter) return false;
    if (emailSearch) {
      const q = emailSearch.toLowerCase();
      const match =
        log.recipientEmail.toLowerCase().includes(q) ||
        log.recipientName.toLowerCase().includes(q) ||
        log.subject.toLowerCase().includes(q) ||
        log.template.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Announcements & Transactional Email Outbox
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Broadcast messages and manage transactional email delivery logs with real-time JSON file persistence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'announcements' ? (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Post Announcement</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {emailLogs.length > 0 && (
                <button
                  onClick={handleClearAllEmailLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Outbox</span>
                </button>
              )}
              <button
                onClick={() => setShowComposeModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Dispatch Email</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {alertMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{alertMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 text-xs">
        <button
          onClick={() => setActiveTab('announcements')}
          className={`pb-2.5 px-2 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'announcements'
              ? 'border-slate-900 text-slate-900 dark:border-white dark:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>In-App Announcements ({notifications.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('email-logs')}
          className={`pb-2.5 px-2 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'email-logs'
              ? 'border-slate-900 text-slate-900 dark:border-white dark:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Transactional Email Outbox ({emailLogs.length})</span>
        </button>
      </div>

      {/* Announcements Tab */}
      {activeTab === 'announcements' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 shadow-sm">
          {notifications.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
              <div className="font-semibold text-slate-700 dark:text-slate-300">No announcements published yet.</div>
              <div className="text-[11px] mt-0.5">Click "Post Announcement" above to broadcast to students.</div>
            </div>
          ) : (
            notifications.map((notif) => (
              <div key={notif.id} className="p-4 flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs">
                <div className="space-y-1 max-w-3xl">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white text-sm">
                      {notif.title}
                    </span>
                    <span className="text-[11px] text-slate-400">·</span>
                    <span className="capitalize font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                      Audience: {notif.targetAudience}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {notif.message}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-[11px] text-slate-400 tabular-nums font-mono">
                    {new Date(notif.createdAt).toLocaleString()}
                  </div>
                  <button
                    onClick={() => handleDeleteNotification(notif.id, notif.title)}
                    title="Delete Announcement"
                    className="p-1.5 rounded hover:bg-rose-50 text-rose-600 dark:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Transactional Email Outbox Tab */}
      {activeTab === 'email-logs' && (
        <div className="space-y-4">
          {/* Filters & Search Toolbar */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search recipient, subject, template..."
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <select
                value={emailStatusFilter}
                onChange={(e) => setEmailStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                <option value="">All Delivery States</option>
                <option value="delivered">Delivered</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="queued">Queued</option>
                <option value="bounced">Bounced</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 tabular-nums">
              Showing {filteredEmailLogs.length} of {emailLogs.length} logs
            </div>
          </div>

          {/* Email Outbox Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Subject & Template</th>
                    <th className="py-3 px-4">Delivery State</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-right">Actions (CRUD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredEmailLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-400">
                        <Mail className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
                        <div className="font-semibold text-slate-700 dark:text-slate-300">No transactional email logs found.</div>
                        <div className="text-[11px] mt-0.5">
                          {emailLogs.length === 0
                            ? 'Emails sent when activating candidates, scheduling sessions, or posting announcements will appear here.'
                            : 'No records match the active filter criteria.'}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredEmailLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{log.recipientName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{log.recipientEmail}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800 dark:text-slate-200">{log.subject}</div>
                          <div className="text-[11px] text-slate-400 font-mono">Template: {log.template}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="inline-flex items-center gap-1.5">
                            <span
                              className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded ${
                                log.deliveryStatus === 'delivered'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : log.deliveryStatus === 'sent'
                                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                  : log.deliveryStatus === 'queued'
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                              }`}
                            >
                              {log.deliveryStatus}
                            </span>
                            {log.failureReason && (
                              <span className="text-[10px] text-rose-500 italic max-w-[140px] truncate" title={log.failureReason}>
                                · {log.failureReason}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 tabular-nums text-slate-500 font-mono text-[11px]">
                          <div>{new Date(log.sentAt).toLocaleDateString()}</div>
                          <div className="text-[10px] text-slate-400">{new Date(log.sentAt).toLocaleTimeString()}</div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Read / View details */}
                            <button
                              onClick={() => setSelectedEmailLog(log)}
                              title="View Email Message & Telemetry"
                              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Update / Edit */}
                            <button
                              onClick={() => setEditingEmailLog({ ...log })}
                              title="Edit Email Record"
                              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Retry delivery if failed or queued */}
                            {log.deliveryStatus !== 'delivered' && (
                              <button
                                onClick={() => handleRetryEmail(log.id)}
                                title="Retry Delivery"
                                className="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-600 dark:text-blue-400 transition-colors"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteEmailLog(log.id, log.subject)}
                              title="Delete Email Log"
                              className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View / Inspect Email Log (READ) */}
      {selectedEmailLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Email Delivery Telemetry
                </h3>
              </div>
              <button
                onClick={() => setSelectedEmailLog(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <div>
                  <span className="text-[11px] text-slate-400 block">Recipient:</span>
                  <div className="font-semibold text-slate-900 dark:text-white">{selectedEmailLog.recipientName}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{selectedEmailLog.recipientEmail}</div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Delivery State:</span>
                  <span
                    className={`inline-block mt-0.5 text-[11px] font-semibold uppercase px-2 py-0.5 rounded ${
                      selectedEmailLog.deliveryStatus === 'delivered'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : selectedEmailLog.deliveryStatus === 'sent'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : selectedEmailLog.deliveryStatus === 'queued'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {selectedEmailLog.deliveryStatus}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Template:</span>
                  <div className="font-mono text-slate-700 dark:text-slate-300">{selectedEmailLog.template}</div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Sent Timestamp:</span>
                  <div className="font-mono text-slate-700 dark:text-slate-300">
                    {new Date(selectedEmailLog.sentAt).toLocaleString()}
                  </div>
                </div>
                {selectedEmailLog.deliveredAt && (
                  <div className="col-span-2">
                    <span className="text-[11px] text-slate-400 block">Delivered Timestamp:</span>
                    <div className="font-mono text-emerald-600 dark:text-emerald-400">
                      {new Date(selectedEmailLog.deliveredAt).toLocaleString()}
                    </div>
                  </div>
                )}
                {selectedEmailLog.failureReason && (
                  <div className="col-span-2">
                    <span className="text-[11px] text-rose-500 font-semibold block">Failure Diagnostics:</span>
                    <div className="text-rose-700 dark:text-rose-300 font-mono mt-0.5">
                      {selectedEmailLog.failureReason}
                    </div>
                  </div>
                )}
              </div>

              {/* Message Payload Simulation */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                  Message Body Payload
                </span>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800 space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-white text-sm pb-2 border-b border-slate-100 dark:border-slate-700">
                    {selectedEmailLog.subject}
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed pt-1">
                    <p>Dear {selectedEmailLog.recipientName},</p>
                    <p className="mt-1.5">
                      {selectedEmailLog.template === 'activation' &&
                        'Welcome to Kodewar LMS. Your candidate account has been provisioned. Please sign in and complete your initial password change.'}
                      {selectedEmailLog.template === 'meeting_scheduled' &&
                        'A new live learning session has been scheduled for your cohort batch. Please review your meeting calendar.'}
                      {selectedEmailLog.template === 'meeting_rescheduled' &&
                        'Your instructor has updated the meeting schedule. Please refer to your updated portal calendar.'}
                      {selectedEmailLog.template === 'meeting_cancelled' &&
                        'The scheduled learning session has been cancelled. Please monitor announcements for further updates.'}
                      {selectedEmailLog.template === 'batch_transfer' &&
                        'Your batch cohort assignment has been updated. Your course materials and schedules now reflect your new cohort.'}
                      {selectedEmailLog.template === 'announcement' &&
                        'An administrative notice has been posted to your student dashboard.'}
                      {selectedEmailLog.template === 'password_reset' &&
                        'Your account password was updated successfully.'}
                    </p>
                    <p className="mt-3 text-[11px] text-slate-400">
                      Best regards,<br />
                      Kodewar LMS Team
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  const toDelete = selectedEmailLog;
                  setSelectedEmailLog(null);
                  handleDeleteEmailLog(toDelete.id, toDelete.subject);
                }}
                className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Log</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const toEdit = selectedEmailLog;
                    setSelectedEmailLog(null);
                    setEditingEmailLog({ ...toEdit });
                  }}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Record</span>
                </button>
                <button
                  onClick={() => setSelectedEmailLog(null)}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Email Log (UPDATE) */}
      {editingEmailLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Edit Transactional Email Log
                </h3>
              </div>
              <button
                onClick={() => setEditingEmailLog(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateEmailLog} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Recipient Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editingEmailLog.recipientName}
                    onChange={(e) => setEditingEmailLog({ ...editingEmailLog, recipientName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Recipient Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={editingEmailLog.recipientEmail}
                    onChange={(e) => setEditingEmailLog({ ...editingEmailLog, recipientEmail: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={editingEmailLog.subject}
                  onChange={(e) => setEditingEmailLog({ ...editingEmailLog, subject: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Delivery State
                  </label>
                  <select
                    value={editingEmailLog.deliveryStatus}
                    onChange={(e) => setEditingEmailLog({ ...editingEmailLog, deliveryStatus: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="delivered">Delivered</option>
                    <option value="sent">Sent</option>
                    <option value="queued">Queued</option>
                    <option value="failed">Failed</option>
                    <option value="bounced">Bounced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Template
                  </label>
                  <select
                    value={editingEmailLog.template}
                    onChange={(e) => setEditingEmailLog({ ...editingEmailLog, template: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="activation">activation</option>
                    <option value="meeting_scheduled">meeting_scheduled</option>
                    <option value="meeting_rescheduled">meeting_rescheduled</option>
                    <option value="meeting_cancelled">meeting_cancelled</option>
                    <option value="batch_transfer">batch_transfer</option>
                    <option value="announcement">announcement</option>
                    <option value="password_reset">password_reset</option>
                  </select>
                </div>
              </div>

              {(editingEmailLog.deliveryStatus === 'failed' || editingEmailLog.deliveryStatus === 'bounced') && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Failure / Bounce Reason
                  </label>
                  <input
                    type="text"
                    value={editingEmailLog.failureReason || ''}
                    onChange={(e) => setEditingEmailLog({ ...editingEmailLog, failureReason: e.target.value })}
                    placeholder="e.g. SMTP 550 Mailbox unavailable"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingEmailLog(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300"
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

      {/* Modal: Compose / Dispatch Transactional Email (CREATE) */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Dispatch Transactional Email
                </h3>
              </div>
              <button
                onClick={() => setShowComposeModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmailLog} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Recipient Name
                  </label>
                  <input
                    type="text"
                    value={composeRecipientName}
                    onChange={(e) => setComposeRecipientName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Recipient Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={composeRecipientEmail}
                    onChange={(e) => setComposeRecipientEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="e.g. Welcome to Kodewar LMS - Orientation Details"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Template Type
                  </label>
                  <select
                    value={composeTemplate}
                    onChange={(e) => setComposeTemplate(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="activation">activation</option>
                    <option value="meeting_scheduled">meeting_scheduled</option>
                    <option value="meeting_rescheduled">meeting_rescheduled</option>
                    <option value="meeting_cancelled">meeting_cancelled</option>
                    <option value="batch_transfer">batch_transfer</option>
                    <option value="announcement">announcement</option>
                    <option value="password_reset">password_reset</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Initial Delivery State
                  </label>
                  <select
                    value={composeStatus}
                    onChange={(e) => setComposeStatus(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="delivered">Delivered (Sent)</option>
                    <option value="sent">Sent (Transit)</option>
                    <option value="queued">Queued</option>
                    <option value="failed">Failed (Test error)</option>
                  </select>
                </div>
              </div>

              {composeStatus === 'failed' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Simulation Failure Reason
                  </label>
                  <input
                    type="text"
                    value={composeFailureReason}
                    onChange={(e) => setComposeFailureReason(e.target.value)}
                    placeholder="e.g. SMTP 554 Relay access denied"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={composeSubmitting}
                  className="px-4 py-1.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {composeSubmitting ? 'Dispatching...' : 'Dispatch & Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Post Announcement */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
              Post Announcement
            </h3>

            <form onSubmit={handlePostAnnouncement} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Guest Lecture Announcement & Lab Schedule"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Audience
                </label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="all">All Registered Candidates</option>
                  <option value="course">Course-Specific</option>
                  <option value="batch">Batch-Specific</option>
                </select>
              </div>

              {targetAudience !== 'all' && (
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

                  {targetAudience === 'batch' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Batch
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
                  Message Body *
                </label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type the message to be displayed in candidate dashboards and sent via email..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <label htmlFor="sendEmail" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  Also dispatch transactional email to all eligible candidates
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Publishing...' : 'Dispatch Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
