import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  fetchFromSupabase,
  saveToSupabase,
  isSupabaseConnected,
  getSupabaseUpdatedAt,
} from './supabase.ts';
import type {
  AdminUser,
  CandidateUser,
  Course,
  Batch,
  Tutor,
  CandidateBatchAssignment,
  MeetingSeries,
  MeetingSession,
  AttendanceRecord,
  ResourceItem,
  AppNotification,
  EmailLog,
  AuditLog,
  SystemSettings,
} from '../src/types/index.ts';

export interface DatabaseSchema {
  admin: AdminUser & { passwordHash: string; salt: string };
  candidates: (CandidateUser & { passwordHash: string; salt: string; tempPassword?: string })[];
  courses: Course[];
  batches: Batch[];
  tutors: Tutor[];
  candidateBatchAssignments: CandidateBatchAssignment[];
  meetingSeries: MeetingSeries[];
  meetingSessions: MeetingSession[];
  attendance: AttendanceRecord[];
  resources: ResourceItem[];
  notifications: AppNotification[];
  emailLogs: EmailLog[];
  auditLogs: AuditLog[];
  settings: SystemSettings;
}

const IS_VERCEL = !!process.env.VERCEL;
const BUNDLED_DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_DIR = IS_VERCEL ? path.resolve('/tmp', 'kodewar-data') : BUNDLED_DATA_DIR;
const DB_FILE = path.resolve(DATA_DIR, 'database.json');
const DB_BACKUP_FILE = path.resolve(DATA_DIR, 'database.backup.json');

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

export function createInitialSeed(): DatabaseSchema {
  const adminSalt = crypto.randomBytes(16).toString('hex');
  const adminHash = hashPassword('admin123', adminSalt);

  const courses: Course[] = [];
  const batches: Batch[] = [];
  const tutors: Tutor[] = [];
  const candidates: any[] = [];
  const candidateBatchAssignments: CandidateBatchAssignment[] = [];
  const meetingSessions: MeetingSession[] = [];
  const attendance: AttendanceRecord[] = [];
  const resources: ResourceItem[] = [];
  const notifications: AppNotification[] = [];
  const emailLogs: EmailLog[] = [];
  const auditLogs: AuditLog[] = [];

  const settings: SystemSettings = {
    companyName: 'Kodewar LMS',
    companyTimezone: 'Asia/Kolkata',
    lateCountsAsAttended: true,
    excludeExcusedFromDenominator: true,
    emailNotificationsEnabled: true,
    autoEmailReminders: true,
    defaultReminderOffsets: [15, 60],
    maxFileUploadSizeMb: 25,
  };

  return {
    admin: {
      id: 'admin-1',
      email: 'admin@kodewar.com',
      name: 'Super Admin',
      role: 'admin',
      passwordHash: adminHash,
      salt: adminSalt,
    },
    candidates,
    courses,
    batches,
    tutors,
    candidateBatchAssignments,
    meetingSeries: [],
    meetingSessions,
    attendance,
    resources,
    notifications,
    emailLogs,
    auditLogs,
    settings,
  };
}

class DatabaseManager {
  private db: DatabaseSchema | null = null;
  private isModified = false;
  private lastSyncedUpdatedAt: string | null = null;
  private inFlightSync: Promise<void> | null = null;

  constructor() {
    this.ensureLoaded();
    // In Vercel production, connect Supabase as primary cloud storage system!
    if (IS_VERCEL) {
      this.initSupabaseSync().catch((err) => {
        console.warn('[Supabase Sync Warn]:', err);
      });
    }
  }

  public isDirty(): boolean {
    return this.isModified;
  }

  public async ensureSupabaseLoaded(force = false): Promise<void> {
    if (!isSupabaseConnected()) return;

    // Deduplicate concurrent in-flight requests (so 6 parallel requests share 1 Supabase call)
    if (this.inFlightSync) {
      return this.inFlightSync;
    }

    this.inFlightSync = (async () => {
      try {
        // Fast lightweight check: only check updated_at timestamp in Supabase (~30ms)
        const remoteUpdatedAt = await getSupabaseUpdatedAt(1500);

        // If local database is loaded and updated_at has NOT changed in Supabase, we are 100% up to date!
        if (!force && this.db && remoteUpdatedAt && remoteUpdatedAt === this.lastSyncedUpdatedAt) {
          return;
        }

        // Fresh state needed (either cold start or remote updated by another lambda instance)
        const remoteData = await fetchFromSupabase(3500);
        if (remoteData && typeof remoteData === 'object' && remoteData.admin) {
          this.db = remoteData;
          this.normalizeDb();
          this.lastSyncedUpdatedAt = remoteUpdatedAt || new Date().toISOString();
          this.isModified = false;
        }
      } catch (err) {
        console.warn('[Supabase Sync Warn]:', err);
      } finally {
        this.inFlightSync = null;
      }
    })();

    return this.inFlightSync;
  }

  public async flushToSupabase(): Promise<boolean> {
    if (!this.db || !isSupabaseConnected()) return false;
    try {
      this.reconcileIntegrity();
      const now = new Date().toISOString();
      const ok = await saveToSupabase(this.db);
      if (ok) {
        this.isModified = false;
        this.lastSyncedUpdatedAt = now;
      }
      return ok;
    } catch (e) {
      console.error('[Supabase Flush Error]:', e);
      return false;
    }
  }

  public async initSupabaseSync(): Promise<void> {
    if (!isSupabaseConnected()) return;
    try {
      const remoteData = await fetchFromSupabase();
      if (remoteData && typeof remoteData === 'object' && remoteData.admin) {
        this.db = remoteData;
        this.normalizeDb();
        const content = JSON.stringify(this.db, null, 2);
        fs.writeFileSync(DB_FILE, content, 'utf-8');
        console.log('[Supabase] Initialized state from remote Supabase database.');
      } else if (this.db) {
        // If remote is empty, push our local data to Supabase
        await saveToSupabase(this.db);
        console.log('[Supabase] Populated initial remote Supabase database from local state.');
      }
    } catch (err) {
      console.error('[Supabase Init Error]:', err);
    }
  }

  private ensureLoaded(): DatabaseSchema {
    if (this.db) return this.db;

    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        console.error('Failed to create DATA_DIR:', err);
      }
    }

    // On Vercel, copy initial database from repository if not yet in /tmp
    if (IS_VERCEL && !fs.existsSync(DB_FILE)) {
      const bundledDb = path.resolve(BUNDLED_DATA_DIR, 'database.json');
      if (fs.existsSync(bundledDb)) {
        try {
          fs.copyFileSync(bundledDb, DB_FILE);
        } catch (e) {
          console.warn('Could not copy bundled database to /tmp:', e);
        }
      }
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        if (raw.trim().length > 0) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            this.db = parsed as DatabaseSchema;
            this.normalizeDb();
            try {
              fs.writeFileSync(DB_BACKUP_FILE, raw, 'utf-8');
            } catch {}
            return this.db!;
          }
        }
      } catch (err) {
        console.error('Failed reading database.json, attempting recovery from backup:', err);
      }
    }

    // Attempt recovery from backup if primary failed or was empty
    if (fs.existsSync(DB_BACKUP_FILE)) {
      try {
        const backupRaw = fs.readFileSync(DB_BACKUP_FILE, 'utf-8');
        if (backupRaw.trim().length > 0) {
          const parsed = JSON.parse(backupRaw);
          if (parsed && typeof parsed === 'object') {
            console.warn('Successfully recovered database from database.backup.json');
            this.db = parsed as DatabaseSchema;
            this.normalizeDb();
            this.save();
            return this.db!;
          }
        }
      } catch (backupErr) {
        console.error('Failed reading database.backup.json:', backupErr);
      }
    }

    this.db = createInitialSeed();
    this.save();
    return this.db;
  }

  private normalizeDb(): void {
    if (!this.db) return;
    if (!Array.isArray(this.db.candidates)) this.db.candidates = [];
    if (!Array.isArray(this.db.courses)) this.db.courses = [];
    if (!Array.isArray(this.db.batches)) this.db.batches = [];
    if (!Array.isArray(this.db.tutors)) this.db.tutors = [];
    if (!Array.isArray(this.db.candidateBatchAssignments)) this.db.candidateBatchAssignments = [];
    if (!Array.isArray(this.db.meetingSeries)) this.db.meetingSeries = [];
    if (!Array.isArray(this.db.meetingSessions)) this.db.meetingSessions = [];
    if (!Array.isArray(this.db.attendance)) this.db.attendance = [];
    if (!Array.isArray(this.db.resources)) this.db.resources = [];
    if (!Array.isArray(this.db.notifications)) this.db.notifications = [];
    if (!Array.isArray(this.db.emailLogs)) this.db.emailLogs = [];
    if (!Array.isArray(this.db.auditLogs)) this.db.auditLogs = [];
    this.reconcileIntegrity();
  }

  public reconcileIntegrity(): void {
    if (!this.db) return;
    const candIds = new Set(this.db.candidates.map((c) => c.id));
    // Remove orphaned batch assignments
    this.db.candidateBatchAssignments = this.db.candidateBatchAssignments.filter(
      (a) => candIds.has(a.candidateId)
    );
    // Remove orphaned attendance
    this.db.attendance = this.db.attendance.filter((att) => candIds.has(att.candidateId));
    // Recompute batch counts accurately
    for (const b of this.db.batches) {
      b.candidateCount = this.db.candidates.filter(
        (c) => c.currentBatchId === b.id && c.status !== 'archived'
      ).length;
    }
  }

  public reload(): DatabaseSchema {
    this.db = null;
    return this.ensureLoaded();
  }

  public get(): DatabaseSchema {
    return this.ensureLoaded();
  }

  public save(): void {
    if (!this.db) return;
    try {
      this.reconcileIntegrity();
      this.isModified = true;

      const content = JSON.stringify(this.db, null, 2);
      fs.writeFileSync(DB_FILE, content, 'utf-8');
      try {
        fs.writeFileSync(DB_BACKUP_FILE, content, 'utf-8');
      } catch {
        // Non-fatal backup write
      }
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }

  public async forcePullFromSupabase(): Promise<boolean> {
    const remoteData = await fetchFromSupabase();
    if (remoteData && typeof remoteData === 'object' && remoteData.admin) {
      this.db = remoteData;
      this.normalizeDb();
      const content = JSON.stringify(this.db, null, 2);
      fs.writeFileSync(DB_FILE, content, 'utf-8');
      return true;
    }
    return false;
  }

  public async forcePushToSupabase(): Promise<boolean> {
    if (!this.db) return false;
    return await saveToSupabase(this.db);
  }

  public logAudit(actorEmail: string, actorRole: string, action: string, entityType: string, entityId: string, summary: string): void {
    const db = this.get();
    const entry: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      actorEmail,
      actorRole,
      action,
      entityType,
      entityId,
      summary,
      timestamp: new Date().toISOString(),
    };
    db.auditLogs.unshift(entry);
    this.save();
  }

  public queueEmail(
    recipientEmail: string,
    recipientName: string,
    subject: string,
    template: EmailLog['template'],
    deliveryStatus: EmailLog['deliveryStatus'] = 'sent',
    failureReason?: string
  ): EmailLog {
    const db = this.get();
    const log: EmailLog = {
      id: `email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      recipientEmail,
      recipientName,
      subject,
      template,
      deliveryStatus,
      failureReason,
      sentAt: new Date().toISOString(),
      deliveredAt: deliveryStatus === 'delivered' || deliveryStatus === 'sent' ? new Date().toISOString() : undefined,
    };
    db.emailLogs.unshift(log);
    this.save();
    return log;
  }
}

export const dbManager = new DatabaseManager();
