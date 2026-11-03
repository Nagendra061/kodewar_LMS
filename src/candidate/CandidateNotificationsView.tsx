import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { AppNotification } from '../types/index.ts';
import { Bell, Check, CheckCheck, Clock, Radio, BookOpen } from 'lucide-react';

export const CandidateNotificationsView: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifs = async () => {
    try {
      setLoading(true);
      const res = await api.getCandidateNotifications();
      setNotifications(res.notifications);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifs();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await api.markCandidateNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllCandidateNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Notifications & Announcements
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Important scheduling alerts, meeting access unlocks, and learning updates (PRD §7.4).
          </p>
        </div>

        {notifications.some((n) => !n.read) && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors self-start md:self-auto"
          >
            <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-xs text-slate-400">
          No notifications yet. You will receive updates when instructors post notices or schedule meetings.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border transition-colors flex items-start justify-between gap-3 ${
                !n.read
                  ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {n.title}
                  </h3>
                  {!n.read && (
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900 px-1.5 py-0.2 rounded">
                      New
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {n.message}
                </p>

                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono pt-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                  <span>·</span>
                  <span className="capitalize">{n.type}</span>
                </div>
              </div>

              {!n.read && (
                <button
                  onClick={() => handleMarkRead(n.id)}
                  title="Mark as read"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
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
