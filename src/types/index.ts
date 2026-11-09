export type UserRole = 'admin' | 'candidate' | 'tutor';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin';
}

export interface TutorPermissions {
  canViewAssignedBatches: boolean;
  canViewAssignedCandidates: boolean;
  canViewAssignedMeetings: boolean;
  canViewMeetingLinks: boolean;
  canManageMeetingAccess: boolean;
  canRecordAttendance: boolean;
  canEditAttendance: boolean;
  canViewResources: boolean;
  canUploadResources: boolean;
  canManageOwnResources: boolean;
  attendanceEditWindowHours: number; // e.g. 48 hours within which attendance can be recorded/edited
}

export interface TutorUser {
  id: string;
  tutorId: string; // e.g. "TUT-101"
  name: string;
  email: string;
  phone: string;
  specialization: string;
  designation?: string;
  avatarUrl?: string;
  status: 'active' | 'inactive';
  assignedCourseIds: string[];
  assignedCourseNames?: string[];
  assignedBatchIds?: string[];
  assignedBatchNames?: string[];
  permissions: TutorPermissions;
  mustChangePassword?: boolean;
  notes?: string;
  createdAt: string;
  role: 'tutor';
}

export type CandidateStatus = 'active' | 'pending_activation' | 'inactive' | 'archived';

export interface CandidateUser {
  id: string;
  candidateId: string; // e.g. "KDL-2026-001"
  name: string;
  email: string;
  phone?: string;
  courseId: string;
  courseName?: string;
  currentBatchId: string;
  batchName?: string;
  enrollmentDate: string;
  status: CandidateStatus;
  mustChangePassword?: boolean;
  remarks?: string;
  role: 'candidate';
}

export type AuthUser = AdminUser | CandidateUser | TutorUser;

export interface Course {
  id: string;
  code: string; // e.g. "FSWD-101"
  name: string;
  description: string;
  duration: string; // e.g. "16 Weeks"
  status: 'active' | 'archived';
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export interface Batch {
  id: string;
  code: string; // e.g. "B-2026-01"
  name: string;
  courseId: string;
  courseName?: string;
  tutorId?: string;
  timing?: string;
  capacity: number;
  candidateCount?: number;
  status: 'active' | 'upcoming' | 'completed' | 'archived';
  startDate: string;
  endDate: string;
  notes?: string;
  createdAt: string;
}

export interface CandidateBatchAssignment {
  id: string;
  candidateId: string;
  batchId: string;
  batchName?: string;
  courseId: string;
  courseName?: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'transferred' | 'completed' | 'withdrawn';
  transferReason?: string;
  createdAt: string;
}

export interface Tutor {
  id: string;
  tutorId: string; // e.g. "TUT-101"
  name: string;
  email: string;
  phone: string;
  specialization: string;
  designation?: string;
  avatarUrl?: string;
  status: 'active' | 'inactive';
  assignedCourseIds: string[];
  assignedCourseNames?: string[];
  assignedBatchIds?: string[];
  assignedBatchNames?: string[];
  permissions?: TutorPermissions;
  mustChangePassword?: boolean;
  notes?: string;
  createdAt: string;
  role?: 'tutor';
}

export type MeetingRecurrence = 'none' | 'daily' | 'weekly' | 'custom_weekdays' | 'monthly';
export type MeetingStatus = 'scheduled' | 'cancelled' | 'completed';
export type MeetingAccessStatus = 'disabled' | 'enabled';

export interface MeetingSession {
  id: string;
  seriesId?: string;
  title: string;
  courseId: string;
  courseName?: string;
  batchId: string;
  batchName?: string;
  tutorId: string;
  tutorName?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  timezone: string;
  meetingPlatform: string;
  meetingUrl?: string; // Omited or hidden for candidates if accessStatus is 'disabled'
  meetingLink?: string; // Convenience alias for meetingUrl
  durationMinutes?: number;
  status: MeetingStatus;
  accessStatus: MeetingAccessStatus;
  description?: string;
  cancelReason?: string;
  rescheduleReason?: string;
  createdAt: string;
  accessEnabledAt?: string;
  isRecurring?: boolean;
}

export interface MeetingSeries {
  id: string;
  title: string;
  courseId: string;
  batchId: string;
  tutorId: string;
  recurrenceRule: MeetingRecurrence;
  daysOfWeek?: number[];
  startTime: string;
  endTime: string;
  meetingPlatform: string;
  defaultMeetingUrl: string;
  startDate: string;
  endDate: string;
  description?: string;
  createdAt: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  sessionTitle?: string;
  sessionDate?: string;
  candidateId: string;
  candidateName?: string;
  candidateCustomId?: string;
  status: AttendanceStatus;
  remarks?: string;
  markedAt: string;
  markedBy: string;
  correctionReason?: string;
  updatedAt?: string;
}

export type ResourceCategory = 'Syllabus' | 'Lecture Notes' | 'Code Samples' | 'Assignment' | 'Cheat Sheet' | 'Reference' | 'Exam Preparation';
export type ResourceAudience = 'all' | 'course' | 'batch';
export type ResourceStatus = 'published' | 'draft' | 'archived';

export interface ResourceItem {
  id: string;
  title: string;
  description: string;
  category: ResourceCategory;
  type: 'file' | 'link';
  url: string;
  fileName?: string;
  fileSize?: string;
  mimeType?: string;
  courseId?: string;
  courseName?: string;
  batchId?: string;
  batchName?: string;
  audience: ResourceAudience;
  status: ResourceStatus;
  uploadedBy: string;
  createdAt: string;
  dateAdded?: string;
  tags?: string[];
  isRequired?: boolean;
}

export type NotificationType = 'announcement' | 'meeting' | 'attendance' | 'resource' | 'system' | 'leave';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  targetAudience: 'all' | 'course' | 'batch' | 'candidate' | 'tutor';
  courseId?: string;
  batchId?: string;
  candidateId?: string;
  tutorId?: string;
  relatedEntity?: {
    type: 'meeting' | 'resource' | 'attendance' | 'leave';
    id: string;
  };
  createdAt: string;
  read?: boolean; // personalized for candidate or tutor
  isRead?: boolean; // alias for read
}

export interface EmailLog {
  id: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  template:
    | 'activation'
    | 'meeting_scheduled'
    | 'meeting_rescheduled'
    | 'meeting_cancelled'
    | 'meeting_reminder'
    | 'batch_transfer'
    | 'resource_published'
    | 'password_reset'
    | 'announcement'
    | 'leave_submitted'
    | 'leave_approved'
    | 'leave_rejected'
    | 'leave_cancelled'
    | 'leave_revoked'
    | 'tutor_welcome'
    | 'tutor_password_reset'
    | 'tutor_assignment';
  deliveryStatus: 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced';
  failureReason?: string;
  sentAt: string;
  deliveredAt?: string;
}

export interface AuditLog {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  timestamp: string;
}

export interface SystemSettings {
  companyName: string;
  companyTimezone: string;
  lateCountsAsAttended: boolean;
  excludeExcusedFromDenominator: boolean;
  emailNotificationsEnabled: boolean;
  autoEmailReminders: boolean;
  defaultReminderOffsets: number[]; // in minutes
  maxFileUploadSizeMb: number;
}

// ==========================================
// LEAVE MANAGEMENT TYPES & MODELS
// ==========================================

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveStatusHistory {
  id: string;
  status: LeaveStatus;
  changedBy: string; // Actor email or name
  changedByRole: 'admin' | 'candidate' | 'tutor';
  reason?: string;
  remarks?: string;
  timestamp: string;
}

export interface LeaveAttachment {
  id: string;
  fileName: string;
  fileSize: number; // In bytes
  mimeType: string;
  dataUrl?: string; // Base64 data URL for document preview and download
  uploadedAt: string;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  requiresDocument?: boolean;
  maxDaysPerYear?: number;
  color?: string; // e.g. 'rose', 'blue', 'amber', 'emerald', 'purple', 'slate'
  createdAt: string;
}

export interface LeavePolicy {
  calculationMode: 'calendar_days' | 'working_days'; // Working days exclude Saturdays and Sundays
  allowRetrospective: boolean; // Whether start date can be before today
  maxConsecutiveDays: number;
  requireAttachmentAboveDays: number;
}

export interface LeaveApplication {
  id: string;
  applicationNumber: string; // e.g. "LV-2026-0001"
  applicantRole?: 'candidate' | 'tutor';
  candidateId: string; // Candidate or Tutor record ID
  candidateCustomId: string; // e.g. "KDL-2026-001" or "TUT-101"
  candidateName: string;
  candidateEmail: string;
  tutorId?: string;
  tutorCustomId?: string;
  courseId: string;
  courseName: string;
  batchId: string;
  batchName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  adminRemarks?: string;
  rejectionReason?: string;
  attachments: LeaveAttachment[];
  history: LeaveStatusHistory[];
  appliedAt: string;
  updatedAt: string;
}
