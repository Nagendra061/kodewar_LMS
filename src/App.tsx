/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import { LeaveManagementView } from './admin/features/leave-management/LeaveManagementView.tsx';
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
import { MyLeaveView } from './candidate/features/my-leave/MyLeaveView.tsx';
import { CandidateNotificationsView } from './candidate/CandidateNotificationsView.tsx';
import { CandidateProfileView } from './candidate/CandidateProfileView.tsx';

// Tutor Views
import { TutorSidebar, TutorTab } from './tutor/TutorSidebar.tsx';
import { TutorDashboard } from './tutor/TutorDashboard.tsx';
import { TutorBatchesView } from './tutor/TutorBatchesView.tsx';
import { TutorMeetingsView } from './tutor/TutorMeetingsView.tsx';
import { TutorAttendanceView } from './tutor/TutorAttendanceView.tsx';
import { TutorResourcesView } from './tutor/TutorResourcesView.tsx';
import { TutorNotificationsView } from './tutor/TutorNotificationsView.tsx';
import { TutorProfileView } from './tutor/TutorProfileView.tsx';
import { TutorLeaveView } from './tutor/TutorLeaveView.tsx';

import { Menu, X } from 'lucide-react';

const ADMIN_TABS: AdminTab[] = [
  'dashboard',
  'courses',
  'batches',
  'tutors',
  'candidates',
  'meetings',
  'attendance',
  'leave-management',
  'resources',
  'notifications',
  'reports',
  'audit-logs',
  'settings',
];

const CANDIDATE_TABS: CandidateTab[] = [
  'dashboard',
  'meetings',
  'resources',
  'attendance',
  'my-leave',
  'notifications',
  'profile',
];

const TUTOR_TABS: TutorTab[] = [
  'dashboard',
  'batches',
  'meetings',
  'attendance',
  'resources',
  'leave',
  'notifications',
  'profile',
  'settings',
];

function getInitialTab<T extends string>(role: 'admin' | 'candidate' | 'tutor', validTabs: T[]): T {
  try {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && validTabs.includes(tabParam as T)) {
      return tabParam as T;
    }

    const hash = window.location.hash.replace(/^#/, '');
    if (hash && validTabs.includes(hash as T)) {
      return hash as T;
    }

    const saved = localStorage.getItem(`kodewar_${role}_tab`);
    if (saved && validTabs.includes(saved as T)) {
      return saved as T;
    }
  } catch {}

  return validTabs[0];
}

const MainApp: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [adminTab, setAdminTab] = useState<AdminTab>(() => getInitialTab('admin', ADMIN_TABS));
  const [candidateTab, setCandidateTab] = useState<CandidateTab>(() => getInitialTab('candidate', CANDIDATE_TABS));
  const [tutorTab, setTutorTab] = useState<TutorTab>(() => getInitialTab('tutor', TUTOR_TABS));
  const [attendanceTargetSessionId, setAttendanceTargetSessionId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigateAdmin = (tab: AdminTab) => {
    setAdminTab(tab);
    try {
      localStorage.setItem('kodewar_admin_tab', tab);
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== tab) {
        url.searchParams.set('tab', tab);
        window.history.pushState({ tab }, '', url.toString());
      }
    } catch {}
  };

  const navigateCandidate = (tab: CandidateTab) => {
    setCandidateTab(tab);
    try {
      localStorage.setItem('kodewar_candidate_tab', tab);
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== tab) {
        url.searchParams.set('tab', tab);
        window.history.pushState({ tab }, '', url.toString());
      }
    } catch {}
  };

  const navigateTutor = (tab: TutorTab) => {
    setTutorTab(tab);
    try {
      localStorage.setItem('kodewar_tutor_tab', tab);
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== tab) {
        url.searchParams.set('tab', tab);
        window.history.pushState({ tab }, '', url.toString());
      }
    } catch {}
  };

  // Keep URL in sync with active tab on mount or tab change
  useEffect(() => {
    if (!user) return;
    const current =
      user.role === 'admin'
        ? adminTab
        : user.role === 'tutor'
        ? tutorTab
        : candidateTab;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== current) {
        url.searchParams.set('tab', current);
        window.history.replaceState({ tab: current }, '', url.toString());
      }
    } catch {}
  }, [user, adminTab, candidateTab, tutorTab]);

  // Support browser Back/Forward navigation
  useEffect(() => {
    const onPopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (user?.role === 'admin' && tabParam && ADMIN_TABS.includes(tabParam as AdminTab)) {
          setAdminTab(tabParam as AdminTab);
          localStorage.setItem('kodewar_admin_tab', tabParam);
        } else if (user?.role === 'tutor' && tabParam && TUTOR_TABS.includes(tabParam as TutorTab)) {
          setTutorTab(tabParam as TutorTab);
          localStorage.setItem('kodewar_tutor_tab', tabParam);
        } else if (user?.role === 'candidate' && tabParam && CANDIDATE_TABS.includes(tabParam as CandidateTab)) {
          setCandidateTab(tabParam as CandidateTab);
          localStorage.setItem('kodewar_candidate_tab', tabParam);
        }
      } catch {}
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [user?.role]);

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

  const currentTab =
    user.role === 'admin' ? adminTab : user.role === 'tutor' ? tutorTab : candidateTab;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        onNavigate={(tab) => {
          if (user.role === 'admin') navigateAdmin(tab as AdminTab);
          else if (user.role === 'tutor') navigateTutor(tab as TutorTab);
          else navigateCandidate(tab as CandidateTab);
        }}
      />

      {/* Mobile Menu Toggle Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 capitalize">
          {currentTab.replace(/-/g, ' ')}
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
        <div className="hidden md:flex relative z-30">
          {user.role === 'admin' ? (
            <AdminSidebar currentTab={adminTab} onSelectTab={navigateAdmin} />
          ) : user.role === 'tutor' ? (
            <TutorSidebar currentTab={tutorTab} onSelectTab={navigateTutor} />
          ) : (
            <CandidateSidebar currentTab={candidateTab} onSelectTab={navigateCandidate} />
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
                      navigateAdmin(tab);
                      setMobileMenuOpen(false);
                    }}
                  />
                ) : user.role === 'tutor' ? (
                  <TutorSidebar
                    currentTab={tutorTab}
                    onSelectTab={(tab) => {
                      navigateTutor(tab);
                      setMobileMenuOpen(false);
                    }}
                  />
                ) : (
                  <CandidateSidebar
                    currentTab={candidateTab}
                    onSelectTab={(tab) => {
                      navigateCandidate(tab);
                      setMobileMenuOpen(false);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto relative">
          {/* Light Watermark Overlay across all sections & cards on all portals */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 flex items-center justify-center z-20 overflow-hidden select-none md:left-64"
          >
            <img
              src="/logo.png"
              alt=""
              className="w-[500px] max-w-[60vw] max-h-[60vh] object-contain opacity-[0.18] dark:opacity-[0.20] dark:invert pointer-events-none"
            />
          </div>

          <div className="relative min-h-full">
            {user.role === 'admin' ? (
              <>
                {adminTab === 'dashboard' && <AdminDashboard onNavigate={navigateAdmin} />}
                {adminTab === 'candidates' && <CandidatesView />}
                {adminTab === 'courses' && <CoursesView />}
                {adminTab === 'batches' && <BatchesView />}
                {adminTab === 'tutors' && <TutorsView />}
                {adminTab === 'meetings' && <MeetingSchedulerView />}
                {adminTab === 'attendance' && <AttendanceView />}
                {adminTab === 'leave-management' && <LeaveManagementView />}
                {adminTab === 'resources' && <ResourcesView />}
                {adminTab === 'notifications' && <NotificationsView />}
                {adminTab === 'reports' && <ReportsView />}
                {/* {adminTab === 'audit-logs' && <AuditLogsView />} */}
                {adminTab === 'settings' && <SettingsView />}
              </>
            ) : user.role === 'tutor' ? (
              <>
                {tutorTab === 'dashboard' && <TutorDashboard onNavigate={navigateTutor} />}
                {tutorTab === 'batches' && <TutorBatchesView />}
                {tutorTab === 'meetings' && (
                  <TutorMeetingsView
                    onSelectMeetingForAttendance={(sessionId) => {
                      setAttendanceTargetSessionId(sessionId);
                      navigateTutor('attendance');
                    }}
                  />
                )}
                {tutorTab === 'attendance' && (
                  <TutorAttendanceView initialSessionId={attendanceTargetSessionId} />
                )}
                {tutorTab === 'resources' && <TutorResourcesView />}
                {tutorTab === 'leave' && <TutorLeaveView />}
                {tutorTab === 'notifications' && <TutorNotificationsView />}
                {(tutorTab === 'profile' || tutorTab === 'settings') && <TutorProfileView />}
              </>
            ) : (
              <>
                {candidateTab === 'dashboard' && <CandidateDashboard onNavigate={navigateCandidate} />}
                {candidateTab === 'meetings' && <CandidateMeetingsView />}
                {candidateTab === 'resources' && <CandidateResourcesView />}
                {candidateTab === 'attendance' && <CandidateAttendanceView />}
                {candidateTab === 'my-leave' && <MyLeaveView />}
                {candidateTab === 'notifications' && <CandidateNotificationsView />}
                {candidateTab === 'profile' && <CandidateProfileView />}
              </>
            )}
          </div>
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
