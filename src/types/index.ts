export type UserRole = 'admin' | 'candidate';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin';
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

export type AuthUser = AdminUser | CandidateUser;

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
  status: 'active' | 'inactive';
  assignedCourseIds: string[];
  assignedCourseNames?: string[];
  notes?: string;
  createdAt: string;
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
}

export type NotificationType = 'announcement' | 'meeting' | 'attendance' | 'resource' | 'system';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  targetAudience: 'all' | 'course' | 'batch' | 'candidate';
  courseId?: string;
  batchId?: string;
  candidateId?: string;
  relatedEntity?: {
    type: 'meeting' | 'resource' | 'attendance';
    id: string;
  };
  createdAt: string;
  read?: boolean; // personalized for candidate
}

export interface EmailLog {
  id: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  template: 'activation' | 'meeting_scheduled' | 'meeting_rescheduled' | 'meeting_cancelled' | 'meeting_reminder' | 'batch_transfer' | 'resource_published' | 'password_reset' | 'announcement';
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
