import type {
  AuthUser,
  CandidateUser,
  Course,
  Batch,
  Tutor,
  MeetingSession,
  AttendanceRecord,
  ResourceItem,
  AppNotification,
  EmailLog,
  AuditLog,
  SystemSettings,
  CandidateBatchAssignment,
  LeaveApplication,
  LeaveType,
  LeavePolicy,
  LeaveStatus,
} from '../types/index.ts';

const TOKEN_KEY = 'kodewar_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function toQueryString(params?: Record<string, any>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'undefined' && value !== 'all') {
      searchParams.append(key, String(value));
    }
  }
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (identifier: string, password: string) =>
    request<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    }),

  getMe: () =>
    request<{ user: AuthUser }>('/auth/me'),

  changePassword: (newPassword: string, currentPassword?: string) =>
    request<{ success: boolean; message: string; user?: AuthUser }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword, currentPassword }),
    }),

  quickSwitch: (role: 'admin' | 'candidate' | 'tutor', id?: string) =>
    request<{ token: string; user: AuthUser }>('/auth/quick-switch', {
      method: 'POST',
      body: JSON.stringify({ role, candidateId: id, tutorId: id }),
    }),

  // Candidates
  getCandidates: (params?: { courseId?: string; batchId?: string; status?: string; search?: string }) =>
    request<{ candidates: CandidateUser[] }>(`/candidates${toQueryString(params)}`),

  getCandidateById: (id: string) =>
    request<{ candidate: CandidateUser; assignments: CandidateBatchAssignment[]; attendance: AttendanceRecord[] }>(
      `/candidates/${id}`
    ),

  createCandidate: (data: any) =>
    request<{ candidate: CandidateUser; tempPassword?: string; n8nStatus?: any }>('/candidates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCandidate: (id: string, data: any) =>
    request<{ candidate: CandidateUser }>(`/candidates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCandidate: (id: string) =>
    request<{ success: boolean; message: string }>(`/candidates/${id}`, {
      method: 'DELETE',
    }),

  resendCandidateActivation: (id: string) =>
    request<{ success: boolean; tempPassword: string; message: string; n8nStatus?: any }>(
      `/candidates/${id}/resend-activation`,
      {
        method: 'POST',
      }
    ),

  testN8nWebhook: (data?: { email?: string; name?: string; course?: string }) =>
    request<{ success: boolean; message: string; n8nStatus: any }>('/n8n/test', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  importPreview: (rows: any[], defaultCourseId?: string, defaultBatchId?: string) =>
    request<{
      summary: { total: number; valid: number; invalid: number; duplicate: number };
      validRows: any[];
      invalidRows: any[];
      duplicateRows: any[];
    }>('/candidates/import/preview', {
      method: 'POST',
      body: JSON.stringify({ rows, defaultCourseId, defaultBatchId }),
    }),

  importCommit: (validRows: any[]) =>
    request<{ success: boolean; importedCount: number; candidates: any[] }>('/candidates/import/commit', {
      method: 'POST',
      body: JSON.stringify({ validRows }),
    }),

  // Courses
  getCourses: () =>
    request<{ courses: (Course & { batchCount: number; candidateCount: number })[] }>('/courses'),

  createCourse: (data: Partial<Course>) =>
    request<{ course: Course }>('/courses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCourse: (id: string, data: Partial<Course>) =>
    request<{ course: Course }>(`/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCourse: (id: string, cascade?: boolean) =>
    request<{ success: boolean; message: string }>(`/courses/${id}${cascade ? '?cascade=true' : ''}`, {
      method: 'DELETE',
    }),

  // Batches
  getBatches: (courseId?: string) => {
    const query = courseId ? `?courseId=${courseId}` : '';
    return request<{ batches: Batch[] }>(`/batches${query}`);
  },

  createBatch: (data: Partial<Batch>) =>
    request<{ batch: Batch }>('/batches', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateBatch: (id: string, data: Partial<Batch>) =>
    request<{ batch: Batch }>(`/batches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteBatch: (id: string, cascade?: boolean) =>
    request<{ success: boolean; message: string }>(`/batches/${id}${cascade ? '?cascade=true' : ''}`, {
      method: 'DELETE',
    }),

  getBatchRoster: (id: string) =>
    request<{ batch: Batch; roster: CandidateUser[] }>(`/batches/${id}/roster`),

  transferBatch: (data: { candidateId: string; destinationBatchId: string; effectiveDate?: string; reason?: string }) =>
    request<{ success: boolean; message: string; assignment: CandidateBatchAssignment }>('/batches/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Tutors
  getTutors: () =>
    request<{ tutors: Tutor[] }>('/tutors'),

  createTutor: (data: Partial<Tutor>) =>
    request<{ tutor: Tutor }>('/tutors', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTutor: (id: string, data: Partial<Tutor>) =>
    request<{ tutor: Tutor }>(`/tutors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTutor: (id: string, cascade?: boolean) =>
    request<{ success: boolean; message: string }>(`/tutors/${id}${cascade ? '?cascade=true' : ''}`, {
      method: 'DELETE',
    }),

  resetTutorPassword: (id: string) =>
    request<{ success: boolean; tempPassword: string; message: string }>(`/tutors/${id}/reset-password`, {
      method: 'POST',
    }),

  getTutorActivity: (id: string) =>
    request<{
      tutor: Tutor;
      activity: {
        assignedBatchesCount: number;
        totalCandidates: number;
        scheduledMeetingsCount: number;
        completedMeetingsCount: number;
        attendanceSessionsMarked: number;
        batches: Batch[];
        upcomingMeetings: MeetingSession[];
        completedMeetings: MeetingSession[];
      };
    }>(`/tutors/${id}/activity`),

  // Meetings
  getMeetings: (params?: { batchId?: string; courseId?: string; tutorId?: string; status?: string }) =>
    request<{ meetings: MeetingSession[] }>(`/meetings${toQueryString(params)}`),

  createMeeting: (data: any) =>
    request<{ session: MeetingSession; hasTutorConflict?: boolean; conflictWarning?: string }>('/meetings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createRecurringMeetings: (data: any) =>
    request<{ seriesId: string; occurrencesCount: number; sessions: MeetingSession[] }>('/meetings/recurring', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMeeting: (id: string, data: any) =>
    request<{ session: MeetingSession }>(`/meetings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  cancelMeeting: (id: string, cancelReason: string) =>
    request<{ session: MeetingSession }>(`/meetings/${id}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ cancelReason }),
    }),

  setMeetingAccess: (id: string, accessStatus: 'enabled' | 'disabled') =>
    request<{ session: MeetingSession }>(`/meetings/${id}/access`, {
      method: 'PUT',
      body: JSON.stringify({ accessStatus }),
    }),

  completeMeeting: (id: string) =>
    request<{ session: MeetingSession }>(`/meetings/${id}/complete`, {
      method: 'PUT',
    }),

  deleteMeeting: (id: string) =>
    request<{ success: boolean; message: string }>(`/meetings/${id}`, {
      method: 'DELETE',
    }),

  // Candidate Meeting Endpoints
  getCandidateMeetings: () =>
    request<{ meetings: (MeetingSession & { isJoinable: boolean })[] }>('/candidate/meetings'),

  joinCandidateMeeting: (id: string) =>
    request<{ meetingUrl: string; platform: string; title: string; disclaimer: string }>(
      `/candidate/meetings/${id}/join`
    ),

  // Attendance
  getSessionAttendance: (sessionId: string) =>
    request<{ session: MeetingSession; roster: any[] }>(`/attendance/session/${sessionId}`),

  markAttendance: (sessionId: string, records: any[]) =>
    request<{ success: boolean; count: number; records: AttendanceRecord[] }>('/attendance/mark', {
      method: 'POST',
      body: JSON.stringify({ sessionId, records }),
    }),

  correctAttendance: (id: string, data: { status: string; remarks?: string; correctionReason: string }) =>
    request<{ record: AttendanceRecord }>(`/attendance/${id}/correct`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteAttendance: (id: string) =>
    request<{ success: boolean; message: string }>(`/attendance/${id}`, {
      method: 'DELETE',
    }),

  resetSessionAttendance: (sessionId: string) =>
    request<{ success: boolean; resetCount: number }>(`/attendance/session/${sessionId}`, {
      method: 'DELETE',
    }),

  getCandidateAttendance: () =>
    request<{
      metrics: {
        attendanceRate: number;
        totalSessions: number;
        presentCount: number;
        lateCount: number;
        excusedCount: number;
        absentCount: number;
        qualifyingAttended: number;
        eligibleSessions: number;
      };
      records: AttendanceRecord[];
    }>('/candidate/attendance'),

  // Resources
  getResources: (params?: { courseId?: string; batchId?: string; category?: string; status?: string }) =>
    request<{ resources: ResourceItem[] }>(`/resources${toQueryString(params)}`),

  createResource: (data: Partial<ResourceItem>) =>
    request<{ resource: ResourceItem }>('/resources', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateResource: (id: string, data: Partial<ResourceItem>) =>
    request<{ resource: ResourceItem }>(`/resources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteResource: (id: string, soft?: boolean) =>
    request<{ success: boolean; message: string }>(`/resources/${id}${soft ? '?soft=true' : ''}`, {
      method: 'DELETE',
    }),

  getCandidateResources: () =>
    request<{ resources: ResourceItem[] }>('/candidate/resources'),

  // Notifications
  getNotifications: () =>
    request<{ notifications: AppNotification[] }>('/notifications'),

  postAnnouncement: (data: { title: string; message: string; targetAudience: string; courseId?: string; batchId?: string; sendEmail?: boolean }) =>
    request<{ notification: AppNotification; recipientCount: number }>('/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteNotification: (id: string) =>
    request<{ success: boolean; message: string }>(`/notifications/${id}`, {
      method: 'DELETE',
    }),

  getCandidateNotifications: () =>
    request<{ notifications: AppNotification[] }>('/candidate/notifications'),

  markCandidateNotificationRead: (id: string) =>
    request<{ success: boolean }>(`/candidate/notifications/${id}/read`, {
      method: 'PUT',
    }),

  markAllCandidateNotificationsRead: () =>
    request<{ success: boolean }>('/candidate/notifications/read-all', {
      method: 'PUT',
    }),

  // Reports
  getReportsSummary: () =>
    request<{
      candidates: { total: number; active: number; pending: number };
      academics: { courses: number; activeBatches: number; activeTutors: number };
      meetings: { today: number; upcoming: number; cancelled: number; completed: number };
      attendance: { totalRecords: number; presentRate: number };
      recentAudit: AuditLog[];
    }>('/reports/summary'),

  // Audit Logs & Email Logs
  getAuditLogs: () =>
    request<{ logs: AuditLog[] }>('/audit-logs'),

  getEmailLogs: (params?: { status?: string; search?: string }) =>
    request<{ logs: EmailLog[] }>(`/email-logs${toQueryString(params)}`),

  getEmailLogById: (id: string) =>
    request<{ log: EmailLog }>(`/email-logs/${id}`),

  createEmailLog: (data: Partial<EmailLog>) =>
    request<{ success: boolean; log: EmailLog }>('/email-logs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateEmailLog: (id: string, data: Partial<EmailLog>) =>
    request<{ success: boolean; log: EmailLog }>(`/email-logs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  retryEmail: (id: string) =>
    request<{ success: boolean; log: EmailLog }>(`/email-logs/${id}/retry`, {
      method: 'POST',
    }),

  deleteEmailLog: (id: string) =>
    request<{ success: boolean; message: string }>(`/email-logs/${id}`, {
      method: 'DELETE',
    }),

  clearEmailLogs: () =>
    request<{ success: boolean; message: string }>('/email-logs', {
      method: 'DELETE',
    }),

  // Settings
  getSettings: () =>
    request<{ settings: SystemSettings }>('/settings'),

  updateSettings: (data: Partial<SystemSettings>) =>
    request<{ settings: SystemSettings }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Supabase Cloud Database
  getSupabaseStatus: () =>
    request<{
      connected: boolean;
      url: string;
      hasKey: boolean;
      keyPreview: string;
      lastSyncedAt: string | null;
    }>('/supabase/status'),

  configureSupabase: (url: string, key: string) =>
    request<{ success: boolean; message: string; lastSyncedAt: string }>('/supabase/config', {
      method: 'POST',
      body: JSON.stringify({ url, key }),
    }),

  syncSupabase: (direction: 'push' | 'pull') =>
    request<{ success: boolean; message: string }>('/supabase/sync', {
      method: 'POST',
      body: JSON.stringify({ direction }),
    }),

  // Leave Management (Admin & Common)
  getLeaveTypes: () =>
    request<{ leaveTypes: LeaveType[] }>('/leave/types'),

  createLeaveType: (data: Partial<LeaveType>) =>
    request<{ leaveType: LeaveType }>('/leave/types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateLeaveType: (id: string, data: Partial<LeaveType>) =>
    request<{ leaveType: LeaveType }>(`/leave/types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteLeaveType: (id: string) =>
    request<{ success: boolean; message: string }>(`/leave/types/${id}`, {
      method: 'DELETE',
    }),

  getLeavePolicy: () =>
    request<{ policy: LeavePolicy }>('/leave/policy'),

  updateLeavePolicy: (data: Partial<LeavePolicy>) =>
    request<{ policy: LeavePolicy }>('/leave/policy', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getLeaveApplications: (params?: {
    candidateId?: string;
    courseId?: string;
    batchId?: string;
    leaveTypeId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) =>
    request<{
      applications: LeaveApplication[];
      summary: {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        cancelled: number;
        totalApprovedDays: number;
      };
    }>(`/leave/applications${toQueryString(params)}`),

  getLeaveApplicationById: (id: string) =>
    request<{ application: LeaveApplication }>(`/leave/applications/${id}`),

  approveLeave: (id: string, remarks?: string) =>
    request<{ application: LeaveApplication }>(`/leave/applications/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ remarks }),
    }),

  rejectLeave: (id: string, rejectionReason: string, remarks?: string) =>
    request<{ application: LeaveApplication }>(`/leave/applications/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ rejectionReason, remarks }),
    }),

  revokeLeave: (id: string, revokeReason: string, remarks?: string) =>
    request<{ application: LeaveApplication }>(`/leave/applications/${id}/revoke`, {
      method: 'PUT',
      body: JSON.stringify({ revokeReason, remarks }),
    }),

  updateLeaveRemarks: (id: string, remarks: string) =>
    request<{ application: LeaveApplication }>(`/leave/applications/${id}/remarks`, {
      method: 'PUT',
      body: JSON.stringify({ remarks }),
    }),

  getLeaveReports: () =>
    request<{
      reports: {
        totalApplications: number;
        totalApprovedDays: number;
        byStatus: { pending: number; approved: number; rejected: number; cancelled: number };
        byType: { name: string; count: number; approvedDays: number; color: string }[];
        byBatch: { batchName: string; courseName: string; totalApps: number; approvedDays: number }[];
        topCandidates: { candidateName: string; candidateCustomId: string; totalDays: number; appCount: number }[];
      };
    }>('/leave/reports'),

  // Leave Management (Candidate)
  getCandidateLeave: () =>
    request<{
      applications: LeaveApplication[];
      summary: {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        cancelled: number;
        totalApprovedDays: number;
      };
    }>('/candidate/leave'),

  applyCandidateLeave: (data: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason: string;
    attachments?: Array<{ fileName: string; fileSize: number; mimeType: string; dataUrl: string }>;
  }) =>
    request<{ application: LeaveApplication }>('/candidate/leave', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancelCandidateLeave: (id: string, cancelReason?: string) =>
    request<{ application: LeaveApplication }>(`/candidate/leave/${id}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ cancelReason }),
    }),

  // Leave Management (Tutor)
  getTutorLeave: () =>
    request<{
      applications: LeaveApplication[];
      summary: {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        cancelled: number;
        totalApprovedDays: number;
      };
    }>('/tutor/leave'),

  applyTutorLeave: (data: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason: string;
    attachments?: Array<{ fileName: string; fileSize: number; mimeType: string; dataUrl: string }>;
  }) =>
    request<{ application: LeaveApplication }>('/tutor/leave', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancelTutorLeave: (id: string, cancelReason?: string) =>
    request<{ application: LeaveApplication }>(`/tutor/leave/${id}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ cancelReason }),
    }),

  // Tutor Portal
  getTutorDashboard: () =>
    request<{
      tutor: Tutor;
      stats: {
        assignedBatchesCount: number;
        totalCandidates: number;
        upcomingMeetingsCount: number;
        completedMeetingsCount: number;
        pendingAttendanceCount: number;
        totalResourcesCount: number;
      };
      nextSession: MeetingSession | null;
      recentMeetings: MeetingSession[];
      assignedBatches: (Batch & { candidateCount: number; courseName: string })[];
      unmarkedSessions: MeetingSession[];
      notifications: AppNotification[];
    }>('/tutor/dashboard'),

  getTutorBatches: () =>
    request<{
      batches: (Batch & {
        candidateCount: number;
        courseName: string;
      })[];
    }>('/tutor/batches'),

  getTutorBatchById: (id: string) =>
    request<{
      batch: Batch;
      course: Course | null;
      roster: CandidateUser[];
      upcomingMeetings: MeetingSession[];
      completedMeetings: MeetingSession[];
      resources: ResourceItem[];
    }>(`/tutor/batches/${id}`),

  getTutorMeetings: (params?: { batchId?: string; status?: string; date?: string }) =>
    request<{ meetings: MeetingSession[] }>(`/tutor/meetings${toQueryString(params)}`),

  setTutorMeetingAccess: (id: string, accessStatus: 'enabled' | 'disabled') =>
    request<{ session: MeetingSession }>(`/tutor/meetings/${id}/access`, {
      method: 'PUT',
      body: JSON.stringify({ accessStatus }),
    }),

  getTutorSessionAttendance: (sessionId: string) =>
    request<{
      session: MeetingSession;
      batch: Batch | null;
      course: Course | null;
      attendance: AttendanceRecord[];
      summary: {
        total: number;
        present: number;
        absent: number;
        late: number;
        excused: number;
        unmarked: number;
      };
      canEditAttendance: boolean;
      canRecordAttendance: boolean;
      isWindowExpired: boolean;
      windowHours: number;
    }>(`/tutor/attendance/session/${sessionId}`),

  markTutorAttendance: (
    sessionId: string,
    records: Array<{ candidateId: string; status: 'present' | 'absent' | 'late' | 'excused'; remarks?: string }>
  ) =>
    request<{ success: boolean; markedCount: number; records: AttendanceRecord[] }>('/tutor/attendance/mark', {
      method: 'POST',
      body: JSON.stringify({ sessionId, records }),
    }),

  correctTutorAttendance: (
    id: string,
    data: { status: 'present' | 'absent' | 'late' | 'excused'; remarks?: string; correctionReason: string }
  ) =>
    request<{ success: boolean; record: AttendanceRecord }>(`/tutor/attendance/${id}/correct`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getTutorResources: (params?: { category?: string; batchId?: string }) =>
    request<{ resources: ResourceItem[] }>(`/tutor/resources${toQueryString(params)}`),

  createTutorResource: (data: {
    title: string;
    description?: string;
    type: 'pdf' | 'link' | 'video' | 'zip' | 'doc';
    url: string;
    category: string;
    courseId?: string;
    batchId?: string;
    isRequired?: boolean;
    tags?: string[];
  }) =>
    request<{ resource: ResourceItem }>('/tutor/resources', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteTutorResource: (id: string) =>
    request<{ success: boolean; message: string }>(`/tutor/resources/${id}`, {
      method: 'DELETE',
    }),

  getTutorNotifications: () =>
    request<{ notifications: AppNotification[] }>('/tutor/notifications'),

  markTutorNotificationRead: (id: string) =>
    request<{ notification: AppNotification }>(`/tutor/notifications/${id}/read`, {
      method: 'PUT',
    }),

  markAllTutorNotificationsRead: () =>
    request<{ success: boolean }>('/tutor/notifications/read-all', {
      method: 'PUT',
    }),

  getTutorProfile: () =>
    request<{ tutor: Tutor }>('/tutor/profile'),

  updateTutorProfile: (data: Partial<Tutor>) =>
    request<{ tutor: Tutor }>('/tutor/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
