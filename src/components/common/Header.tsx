import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Shield, User } from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onNavigate?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab }) => {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      {/* Zone 1: Brand wordmark (single line) */}
      <div className="flex items-center gap-3 shrink-0">
        <img
          src="/favicon.png"
          alt="Kodewar"
          className="w-8 h-8 rounded-lg object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shadow-xs"
        />
        <div className="flex flex-col">
          <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            Kodewar LMS
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

      {/* Zone 3: Active Profile (commented out) */}
      {/*
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60">
          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 text-xs font-semibold">
            {user?.role === 'admin' ? (
              <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            ) : (
              <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-900 dark:text-white whitespace-nowrap leading-tight">
              {user?.name}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              {user?.role === 'admin' ? 'Super Administrator' : (user as any)?.candidateId || 'Candidate'}
            </span>
          </div>
        </div>
      </div>
      */}
    </header>
  );
};
