/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Header } from './components/common/Header.tsx';
import { ChangePasswordModal } from './components/common/ChangePasswordModal.tsx';
import { LoginPage } from './auth/LoginPage.tsx';

// Admin Views
import { AdminSidebar, AdminTab } from './admin/AdminSidebar.tsx';
import { DashboardView as AdminDashboard } from './admin/DashboardView.tsx';
import { CandidatesView } from './admin/CandidatesView.tsx';
import { CoursesView } from './admin/CoursesView.tsx';
import { BatchesView } from './admin/BatchesView.tsx';
import { TutorsView } from './admin/TutorsView.tsx';
import { MeetingSchedulerView } from './admin/MeetingSchedulerView.tsx';
import { AttendanceView } from './admin/AttendanceView.tsx';
import { ResourcesView } from './admin/ResourcesView.tsx';
import { NotificationsView } from './admin/NotificationsView.tsx';
import { ReportsView } from './admin/ReportsView.tsx';
import { AuditLogsView } from './admin/AuditLogsView.tsx';
import { SettingsView } from './admin/SettingsView.tsx';

// Candidate Views
import { CandidateSidebar, CandidateTab } from './candidate/CandidateSidebar.tsx';
import { CandidateDashboard } from './candidate/CandidateDashboard.tsx';
import { CandidateMeetingsView } from './candidate/CandidateMeetingsView.tsx';
import { CandidateResourcesView } from './candidate/CandidateResourcesView.tsx';
import { CandidateAttendanceView } from './candidate/CandidateAttendanceView.tsx';
import { CandidateNotificationsView } from './candidate/CandidateNotificationsView.tsx';
import { CandidateProfileView } from './candidate/CandidateProfileView.tsx';

import { Menu, X } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [candidateTab, setCandidateTab] = useState<CandidateTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-slate-900 dark:border-white border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-slate-500 tracking-wider">
          Initializing Kodewar LMS...
        </span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Header (Top Bar Contract: Brand, Context/Nav, Profile) */}
      <Header
        currentTab={user.role === 'admin' ? adminTab : candidateTab}
        onNavigate={(tab) => {
          if (user.role === 'admin') setAdminTab(tab as AdminTab);
          else setCandidateTab(tab as CandidateTab);
        }}
      />

      {/* Mobile Menu Toggle Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 capitalize">
          {user.role === 'admin' ? adminTab.replace(/-/g, ' ') : candidateTab.replace(/-/g, ' ')}
        </span>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* 3. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex">
          {user.role === 'admin' ? (
            <AdminSidebar currentTab={adminTab} onSelectTab={setAdminTab} />
          ) : (
            <CandidateSidebar currentTab={candidateTab} onSelectTab={setCandidateTab} />
          )}
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs flex">
            <div className="w-64 bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col">
              <div className="p-3 flex justify-end border-b border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-slate-500 hover:text-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {user.role === 'admin' ? (
                  <AdminSidebar
                    currentTab={adminTab}
                    onSelectTab={(tab) => {
                      setAdminTab(tab);
                      setMobileMenuOpen(false);
                    }}
                  />
                ) : (
                  <CandidateSidebar
                    currentTab={candidateTab}
                    onSelectTab={(tab) => {
                      setCandidateTab(tab);
                      setMobileMenuOpen(false);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto">
          {user.role === 'admin' ? (
            <>
              {adminTab === 'dashboard' && <AdminDashboard onNavigate={setAdminTab} />}
              {adminTab === 'candidates' && <CandidatesView />}
              {adminTab === 'courses' && <CoursesView />}
              {adminTab === 'batches' && <BatchesView />}
              {adminTab === 'tutors' && <TutorsView />}
              {adminTab === 'meetings' && <MeetingSchedulerView />}
              {adminTab === 'attendance' && <AttendanceView />}
              {adminTab === 'resources' && <ResourcesView />}
              {adminTab === 'notifications' && <NotificationsView />}
              {adminTab === 'reports' && <ReportsView />}
              {/* {adminTab === 'audit-logs' && <AuditLogsView />} */}
              {adminTab === 'settings' && <SettingsView />}
            </>
          ) : (
            <>
              {candidateTab === 'dashboard' && <CandidateDashboard onNavigate={setCandidateTab} />}
              {candidateTab === 'meetings' && <CandidateMeetingsView />}
              {candidateTab === 'resources' && <CandidateResourcesView />}
              {candidateTab === 'attendance' && <CandidateAttendanceView />}
              {candidateTab === 'notifications' && <CandidateNotificationsView />}
              {candidateTab === 'profile' && <CandidateProfileView />}
            </>
          )}
        </main>
      </div>

      {/* Mandatory PRD First-Login Password Replacement Modal (BR-07) */}
      <ChangePasswordModal />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
