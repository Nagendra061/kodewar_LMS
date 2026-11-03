import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { LogOut, Shield, User, ChevronDown, Sparkles } from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onNavigate?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab }) => {
  const { user, logout, quickSwitch } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      {/* Zone 1: Brand wordmark (single line) */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 font-bold text-sm">
          K
        </div>
        <div className="flex flex-col">
          <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            Kodewar Digital Learn
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
            {user?.role === 'admin' ? 'Super Admin Portal' : 'Candidate Learning Portal'}
          </span>
        </div>
      </div>

      {/* Zone 2: Contextual Breadcrumb / Section Label */}
      <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>Workspace</span>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">
          {currentTab.replace(/-/g, ' ')}
        </span>
        {user?.role === 'candidate' && (user as any).batchName && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-slate-600 dark:text-slate-300">{(user as any).batchName}</span>
          </>
        )}
      </div>

      {/* Zone 3: Active Profile & Actions */}
      <div className="flex items-center gap-3 shrink-0 relative">
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 text-xs font-semibold">
              {user?.role === 'admin' ? <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> : <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-900 dark:text-white whitespace-nowrap leading-tight">
                {user?.name}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                {user?.role === 'admin' ? 'Super Administrator' : (user as any)?.candidateId || 'Candidate'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-2 z-50 text-xs">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <p className="font-semibold text-slate-900 dark:text-white">{user?.name}</p>
                <p className="text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                {user?.role === 'candidate' && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                    ID: {(user as any).candidateId}
                  </p>
                )}
              </div>

              <div className="py-1">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Switch Active Role
                </div>
                <button
                  onClick={() => {
                    quickSwitch('admin');
                    setProfileOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${
                    user?.role === 'admin'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Super Admin Portal</span>
                </button>
              </div>

              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
