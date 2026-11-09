import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { AppNotification } from '../types/index.ts';
import {
  Bell,
  Check,
  CheckCheck,
  Info,
  Calendar,
  AlertCircle,
  FileText,
} from 'lucide-react';

export const TutorNotificationsView: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.getTutorNotifications();
      setNotifications(res.notifications);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await api.markTutorNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllTutorNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'meeting':
        return <Calendar className="w-4 h-4 text-indigo-500" />;
      case 'warning':
      case 'urgent':
        return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'resource':
        return <FileText className="w-4 h-4 text-emerald-500" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Tutor Notifications & Announcements</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Stay informed with administrative updates, session reminders, and batch communications.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <CheckCheck className="w-4 h-4 text-blue-500" />
            <span>Mark All as Read ({unreadCount})</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">All Caught Up</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            You do not have any new notifications or announcements at this time.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-4 ${
                item.isRead
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-80'
                  : 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 shadow-xs'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 mt-0.5">
                  {getIcon(item.type)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {item.message}
                  </p>
                  <span className="text-[10px] text-slate-400 font-mono block pt-0.5">
                    {item.createdAt}
                  </span>
                </div>
              </div>

              {!item.isRead && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(item.id)}
                  title="Mark as read"
                  className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 shrink-0 transition-colors"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

