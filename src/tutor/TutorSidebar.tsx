import React from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  CheckSquare,
  FolderOpen,
  Bell,
  User,
  GraduationCap,
  CalendarClock,
} from 'lucide-react';

export type TutorTab =
  | 'dashboard'
  | 'batches'
  | 'meetings'
  | 'attendance'
  | 'resources'
  | 'leave'
  | 'notifications'
  | 'profile'
  | 'settings';

interface TutorSidebarProps {
  currentTab: TutorTab;
  onSelectTab: (tab: TutorTab) => void;
  unreadCount?: number;
}

export const TutorSidebar: React.FC<TutorSidebarProps> = ({
  currentTab,
  onSelectTab,
  unreadCount = 0,
}) => {
  const navItems: { id: TutorTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'batches', label: 'My Batches', icon: Users },
    { id: 'meetings', label: 'Live Sessions', icon: Calendar },
    { id: 'attendance', label: 'Attendance', icon: CheckSquare },
    { id: 'resources', label: 'Learning Resources', icon: FolderOpen },
    { id: 'leave', label: 'Leave Requests', icon: CalendarClock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'profile', label: 'Profile & Settings', icon: User },
  ];

  return (
    <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col py-4">
      <div className="px-5 mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <GraduationCap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Tutor Portal</span>
        </span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            currentTab === item.id || (item.id === 'profile' && currentTab === 'settings');
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white dark:text-slate-900' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.id === 'notifications' && unreadCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-5 pt-4 mt-auto border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
        <div>Kodewar LMS</div>
        <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">
          Assigned Instructor
        </div>
      </div>
    </aside>
  );
};

