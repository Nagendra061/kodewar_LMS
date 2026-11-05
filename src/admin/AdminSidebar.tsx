import React from 'react';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Layers,
  GraduationCap,
  Calendar,
  CheckSquare,
  FolderOpen,
  Bell,
  BarChart3,
  ScrollText,
  Settings,
} from 'lucide-react';

export type AdminTab =
  | 'dashboard'
  | 'courses'
  | 'batches'
  | 'tutors'
  | 'candidates'
  | 'meetings'
  | 'attendance'
  | 'resources'
  | 'notifications'
  | 'reports'
  | 'audit-logs'
  | 'settings';

interface AdminSidebarProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ currentTab, onSelectTab }) => {
  const navItems: { id: AdminTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'batches', label: 'Batches', icon: Layers },
    { id: 'tutors', label: 'Tutors', icon: GraduationCap },
    { id: 'candidates', label: 'Candidates', icon: Users },
    { id: 'meetings', label: 'Meeting Scheduler', icon: Calendar },
    { id: 'attendance', label: 'Attendance', icon: CheckSquare },
    { id: 'resources', label: 'Resources', icon: FolderOpen },
    { id: 'notifications', label: 'Announcements', icon: Bell },
    { id: 'reports', label: 'Reports & Export', icon: BarChart3 },
    // { id: 'audit-logs', label: 'Audit Logs', icon: ScrollText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col py-4">
      <div className="px-5 mb-3">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Operations
        </span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white dark:text-slate-900' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-5 pt-4 mt-auto border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
        <div>Super Admin Console</div>
        <div className="text-[10px] text-slate-500 font-mono mt-0.5">Single-Company MVP</div>
      </div>
    </aside>
  );
};
