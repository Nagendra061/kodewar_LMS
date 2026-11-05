import { Router } from 'express';
import type { Response } from 'express';
import crypto from 'crypto';
import { dbManager, hashPassword } from './db.ts';
import {
  getSupabaseConfig,
  isSupabaseConnected,
  configureSupabase,
  testSupabaseConnection,
  getLastSyncedAt,
} from './supabase.ts';
import type { AuthenticatedRequest } from './auth.ts';
import {
  generateToken,
  revokeToken,
  requireAuth,
  requireAdmin,
  requireCandidate,
} from './auth.ts';
import type {
  CandidateUser,
  MeetingSession,
  AttendanceRecord,
  ResourceItem,
  AppNotification,
  AttendanceStatus,
  CandidateBatchAssignment,
  Tutor,
  EmailLog,
} from '../src/types/index.ts';

export const apiRouter = Router();

// ==========================================
// 1. AUTHENTICATION & SESSION ROUTES
// ==========================================

apiRouter.post('/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    res.status(400).json({ error: 'Please provide both email/Candidate ID and password.' });
    return;
  }

  const db = dbManager.get();
  const normalizedId = String(identifier).trim().toLowerCase();

  // Check Super Admin
  if (db.admin.email.toLowerCase() === normalizedId) {
    const computedHash = hashPassword(password, db.admin.salt);
    if (computedHash === db.admin.passwordHash) {
      const token = generateToken(db.admin.id, 'admin');
      dbManager.logAudit(
        db.admin.email,
        'admin',
        'ADMIN_LOGIN',
        'auth',
        db.admin.id,
        'Super Admin logged in successfully.'
      );
      res.json({
        token,
        user: {
          id: db.admin.id,
          email: db.admin.email,
          name: db.admin.name,
          role: 'admin',
        },
      });
      return;
    }
  }

  // Check Candidates
  const cand = db.candidates.find(
    (c) =>
      c.email.toLowerCase() === normalizedId ||
      c.candidateId.toLowerCase() === normalizedId
  );

  if (cand) {
    const computedHash = hashPassword(password, cand.salt);
    if (computedHash === cand.passwordHash) {
      if (cand.status === 'archived' || cand.status === 'inactive') {
        res.status(403).json({ error: 'Your candidate account has been deactivated. Please contact administrator.' });
        return;
      }

      const token = generateToken(cand.id, 'candidate');
      const course = db.courses.find((cr) => cr.id === cand.courseId);
      const batch = db.batches.find((b) => b.id === cand.currentBatchId);

      dbManager.logAudit(
        cand.email,
        'candidate',
        'CANDIDATE_LOGIN',
        'candidate',
        cand.id,
        `Candidate ${cand.name} (${cand.candidateId}) logged in.`
      );

      res.json({
        token,
        user: {
          id: cand.id,
          candidateId: cand.candidateId,
          name: cand.name,
          email: cand.email,
          phone: cand.phone,
          courseId: cand.courseId,
          courseName: course?.name,
          currentBatchId: cand.currentBatchId,
          batchName: batch?.name,
          enrollmentDate: cand.enrollmentDate,
          status: cand.status,
          mustChangePassword: cand.mustChangePassword,
          remarks: cand.remarks,
          role: 'candidate',
        },
      });
      return;
    }
  }

  res.status(401).json({ error: 'Invalid email/Candidate ID or password.' });
});

apiRouter.post('/auth/register', (req, res) => {
  const { name, email, phone, courseId, password } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: 'Full name and email are required for registration.' });
    return;
  }

  const db = dbManager.get();
  const normalizedEmail = String(email).trim().toLowerCase();

  if (db.candidates.some((c) => c.email.toLowerCase() === normalizedEmail)) {
    res.status(400).json({ error: 'A candidate with this email address already exists.' });
    return;
  }

  const chosenCourse = courseId
    ? db.courses.find((cr) => cr.id === courseId)
    : (db.courses.length > 0 ? db.courses[0] : null);

  const year = new Date().getFullYear();
  const count = db.candidates.length + 1;
  const customId = `KDL-${year}-${String(count).padStart(3, '0')}`;

  const newId = `cand-${Date.now()}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const userPassword = password && password.trim().length >= 6
    ? password.trim()
    : `Pass@${Math.floor(1000 + Math.random() * 9000)}`;
  const passwordHash = hashPassword(userPassword, salt);

  const newCandidate = {
    id: newId,
    candidateId: customId,
    name: name.trim(),
    email: normalizedEmail,
    phone: phone?.trim() || '',
    courseId: chosenCourse ? chosenCourse.id : (db.courses[0]?.id || ''),
    currentBatchId: '',
    enrollmentDate: new Date().toISOString().split('T')[0],
    status: 'active' as const,
    mustChangePassword: false,
    role: 'candidate' as const,
    passwordHash,
    salt,
    remarks: 'Registered via online portal',
  };

  db.candidates.push(newCandidate);

  dbManager.queueEmail(
    newCandidate.email,
    newCandidate.name,
    'Welcome to Kodewar LMS - Registration Successful',
    'activation',
    'delivered'
  );

  dbManager.logAudit(
    newCandidate.email,
    'candidate',
    'CANDIDATE_SELF_REGISTERED',
    'candidate',
    newId,
    `Candidate ${newCandidate.name} (${customId}) registered online.`
  );

  dbManager.save();

  const token = generateToken(newId, 'candidate');
  res.status(201).json({
    success: true,
    token,
    user: {
      id: newCandidate.id,
      candidateId: newCandidate.candidateId,
      name: newCandidate.name,
      email: newCandidate.email,
      phone: newCandidate.phone,
      courseId: newCandidate.courseId,
      courseName: chosenCourse?.name || 'Unassigned',
      currentBatchId: '',
      batchName: 'Unassigned',
      enrollmentDate: newCandidate.enrollmentDate,
      status: 'active',
      mustChangePassword: false,
      role: 'candidate',
    },
    tempPassword: userPassword,
  });
});

apiRouter.post('/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    revokeToken(authHeader.split(' ')[1]);
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

apiRouter.post('/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    return;
  }

  const db = dbManager.get();
  if (req.user!.role === 'admin') {
    if (currentPassword) {
      const checkHash = hashPassword(currentPassword, db.admin.salt);
      if (checkHash !== db.admin.passwordHash) {
        res.status(400).json({ error: 'Current password is incorrect.' });
        return;
      }
    }
    const newSalt = crypto.randomBytes(16).toString('hex');
    db.admin.salt = newSalt;
    db.admin.passwordHash = hashPassword(newPassword, newSalt);
    dbManager.save();
    dbManager.logAudit(db.admin.email, 'admin', 'PASSWORD_CHANGED', 'admin', db.admin.id, 'Super Admin password updated.');
    res.json({ success: true, message: 'Password updated successfully.' });
    return;
  }

  const cand = db.candidates.find((c) => c.id === req.user!.id);
  if (!cand) {
    res.status(404).json({ error: 'Candidate record not found.' });
    return;
  }

  if (cand.status !== 'pending_activation' && !cand.mustChangePassword && currentPassword) {
    const checkHash = hashPassword(currentPassword, cand.salt);
    if (checkHash !== cand.passwordHash) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
  }

  const newSalt = crypto.randomBytes(16).toString('hex');
  cand.salt = newSalt;
  cand.passwordHash = hashPassword(newPassword, newSalt);
  cand.mustChangePassword = false;
  if (cand.status === 'pending_activation') {
    cand.status = 'active';
  }
  delete cand.tempPassword;

  dbManager.save();
  dbManager.logAudit(cand.email, 'candidate', 'PASSWORD_CHANGED', 'candidate', cand.id, `Candidate ${cand.candidateId} set permanent password.`);
  dbManager.queueEmail(cand.email, cand.name, 'Password Updated Successfully', 'password_reset', 'sent');

  res.json({
    success: true,
    message: 'Password updated successfully. Account is fully active.',
    user: {
      ...req.user,
      status: 'active',
      mustChangePassword: false,
    },
  });
});

// Quick Switcher endpoint for convenient evaluation of Admin and Candidate views
apiRouter.post('/auth/quick-switch', (req, res) => {
  const { role, candidateId } = req.body;
  const db = dbManager.get();

  if (role === 'admin') {
    const token = generateToken(db.admin.id, 'admin');
    res.json({
      token,
      user: {
        id: db.admin.id,
        email: db.admin.email,
        name: db.admin.name,
        role: 'admin',
      },
    });
    return;
  }

  let cand = candidateId
    ? db.candidates.find((c) => c.id === candidateId || c.candidateId === candidateId)
    : db.candidates[0];

  if (!cand) {
    res.status(404).json({ error: 'Candidate not found.' });
    return;
  }

  const token = generateToken(cand.id, 'candidate');
  const course = db.courses.find((cr) => cr.id === cand!.courseId);
  const batch = db.batches.find((b) => b.id === cand!.currentBatchId);

  res.json({
    token,
    user: {
      id: cand.id,
      candidateId: cand.candidateId,
      name: cand.name,
      email: cand.email,
      phone: cand.phone,
      courseId: cand.courseId,
      courseName: course?.name,
      currentBatchId: cand.currentBatchId,
      batchName: batch?.name,
      enrollmentDate: cand.enrollmentDate,
      status: cand.status,
      mustChangePassword: cand.mustChangePassword,
      remarks: cand.remarks,
      role: 'candidate',
    },
  });
});

// ==========================================
// 2. CANDIDATE MANAGEMENT (ADMIN ONLY)
// ==========================================

apiRouter.get('/candidates', requireAdmin, (req, res) => {
  const db = dbManager.get();
  const { courseId, batchId, status, search } = req.query;

  let list = db.candidates.map((c) => {
    const course = db.courses.find((cr) => cr.id === c.courseId);
    const batch = db.batches.find((b) => b.id === c.currentBatchId);
    return {
      id: c.id,
      candidateId: c.candidateId,
      name: c.name,
      email: c.email,
      phone: c.phone,
      courseId: c.courseId,
      courseName: course?.name || 'Unassigned',
      currentBatchId: c.currentBatchId,
      batchName: batch?.name || 'Unassigned',
      enrollmentDate: c.enrollmentDate,
      status: c.status,
      mustChangePassword: c.mustChangePassword,
      tempPassword: c.tempPassword,
      remarks: c.remarks,
      role: 'candidate',
    };
  });

  const isValidParam = (v: any) => v && v !== 'undefined' && v !== 'null' && v !== 'all' && String(v).trim().length > 0;

  if (isValidParam(courseId)) list = list.filter((c) => c.courseId === courseId);
  if (isValidParam(batchId)) list = list.filter((c) => c.currentBatchId === batchId);
  if (isValidParam(status)) list = list.filter((c) => c.status === status);
  if (isValidParam(search)) {
    const q = String(search).trim().toLowerCase();
    list = list.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.candidateId && c.candidateId.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.remarks && c.remarks.toLowerCase().includes(q))
    );
  }

  res.json({ candidates: list });
});

apiRouter.get('/candidates/:id', requireAdmin, (req, res) => {
  const db = dbManager.get();
  const cand = db.candidates.find((c) => c.id === req.params.id);
  if (!cand) {
    res.status(404).json({ error: 'Candidate not found.' });
    return;
  }

  const course = db.courses.find((cr) => cr.id === cand.courseId);
  const batch = db.batches.find((b) => b.id === cand.currentBatchId);
  const assignments = db.candidateBatchAssignments.filter((a) => a.candidateId === cand.id);
  const attendance = db.attendance.filter((att) => att.candidateId === cand.id);

  res.json({
    candidate: {
      ...cand,
      courseName: course?.name,
      batchName: batch?.name,
      passwordHash: undefined,
      salt: undefined,
    },
    assignments,
    attendance,
  });
});

apiRouter.post('/candidates', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { name, email, phone, courseId, batchId, enrollmentDate, status, remarks, candidateId } = req.body;

  if (!name || !email || !courseId || !batchId) {
    res.status(400).json({ error: 'Full name, email, course, and batch are required.' });
    return;
  }

  const db = dbManager.get();
  const normalizedEmail = String(email).trim().toLowerCase();

  // Validate email uniqueness
  if (db.candidates.some((c) => c.email.toLowerCase() === normalizedEmail)) {
    res.status(400).json({ error: 'A candidate with this email address already exists.' });
    return;
  }

  // Validate course and batch
  const course = db.courses.find((cr) => cr.id === courseId);
  if (!course) {
    res.status(400).json({ error: 'Selected course does not exist.' });
    return;
  }

  const batch = db.batches.find((b) => b.id === batchId && b.courseId === courseId);
  if (!batch) {
    res.status(400).json({ error: 'Selected batch does not belong to the selected course.' });
    return;
  }

  // Generate or validate Candidate ID
  let customId = candidateId?.trim();
  if (!customId) {
    const year = new Date().getFullYear();
    const count = db.candidates.length + 1;
    customId = `KDL-${year}-${String(count).padStart(3, '0')}`;
  } else if (db.candidates.some((c) => c.candidateId.toLowerCase() === customId.toLowerCase())) {
    res.status(400).json({ error: `Candidate ID "${customId}" is already in use.` });
    return;
  }

  const newId = `cand-${Date.now()}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const tempPassword = `Pass@${Math.floor(1000 + Math.random() * 9000)}`;
  const passwordHash = hashPassword(tempPassword, salt);
  const chosenStatus = status || 'pending_activation';

  const newCandidate = {
    id: newId,
    candidateId: customId,
    name: name.trim(),
    email: normalizedEmail,
    phone: phone?.trim() || '',
    courseId,
    currentBatchId: batchId,
    enrollmentDate: enrollmentDate || new Date().toISOString().split('T')[0],
    status: chosenStatus as any,
    mustChangePassword: true,
    role: 'candidate' as const,
    passwordHash,
    salt,
    tempPassword,
    remarks: remarks?.trim() || '',
  };

  db.candidates.push(newCandidate);

  // Add initial batch assignment
  const assignment: CandidateBatchAssignment = {
    id: `asg-${Date.now()}`,
    candidateId: newId,
    batchId,
    batchName: batch.name,
    courseId,
    courseName: course.name,
    startDate: newCandidate.enrollmentDate,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  db.candidateBatchAssignments.push(assignment);

  // Update batch candidate count
  batch.candidateCount = (batch.candidateCount || 0) + 1;

  // Queue activation email
  dbManager.queueEmail(
    newCandidate.email,
    newCandidate.name,
    'Welcome to Kodewar LMS - Activation Credentials',
    'activation',
    'delivered'
  );

  // Audit log
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'CANDIDATE_CREATED',
    'candidate',
    newId,
    `Candidate ${newCandidate.name} (${newCandidate.candidateId}) created in ${batch.name}.`
  );

  dbManager.save();

  res.status(201).json({
    candidate: {
      ...newCandidate,
      courseName: course.name,
      batchName: batch.name,
      passwordHash: undefined,
      salt: undefined,
    },
    tempPassword,
  });
});

apiRouter.put('/candidates/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const cand = db.candidates.find((c) => c.id === req.params.id);
  if (!cand) {
    res.status(404).json({ error: 'Candidate not found.' });
    return;
  }

  const { name, email, phone, status, remarks, candidateId, enrollmentDate, courseId, batchId } = req.body;

  if (email && email.trim().toLowerCase() !== cand.email.toLowerCase()) {
    const normEmail = email.trim().toLowerCase();
    if (db.candidates.some((c) => c.id !== cand.id && c.email.toLowerCase() === normEmail)) {
      res.status(400).json({ error: 'Another candidate already uses this email address.' });
      return;
    }
    cand.email = normEmail;
  }

  if (candidateId && candidateId.trim().toLowerCase() !== cand.candidateId.toLowerCase()) {
    const customId = candidateId.trim();
    if (db.candidates.some((c) => c.id !== cand.id && c.candidateId.toLowerCase() === customId.toLowerCase())) {
      res.status(400).json({ error: `Candidate ID "${customId}" is already assigned to another candidate.` });
      return;
    }
    cand.candidateId = customId;
  }

  if (name) cand.name = name.trim();
  if (phone !== undefined) cand.phone = phone.trim();
  if (status && ['active', 'pending_activation', 'inactive', 'archived'].includes(status)) {
    cand.status = status;
  }
  if (enrollmentDate) cand.enrollmentDate = enrollmentDate;
  if (remarks !== undefined) cand.remarks = remarks.trim();

  // If course or batch changed
  if (courseId && courseId !== cand.courseId) {
    const course = db.courses.find((cr) => cr.id === courseId);
    if (!course) {
      res.status(400).json({ error: 'Selected course not found.' });
      return;
    }
    cand.courseId = courseId;
  }

  if (batchId && batchId !== cand.currentBatchId) {
    const targetBatch = db.batches.find((b) => b.id === batchId);
    if (!targetBatch) {
      res.status(400).json({ error: 'Selected batch not found.' });
      return;
    }
    cand.currentBatchId = batchId;

    // Record or update assignment
    const course = db.courses.find((cr) => cr.id === cand.courseId);
    const existingActive = db.candidateBatchAssignments.find(
      (a) => a.candidateId === cand.id && a.status === 'active'
    );
    if (existingActive) {
      existingActive.status = 'transferred';
      existingActive.endDate = new Date().toISOString().split('T')[0];
    }
    db.candidateBatchAssignments.push({
      id: `asg-${Date.now()}`,
      candidateId: cand.id,
      batchId: targetBatch.id,
      batchName: targetBatch.name,
      courseId: cand.courseId,
      courseName: course?.name,
      startDate: new Date().toISOString().split('T')[0],
      status: 'active',
      createdAt: new Date().toISOString(),
    });
  }

  dbManager.save();
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'CANDIDATE_UPDATED',
    'candidate',
    cand.id,
    `Candidate ${cand.name} (${cand.candidateId}) details updated.`
  );

  const course = db.courses.find((cr) => cr.id === cand.courseId);
  const batch = db.batches.find((b) => b.id === cand.currentBatchId);

  res.json({
    candidate: {
      ...cand,
      courseName: course?.name || 'Unassigned',
      batchName: batch?.name || 'Unassigned',
      passwordHash: undefined,
      salt: undefined,
    },
  });
});

apiRouter.delete('/candidates/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const targetId = String(req.params.id).trim().toLowerCase();
  const index = db.candidates.findIndex(
    (c) => c.id === req.params.id || c.candidateId.toLowerCase() === targetId
  );
  if (index === -1) {
    res.status(404).json({ error: 'Candidate not found.' });
    return;
  }
  const cand = db.candidates[index];
  db.candidates.splice(index, 1);
  if (Array.isArray(db.candidateBatchAssignments)) {
    db.candidateBatchAssignments = db.candidateBatchAssignments.filter((a) => a.candidateId !== cand.id);
  }
  if (Array.isArray(db.attendance)) {
    db.attendance = db.attendance.filter((att) => att.candidateId !== cand.id);
  }
  dbManager.save();
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'CANDIDATE_DELETED',
    'candidate',
    cand.id,
    `Candidate ${cand.name} (${cand.candidateId}) deleted.`
  );
  // Ensure changes are explicitly flushed and confirmed in Supabase for Vercel production
  if (isSupabaseConnected()) {
    await dbManager.flushToSupabase();
  }
  res.json({ success: true, message: `Candidate ${cand.name} deleted successfully.` });
});

apiRouter.post('/candidates/:id/resend-activation', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const cand = db.candidates.find((c) => c.id === req.params.id);
  if (!cand) {
    res.status(404).json({ error: 'Candidate not found.' });
    return;
  }

  const tempPassword = `Pass@${Math.floor(1000 + Math.random() * 9000)}`;
  cand.tempPassword = tempPassword;
  cand.passwordHash = hashPassword(tempPassword, cand.salt);
  cand.mustChangePassword = true;

  dbManager.queueEmail(
    cand.email,
    cand.name,
    'Your Account Credentials - Kodewar LMS',
    'activation',
    'delivered'
  );

  dbManager.save();
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'ACTIVATION_RESENT',
    'candidate',
    cand.id,
    `Resent activation credentials to ${cand.email}.`
  );

  res.json({ success: true, message: 'Activation email queued.', tempPassword });
});

// CSV / Bulk import preview
apiRouter.post('/candidates/import/preview', requireAdmin, (req, res) => {
  const { rows, defaultCourseId, defaultBatchId } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'No candidate rows provided for import.' });
    return;
  }

  const db = dbManager.get();
  const validRows: any[] = [];
  const invalidRows: any[] = [];
  const duplicateRows: any[] = [];

  const existingEmails = new Set(db.candidates.map((c) => c.email.toLowerCase()));
  const existingCustomIds = new Set(db.candidates.map((c) => c.candidateId.toLowerCase()));
  const seenBatchEmails = new Set<string>();

  rows.forEach((row, index) => {
    const rowIndex = index + 1;
    const name = row.name?.trim();
    const email = row.email?.trim().toLowerCase();
    const phone = row.phone?.trim() || '';
    const customId = row.candidateId?.trim();
    const courseId = row.courseId || defaultCourseId;
    const batchId = row.batchId || defaultBatchId;

    if (!name || !email) {
      invalidRows.push({
        row: rowIndex,
        data: row,
        errors: ['Name and valid email are mandatory.'],
      });
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      invalidRows.push({
        row: rowIndex,
        data: row,
        errors: ['Invalid email format.'],
      });
      return;
    }

    if (existingEmails.has(email) || seenBatchEmails.has(email)) {
      duplicateRows.push({
        row: rowIndex,
        data: row,
        reason: 'Email is already registered.',
      });
      return;
    }

    if (customId && existingCustomIds.has(customId.toLowerCase())) {
      duplicateRows.push({
        row: rowIndex,
        data: row,
        reason: `Candidate ID ${customId} already exists.`,
      });
      return;
    }

    const course = db.courses.find((cr) => cr.id === courseId);
    const batch = db.batches.find((b) => b.id === batchId && b.courseId === courseId);

    if (!course || !batch) {
      invalidRows.push({
        row: rowIndex,
        data: row,
        errors: ['Specified course or batch is invalid or mismatched.'],
      });
      return;
    }

    seenBatchEmails.add(email);
    validRows.push({
      row: rowIndex,
      name,
      email,
      phone,
      candidateId: customId,
      courseId,
      courseName: course.name,
      batchId,
      batchName: batch.name,
      enrollmentDate: row.enrollmentDate || new Date().toISOString().split('T')[0],
      remarks: row.remarks || '',
    });
  });

  res.json({
    summary: {
      total: rows.length,
      valid: validRows.length,
      invalid: invalidRows.length,
      duplicate: duplicateRows.length,
    },
    validRows,
    invalidRows,
    duplicateRows,
  });
});

// CSV / Bulk import commit
apiRouter.post('/candidates/import/commit', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { validRows } = req.body;
  if (!Array.isArray(validRows) || validRows.length === 0) {
    res.status(400).json({ error: 'No valid rows to commit.' });
    return;
  }

  const db = dbManager.get();
  const createdCandidates: any[] = [];
  const year = new Date().getFullYear();

  validRows.forEach((row, i) => {
    let customId = row.candidateId;
    if (!customId) {
      const count = db.candidates.length + 1;
      customId = `KDL-${year}-${String(count).padStart(3, '0')}`;
    }

    const newId = `cand-${Date.now()}-${i}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const tempPassword = `Pass@${Math.floor(1000 + Math.random() * 9000)}`;
    const passwordHash = hashPassword(tempPassword, salt);

    const cand = {
      id: newId,
      candidateId: customId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      courseId: row.courseId,
      currentBatchId: row.batchId,
      enrollmentDate: row.enrollmentDate,
      status: 'pending_activation' as const,
      mustChangePassword: true,
      role: 'candidate' as const,
      passwordHash,
      salt,
      tempPassword,
      remarks: row.remarks,
    };

    db.candidates.push(cand);

    db.candidateBatchAssignments.push({
      id: `asg-${Date.now()}-${i}`,
      candidateId: newId,
      batchId: row.batchId,
      batchName: row.batchName,
      courseId: row.courseId,
      courseName: row.courseName,
      startDate: row.enrollmentDate,
      status: 'active',
      createdAt: new Date().toISOString(),
    });

    // Update batch counter
    const batch = db.batches.find((b) => b.id === row.batchId);
    if (batch) {
      batch.candidateCount = (batch.candidateCount || 0) + 1;
    }

    // Queue activation email
    dbManager.queueEmail(
      cand.email,
      cand.name,
      'Welcome to Kodewar LMS - Your Account Credentials',
      'activation',
      'delivered'
    );

    createdCandidates.push({
      id: newId,
      name: cand.name,
      email: cand.email,
      candidateId: customId,
      tempPassword,
    });
  });

  dbManager.save();
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'BULK_CANDIDATE_IMPORT',
    'candidate',
    'bulk',
    `Imported ${createdCandidates.length} candidates successfully.`
  );

  res.json({
    success: true,
    importedCount: createdCandidates.length,
    candidates: createdCandidates,
  });
});

// ==========================================
// 3. COURSE MANAGEMENT
// ==========================================

apiRouter.get('/courses', requireAuth, (req, res) => {
  const db = dbManager.get();
  const list = db.courses.map((crs) => {
    const batches = db.batches.filter((b) => b.courseId === crs.id && b.status !== 'archived');
    const candidates = db.candidates.filter((c) => c.courseId === crs.id && c.status !== 'archived');
    return {
      ...crs,
      batchCount: batches.length,
      candidateCount: candidates.length,
    };
  });
  res.json({ courses: list });
});

apiRouter.post('/courses', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { code, name, description, duration, startDate, endDate } = req.body;
  if (!code || !name) {
    res.status(400).json({ error: 'Course code and name are required.' });
    return;
  }

  const db = dbManager.get();
  const normalizedCode = code.trim().toUpperCase();

  if (db.courses.some((c) => c.code.toUpperCase() === normalizedCode)) {
    res.status(400).json({ error: `Course code "${normalizedCode}" already exists.` });
    return;
  }

  const course = {
    id: `crs-${Date.now()}`,
    code: normalizedCode,
    name: name.trim(),
    description: description?.trim() || '',
    duration: duration?.trim() || '12 Weeks',
    status: 'active' as const,
    startDate,
    endDate,
    createdAt: new Date().toISOString(),
  };

  db.courses.push(course);
  dbManager.save();
  dbManager.logAudit(req.user!.email, 'admin', 'COURSE_CREATED', 'course', course.id, `Course ${course.name} (${course.code}) created.`);
  res.status(201).json({ course });
});

apiRouter.put('/courses/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const course = db.courses.find((c) => c.id === req.params.id);
  if (!course) {
    res.status(404).json({ error: 'Course not found.' });
    return;
  }

  const { name, description, duration, status, startDate, endDate } = req.body;
  if (name) course.name = name.trim();
  if (description !== undefined) course.description = description.trim();
  if (duration) course.duration = duration.trim();
  if (status) course.status = status;
  if (startDate !== undefined) course.startDate = startDate;
  if (endDate !== undefined) course.endDate = endDate;

  dbManager.save();
  dbManager.logAudit(req.user!.email, 'admin', 'COURSE_UPDATED', 'course', course.id, `Course ${course.code} updated.`);
  res.json({ course });
});

apiRouter.delete('/courses/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const courseIndex = db.courses.findIndex((c) => c.id === req.params.id);
  if (courseIndex === -1) {
    res.status(404).json({ error: 'Course not found.' });
    return;
  }

  const course = db.courses[courseIndex];

  // Check if any candidates are actively enrolled
  const enrolledCandidates = db.candidates.filter(
    (c) => c.courseId === course.id && c.status !== 'archived'
  );
  if (enrolledCandidates.length > 0) {
    res.status(400).json({
      error: `Cannot delete course "${course.name}" (${course.code}) because ${enrolledCandidates.length} candidate(s) are actively enrolled. Please transfer or remove candidates before deleting this course.`,
      enrolledCount: enrolledCandidates.length,
    });
    return;
  }

  // Check associated batches
  const associatedBatches = db.batches.filter((b) => b.courseId === course.id);
  const cascade = req.query.cascade === 'true' || (req.body && req.body.cascade === true);
  if (associatedBatches.length > 0 && !cascade) {
    res.status(400).json({
      error: `Course "${course.name}" has ${associatedBatches.length} associated batch(es). Please confirm deleting this course and its associated empty batches.`,
      requiresCascade: true,
      batchCount: associatedBatches.length,
    });
    return;
  }

  const batchIds = associatedBatches.map((b) => b.id);

  // Clean up associated batches
  db.batches = db.batches.filter((b) => b.courseId !== course.id);

  // Clean up associated meetings
  db.meetingSessions = db.meetingSessions.filter(
    (m) => m.courseId !== course.id && !batchIds.includes(m.batchId)
  );

  // Clean up associated resources
  db.resources = db.resources.filter((r) => r.courseId !== course.id);

  // Remove from tutors assigned courses
  db.tutors.forEach((t) => {
    t.assignedCourseIds = t.assignedCourseIds.filter((cid) => cid !== course.id);
  });

  // Remove the course
  db.courses.splice(courseIndex, 1);
  dbManager.save();
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'COURSE_DELETED',
    'course',
    course.id,
    `Course ${course.name} (${course.code}) deleted by administrator.`
  );

  res.json({
    success: true,
    message: `Course "${course.name}" (${course.code}) was deleted successfully.`,
  });
});

// ==========================================
// 4. BATCH MANAGEMENT & CANDIDATE ALLOCATION
// ==========================================

apiRouter.get('/batches', requireAuth, (req, res) => {
  const db = dbManager.get();
  const { courseId } = req.query;

  let list = db.batches.map((b) => {
    const course = db.courses.find((c) => c.id === b.courseId);
    const candidates = db.candidates.filter((c) => c.currentBatchId === b.id && c.status !== 'archived');
    return {
      ...b,
      courseName: course?.name || 'Unassigned',
      candidateCount: candidates.length,
    };
  });

  if (courseId) {
    list = list.filter((b) => b.courseId === courseId);
  }

  res.json({ batches: list });
});

apiRouter.post('/batches', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { code, name, courseId, capacity, startDate, endDate, notes } = req.body;
  if (!code || !name || !courseId) {
    res.status(400).json({ error: 'Batch code, name, and associated course are required.' });
    return;
  }

  const db = dbManager.get();
  const course = db.courses.find((c) => c.id === courseId);
  if (!course) {
    res.status(400).json({ error: 'Associated course does not exist.' });
    return;
  }

  if (db.batches.some((b) => b.code.toUpperCase() === code.trim().toUpperCase())) {
    res.status(400).json({ error: `Batch code "${code}" already exists.` });
    return;
  }

  const batch = {
    id: `batch-${Date.now()}`,
    code: code.trim().toUpperCase(),
    name: name.trim(),
    courseId,
    courseName: course.name,
    capacity: Number(capacity) || 30,
    candidateCount: 0,
    status: 'active' as const,
    startDate: startDate || new Date().toISOString().split('T')[0],
    endDate: endDate || '',
    notes: notes?.trim() || '',
    createdAt: new Date().toISOString(),
  };

  db.batches.push(batch);
  dbManager.save();
  dbManager.logAudit(req.user!.email, 'admin', 'BATCH_CREATED', 'batch', batch.id, `Batch ${batch.name} (${batch.code}) created under ${course.name}.`);
  res.status(201).json({ batch });
});

apiRouter.get('/batches/:id', requireAuth, (req, res) => {
  const db = dbManager.get();
  const batch = db.batches.find((b) => b.id === req.params.id);
  if (!batch) {
    res.status(404).json({ error: 'Batch not found.' });
    return;
  }
  const course = db.courses.find((c) => c.id === batch.courseId);
  res.json({
    batch: {
      ...batch,
      courseName: course?.name || batch.courseName,
    },
  });
});

apiRouter.put('/batches/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const batch = db.batches.find((b) => b.id === req.params.id);
  if (!batch) {
    res.status(404).json({ error: 'Batch not found.' });
    return;
  }

  const { code, name, courseId, capacity, status, startDate, endDate, notes } = req.body;
  if (code && code.trim().toUpperCase() !== batch.code.toUpperCase()) {
    const normCode = code.trim().toUpperCase();
    if (db.batches.some((b) => b.id !== batch.id && b.code.toUpperCase() === normCode)) {
      res.status(400).json({ error: `Batch code "${normCode}" is already in use.` });
      return;
    }
    batch.code = normCode;
  }
  if (courseId && courseId !== batch.courseId) {
    const course = db.courses.find((c) => c.id === courseId);
    if (!course) {
      res.status(400).json({ error: 'Target course not found.' });
      return;
    }
    batch.courseId = courseId;
    batch.courseName = course.name;
  }
  if (name) batch.name = name.trim();
  if (capacity) batch.capacity = Number(capacity);
  if (status) batch.status = status;
  if (startDate) batch.startDate = startDate;
  if (endDate !== undefined) batch.endDate = endDate;
  if (notes !== undefined) batch.notes = notes.trim();

  dbManager.save();
  dbManager.logAudit(req.user!.email, 'admin', 'BATCH_UPDATED', 'batch', batch.id, `Batch ${batch.code} updated.`);
  res.json({ batch });
});

apiRouter.delete('/batches/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const batchIndex = db.batches.findIndex((b) => b.id === req.params.id);
  if (batchIndex === -1) {
    res.status(404).json({ error: 'Batch not found.' });
    return;
  }
  const batch = db.batches[batchIndex];

  // Check enrolled candidates
  const enrolledCandidates = db.candidates.filter(
    (c) => c.currentBatchId === batch.id && c.status !== 'archived'
  );

  const cascade = req.query.cascade === 'true' || (req.body && req.body.cascade === true);
  if (enrolledCandidates.length > 0 && !cascade) {
    res.status(400).json({
      error: `Cannot delete batch "${batch.name}" (${batch.code}) because ${enrolledCandidates.length} candidate(s) are currently enrolled. Please reallocate or remove candidates first.`,
      enrolledCount: enrolledCandidates.length,
    });
    return;
  }

  // If cascade, mark candidates as unassigned or archived
  if (enrolledCandidates.length > 0 && cascade) {
    enrolledCandidates.forEach((c) => {
      c.currentBatchId = '';
      c.status = 'inactive';
    });
  }

  // Remove batch
  db.batches.splice(batchIndex, 1);

  // Clean associated meetings
  db.meetingSessions = db.meetingSessions.filter((m) => m.batchId !== batch.id);

  // Clean associated batch assignments
  db.candidateBatchAssignments = db.candidateBatchAssignments.filter((a) => a.batchId !== batch.id);

  // Clean associated resources
  db.resources = db.resources.filter((r) => r.batchId !== batch.id);

  dbManager.save();
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'BATCH_DELETED',
    'batch',
    batch.id,
    `Batch ${batch.name} (${batch.code}) deleted by administrator.`
  );

  res.json({ success: true, message: `Batch "${batch.name}" (${batch.code}) deleted successfully.` });
});

apiRouter.get('/batches/:id/roster', requireAuth, (req, res) => {
  const db = dbManager.get();
  const batch = db.batches.find((b) => b.id === req.params.id);
  if (!batch) {
    res.status(404).json({ error: 'Batch not found.' });
    return;
  }

  const candidates = db.candidates
    .filter((c) => c.currentBatchId === batch.id && c.status !== 'archived')
    .map((c) => ({
      id: c.id,
      candidateId: c.candidateId,
      name: c.name,
      email: c.email,
      phone: c.phone,
      status: c.status,
      enrollmentDate: c.enrollmentDate,
    }));

  res.json({ batch, roster: candidates });
});

// Candidate Batch Transfer (BR-08, BR-09)
apiRouter.post('/batches/transfer', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { candidateId, destinationBatchId, effectiveDate, reason } = req.body;
  if (!candidateId || !destinationBatchId) {
    res.status(400).json({ error: 'Candidate and destination batch are required.' });
    return;
  }

  const db = dbManager.get();
  const candidate = db.candidates.find((c) => c.id === candidateId);
  if (!candidate) {
    res.status(404).json({ error: 'Candidate not found.' });
    return;
  }

  const destBatch = db.batches.find((b) => b.id === destinationBatchId);
  if (!destBatch) {
    res.status(404).json({ error: 'Destination batch not found.' });
    return;
  }

  if (candidate.currentBatchId === destinationBatchId) {
    res.status(400).json({ error: 'Candidate is already active in this batch.' });
    return;
  }

  const sourceBatch = db.batches.find((b) => b.id === candidate.currentBatchId);
  const transferDate = effectiveDate || new Date().toISOString().split('T')[0];

  // 1. Close current active assignment
  const activeAssignment = db.candidateBatchAssignments.find(
    (a) => a.candidateId === candidate.id && a.status === 'active'
  );
  if (activeAssignment) {
    activeAssignment.endDate = transferDate;
    activeAssignment.status = 'transferred';
    activeAssignment.transferReason = reason || 'Administrative transfer';
  }

  // 2. Create new assignment
  const newAssignment: CandidateBatchAssignment = {
    id: `asg-${Date.now()}`,
    candidateId: candidate.id,
    batchId: destBatch.id,
    batchName: destBatch.name,
    courseId: destBatch.courseId,
    courseName: destBatch.courseName,
    startDate: transferDate,
    status: 'active',
    transferReason: reason,
    createdAt: new Date().toISOString(),
  };
  db.candidateBatchAssignments.push(newAssignment);

  // 3. Update candidate current batch pointer
  candidate.currentBatchId = destBatch.id;

  // 4. Update batch roster counters
  if (sourceBatch && (sourceBatch.candidateCount || 0) > 0) {
    sourceBatch.candidateCount = sourceBatch.candidateCount! - 1;
  }
  destBatch.candidateCount = (destBatch.candidateCount || 0) + 1;

  // 5. Send notification to candidate
  const notif: AppNotification = {
    id: `notif-${Date.now()}`,
    title: 'Batch Transfer Notice',
    message: `You have been transferred to ${destBatch.name}. Your future schedules and learning resources now reflect this batch.`,
    type: 'system',
    targetAudience: 'candidate',
    candidateId: candidate.id,
    createdAt: new Date().toISOString(),
    read: false,
  };
  db.notifications.unshift(notif);

  // 6. Queue email
  dbManager.queueEmail(
    candidate.email,
    candidate.name,
    `Batch Transfer Confirmation - ${destBatch.name}`,
    'batch_transfer',
    'delivered'
  );

  // 7. Audit log
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'CANDIDATE_BATCH_TRANSFER',
    'candidate',
    candidate.id,
    `Transferred ${candidate.name} from ${sourceBatch?.name || 'unknown'} to ${destBatch.name}. Reason: ${reason || 'N/A'}`
  );

  dbManager.save();

  res.json({
    success: true,
    message: `Candidate transferred successfully to ${destBatch.name}.`,
    assignment: newAssignment,
  });
});

// ==========================================
// 5. TUTOR MANAGEMENT
// ==========================================

apiRouter.get('/tutors', requireAuth, (req, res) => {
  const db = dbManager.get();
  res.json({ tutors: db.tutors });
});

apiRouter.post('/tutors', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { tutorId, name, email, phone, specialization, assignedCourseIds, notes } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: 'Tutor name and email are required.' });
    return;
  }

  const db = dbManager.get();
  const customId = tutorId?.trim() || `TUT-${100 + db.tutors.length + 1}`;
  const assignedCourses = Array.isArray(assignedCourseIds) ? assignedCourseIds : [];
  const assignedCourseNames = db.courses
    .filter((c) => assignedCourses.includes(c.id))
    .map((c) => c.name);

  const tutor: Tutor = {
    id: `tut-${Date.now()}`,
    tutorId: customId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || '',
    specialization: specialization?.trim() || 'Software Engineering',
    status: 'active',
    assignedCourseIds: assignedCourses,
    assignedCourseNames,
    notes: notes?.trim() || '',
    createdAt: new Date().toISOString(),
  };

  db.tutors.push(tutor);
  dbManager.save();
  dbManager.logAudit(req.user!.email, 'admin', 'TUTOR_CREATED', 'tutor', tutor.id, `Tutor ${tutor.name} (${tutor.tutorId}) created.`);
  res.status(201).json({ tutor });
});

apiRouter.get('/tutors/:id', requireAuth, (req, res) => {
  const db = dbManager.get();
  const tutor = db.tutors.find((t) => t.id === req.params.id);
  if (!tutor) {
    res.status(404).json({ error: 'Tutor not found.' });
    return;
  }
  res.json({ tutor });
});

apiRouter.put('/tutors/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const tutor = db.tutors.find((t) => t.id === req.params.id);
  if (!tutor) {
    res.status(404).json({ error: 'Tutor not found.' });
    return;
  }

  const { name, email, phone, specialization, status, assignedCourseIds, notes } = req.body;
  if (name) tutor.name = name.trim();
  if (email) tutor.email = email.trim().toLowerCase();
  if (phone !== undefined) tutor.phone = phone.trim();
  if (specialization) tutor.specialization = specialization.trim();
  if (status) tutor.status = status;
  if (Array.isArray(assignedCourseIds)) {
    tutor.assignedCourseIds = assignedCourseIds;
    tutor.assignedCourseNames = db.courses
      .filter((c) => assignedCourseIds.includes(c.id))
      .map((c) => c.name);
  }
  if (notes !== undefined) tutor.notes = notes.trim();

  dbManager.save();
  dbManager.logAudit(req.user!.email, 'admin', 'TUTOR_UPDATED', 'tutor', tutor.id, `Tutor ${tutor.name} updated.`);
  res.json({ tutor });
});

apiRouter.delete('/tutors/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const tutorIndex = db.tutors.findIndex((t) => t.id === req.params.id);
  if (tutorIndex === -1) {
    res.status(404).json({ error: 'Tutor not found.' });
    return;
  }
  const tutor = db.tutors[tutorIndex];

  const upcomingMeetings = db.meetingSessions.filter(
    (m) => m.tutorId === tutor.id && m.status === 'scheduled'
  );
  if (upcomingMeetings.length > 0 && req.query.cascade !== 'true') {
    res.status(400).json({
      error: `Cannot delete tutor "${tutor.name}" because they are assigned to ${upcomingMeetings.length} upcoming scheduled meeting(s).`,
      upcomingCount: upcomingMeetings.length,
    });
    return;
  }

  if (upcomingMeetings.length > 0) {
    upcomingMeetings.forEach((m) => {
      m.tutorId = '';
      m.tutorName = 'Unassigned Instructor';
    });
  }

  db.tutors.splice(tutorIndex, 1);
  dbManager.save();
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'TUTOR_DELETED',
    'tutor',
    tutor.id,
    `Tutor ${tutor.name} (${tutor.tutorId}) deleted.`
  );
  res.json({ success: true, message: `Tutor "${tutor.name}" deleted successfully.` });
});

// ==========================================
// 6. MEETING SCHEDULER & SESSIONS (ADMIN & CANDIDATE)
// ==========================================

apiRouter.get('/meetings', requireAdmin, (req, res) => {
  const db = dbManager.get();
  const { batchId, courseId, tutorId, status } = req.query;

  let list = db.meetingSessions.map((m) => {
    const course = db.courses.find((c) => c.id === m.courseId);
    const batch = db.batches.find((b) => b.id === m.batchId);
    const tutor = db.tutors.find((t) => t.id === m.tutorId);
    return {
      ...m,
      courseName: course?.name || m.courseName,
      batchName: batch?.name || m.batchName,
      tutorName: tutor?.name || m.tutorName,
    };
  });

  const isValidParam = (v: any) => v && v !== 'undefined' && v !== 'null' && v !== 'all' && String(v).trim().length > 0;

  if (isValidParam(batchId)) list = list.filter((m) => m.batchId === batchId);
  if (isValidParam(courseId)) list = list.filter((m) => m.courseId === courseId);
  if (isValidParam(tutorId)) list = list.filter((m) => m.tutorId === tutorId);
  if (isValidParam(status)) list = list.filter((m) => m.status === status);

  // Sort descending by date & start time
  list.sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));

  res.json({ meetings: list });
});

// Schedule single meeting
apiRouter.post('/meetings', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { title, courseId, batchId, tutorId, date, startTime, endTime, meetingPlatform, meetingUrl, description } = req.body;

  if (!title || !courseId || !batchId || !date || !startTime || !endTime) {
    res.status(400).json({ error: 'Title, course, batch, date, start time, and end time are required.' });
    return;
  }

  if (startTime >= endTime) {
    res.status(400).json({ error: 'End time must be later than start time.' });
    return;
  }

  const db = dbManager.get();
  const course = db.courses.find((c) => c.id === courseId);
  const batch = db.batches.find((b) => b.id === batchId);
  const tutor = db.tutors.find((t) => t.id === tutorId);

  // Conflict detection for tutor
  const tutorConflict = db.meetingSessions.find(
    (m) =>
      m.status === 'scheduled' &&
      m.tutorId === tutorId &&
      m.date === date &&
      ((startTime >= m.startTime && startTime < m.endTime) ||
        (endTime > m.startTime && endTime <= m.endTime) ||
        (startTime <= m.startTime && endTime >= m.endTime))
  );

  const session: MeetingSession = {
    id: `meet-${Date.now()}`,
    title: title.trim(),
    courseId,
    courseName: course?.name,
    batchId,
    batchName: batch?.name,
    tutorId: tutorId || (tutor?.id || ''),
    tutorName: tutor?.name || 'Assigned Instructor',
    date,
    startTime,
    endTime,
    timezone: db.settings.companyTimezone,
    meetingPlatform: meetingPlatform || 'Google Meet',
    meetingUrl: meetingUrl?.trim() || 'https://meet.google.com/kdl-session',
    status: 'scheduled',
    accessStatus: 'disabled', // BR-16: Meeting access defaults to Disabled!
    description: description?.trim() || '',
    createdAt: new Date().toISOString(),
    isRecurring: false,
  };

  db.meetingSessions.push(session);

  // Notify eligible candidates in this batch
  const eligibleCandidates = db.candidates.filter(
    (c) => c.currentBatchId === batchId && c.status === 'active'
  );

  eligibleCandidates.forEach((c) => {
    db.notifications.unshift({
      id: `notif-${Date.now()}-${c.id}`,
      title: `New Session Scheduled: ${session.title}`,
      message: `A new session has been scheduled for ${session.date} from ${session.startTime} to ${session.endTime}.`,
      type: 'meeting',
      targetAudience: 'batch',
      courseId,
      batchId,
      candidateId: c.id,
      relatedEntity: { type: 'meeting', id: session.id },
      createdAt: new Date().toISOString(),
      read: false,
    });
    dbManager.queueEmail(c.email, c.name, `New Session Scheduled: ${session.title}`, 'meeting_scheduled', 'delivered');
  });

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'MEETING_SCHEDULED',
    'meeting',
    session.id,
    `Scheduled session "${session.title}" for batch ${batch?.name} on ${session.date} (${session.startTime} - ${session.endTime}).`
  );

  dbManager.save();

  res.status(201).json({
    session,
    hasTutorConflict: Boolean(tutorConflict),
    conflictWarning: tutorConflict ? `Tutor already has an overlapping session: "${tutorConflict.title}".` : undefined,
  });
});

// Schedule recurring series
apiRouter.post('/meetings/recurring', requireAdmin, (req: AuthenticatedRequest, res) => {
  const {
    title,
    courseId,
    batchId,
    tutorId,
    startDate,
    endDate,
    maxOccurrences,
    startTime,
    endTime,
    meetingPlatform,
    meetingUrl,
    recurrenceRule,
    selectedDays,
    description,
  } = req.body;

  if (!title || !courseId || !batchId || !startDate || !startTime || !endTime) {
    res.status(400).json({ error: 'Title, course, batch, start date, start time, and end time are required.' });
    return;
  }

  const db = dbManager.get();
  const course = db.courses.find((c) => c.id === courseId);
  const batch = db.batches.find((b) => b.id === batchId);
  const tutor = db.tutors.find((t) => t.id === tutorId);

  const seriesId = `series-${Date.now()}`;
  const generatedSessions: MeetingSession[] = [];
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(start.getTime() + 60 * 24 * 60 * 60 * 1000);
  const limit = Number(maxOccurrences) || 12;

  let current = new Date(start);
  let count = 0;

  while (current <= end && count < limit) {
    const dayOfWeek = current.getDay(); // 0 is Sunday, 1 is Monday...
    let matchesRule = false;

    if (recurrenceRule === 'daily') {
      matchesRule = true;
    } else if (recurrenceRule === 'weekly') {
      matchesRule = dayOfWeek === start.getDay();
    } else if (recurrenceRule === 'custom_weekdays') {
      matchesRule = Array.isArray(selectedDays) && selectedDays.includes(dayOfWeek);
    } else {
      matchesRule = true;
    }

    if (matchesRule) {
      const dateStr = current.toISOString().split('T')[0];
      const session: MeetingSession = {
        id: `meet-${Date.now()}-${count}`,
        seriesId,
        title: `${title} (Session ${count + 1})`,
        courseId,
        courseName: course?.name,
        batchId,
        batchName: batch?.name,
        tutorId: tutorId || (tutor?.id || ''),
        tutorName: tutor?.name || 'Assigned Instructor',
        date: dateStr,
        startTime,
        endTime,
        timezone: db.settings.companyTimezone,
        meetingPlatform: meetingPlatform || 'Google Meet',
        meetingUrl: meetingUrl || 'https://meet.google.com/kdl-series',
        status: 'scheduled',
        accessStatus: 'disabled',
        description: description?.trim() || '',
        createdAt: new Date().toISOString(),
        isRecurring: true,
      };
      generatedSessions.push(session);
      db.meetingSessions.push(session);
      count++;
    }

    current.setDate(current.getDate() + 1);
  }

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'RECURRING_SERIES_CREATED',
    'meeting_series',
    seriesId,
    `Created recurring series "${title}" generating ${generatedSessions.length} sessions.`
  );

  dbManager.save();

  res.status(201).json({
    seriesId,
    occurrencesCount: generatedSessions.length,
    sessions: generatedSessions,
  });
});

// Reschedule / Update Meeting Occurrence
apiRouter.put('/meetings/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const session = db.meetingSessions.find((m) => m.id === req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Meeting session not found.' });
    return;
  }

  const { title, tutorId, date, startTime, endTime, meetingPlatform, meetingUrl, description, rescheduleReason } = req.body;
  const isReschedule = (date && date !== session.date) || (startTime && startTime !== session.startTime);

  if (title) session.title = title.trim();
  if (tutorId) {
    session.tutorId = tutorId;
    const tutor = db.tutors.find((t) => t.id === tutorId);
    session.tutorName = tutor?.name;
  }
  if (date) session.date = date;
  if (startTime) session.startTime = startTime;
  if (endTime) session.endTime = endTime;
  if (meetingPlatform) session.meetingPlatform = meetingPlatform;
  if (meetingUrl) session.meetingUrl = meetingUrl;
  if (description !== undefined) session.description = description;

  if (isReschedule) {
    session.rescheduleReason = rescheduleReason || 'Administrative timing adjustment';

    // Notify affected candidates
    const candidates = db.candidates.filter(
      (c) => c.currentBatchId === session.batchId && c.status === 'active'
    );
    candidates.forEach((c) => {
      db.notifications.unshift({
        id: `notif-${Date.now()}-${c.id}`,
        title: `Session Rescheduled: ${session.title}`,
        message: `Session has been rescheduled to ${session.date} from ${session.startTime} to ${session.endTime}. Reason: ${session.rescheduleReason}`,
        type: 'meeting',
        targetAudience: 'candidate',
        candidateId: c.id,
        relatedEntity: { type: 'meeting', id: session.id },
        createdAt: new Date().toISOString(),
        read: false,
      });
      dbManager.queueEmail(c.email, c.name, `Rescheduled: ${session.title}`, 'meeting_rescheduled', 'delivered');
    });
  }

  dbManager.logAudit(
    req.user!.email,
    'admin',
    isReschedule ? 'MEETING_RESCHEDULED' : 'MEETING_UPDATED',
    'meeting',
    session.id,
    `Meeting "${session.title}" updated${isReschedule ? ` (rescheduled to ${session.date} ${session.startTime})` : ''}.`
  );

  dbManager.save();
  res.json({ session });
});

// Cancel Meeting
apiRouter.put('/meetings/:id/cancel', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { cancelReason } = req.body;
  const db = dbManager.get();
  const session = db.meetingSessions.find((m) => m.id === req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Meeting session not found.' });
    return;
  }

  session.status = 'cancelled';
  session.accessStatus = 'disabled'; // Cannot be enabled when cancelled!
  session.cancelReason = cancelReason || 'Cancelled by instructor or administrator';

  const candidates = db.candidates.filter(
    (c) => c.currentBatchId === session.batchId && c.status === 'active'
  );
  candidates.forEach((c) => {
    db.notifications.unshift({
      id: `notif-${Date.now()}-${c.id}`,
      title: `Session Cancelled: ${session.title}`,
      message: `The session originally scheduled on ${session.date} has been cancelled. Reason: ${session.cancelReason}`,
      type: 'meeting',
      targetAudience: 'candidate',
      candidateId: c.id,
      createdAt: new Date().toISOString(),
      read: false,
    });
    dbManager.queueEmail(c.email, c.name, `Session Cancelled: ${session.title}`, 'meeting_cancelled', 'delivered');
  });

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'MEETING_CANCELLED',
    'meeting',
    session.id,
    `Cancelled session "${session.title}". Reason: ${session.cancelReason}`
  );

  dbManager.save();
  res.json({ session });
});

// Manual Meeting Access Control (BR-16, BR-17, BR-18, BR-20, BR-21)
apiRouter.put('/meetings/:id/access', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { accessStatus } = req.body;
  if (!['enabled', 'disabled'].includes(accessStatus)) {
    res.status(400).json({ error: 'Access status must be "enabled" or "disabled".' });
    return;
  }

  const db = dbManager.get();
  const session = db.meetingSessions.find((m) => m.id === req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Meeting session not found.' });
    return;
  }

  if (session.status === 'cancelled') {
    res.status(400).json({ error: 'Cannot enable access for a cancelled session.' });
    return;
  }

  session.accessStatus = accessStatus;
  if (accessStatus === 'enabled') {
    session.accessEnabledAt = new Date().toISOString();

    // Broadcast in-app notice to batch
    const candidates = db.candidates.filter(
      (c) => c.currentBatchId === session.batchId && c.status === 'active'
    );
    candidates.forEach((c) => {
      db.notifications.unshift({
        id: `notif-${Date.now()}-${c.id}`,
        title: `Meeting Access Live: ${session.title}`,
        message: 'Instructor has enabled meeting access. You may now click Join Meeting in your dashboard.',
        type: 'meeting',
        targetAudience: 'candidate',
        candidateId: c.id,
        relatedEntity: { type: 'meeting', id: session.id },
        createdAt: new Date().toISOString(),
        read: false,
      });
    });
  }

  dbManager.logAudit(
    req.user!.email,
    'admin',
    accessStatus === 'enabled' ? 'MEETING_ACCESS_ENABLED' : 'MEETING_ACCESS_DISABLED',
    'meeting',
    session.id,
    `Meeting access ${accessStatus.toUpperCase()} for "${session.title}".`
  );

  dbManager.save();
  res.json({ session });
});

// Complete Meeting
apiRouter.put('/meetings/:id/complete', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const session = db.meetingSessions.find((m) => m.id === req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Meeting session not found.' });
    return;
  }

  session.status = 'completed';
  session.accessStatus = 'disabled'; // Disabled upon completion per BR-19
  dbManager.save();
  dbManager.logAudit(req.user!.email, 'admin', 'MEETING_COMPLETED', 'meeting', session.id, `Session "${session.title}" marked as completed.`);
  res.json({ session });
});

apiRouter.get('/meetings/:id', requireAdmin, (req, res) => {
  const db = dbManager.get();
  const session = db.meetingSessions.find((m) => m.id === req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Meeting session not found.' });
    return;
  }
  const course = db.courses.find((c) => c.id === session.courseId);
  const batch = db.batches.find((b) => b.id === session.batchId);
  const tutor = db.tutors.find((t) => t.id === session.tutorId);
  res.json({
    session: {
      ...session,
      courseName: course?.name || session.courseName,
      batchName: batch?.name || session.batchName,
      tutorName: tutor?.name || session.tutorName,
    },
  });
});

apiRouter.delete('/meetings/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const index = db.meetingSessions.findIndex((m) => m.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Meeting session not found.' });
    return;
  }
  const session = db.meetingSessions[index];

  // Remove meeting session
  db.meetingSessions.splice(index, 1);

  // Clean associated attendance records
  db.attendance = db.attendance.filter((a) => a.sessionId !== session.id);

  // Clean associated notifications
  db.notifications = db.notifications.filter(
    (n) => !n.relatedEntity || n.relatedEntity.id !== session.id
  );

  dbManager.save();
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'MEETING_DELETED',
    'meeting',
    session.id,
    `Meeting session "${session.title}" on ${session.date} deleted by administrator.`
  );

  res.json({ success: true, message: `Meeting session "${session.title}" deleted successfully.` });
});

// Candidate Meetings List (PROTECTED: Redacts meetingUrl if access is disabled!)
apiRouter.get('/candidate/meetings', requireCandidate, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const cand = req.user as CandidateUser;

  const sessions = db.meetingSessions
    .filter((m) => m.batchId === cand.currentBatchId)
    .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime))
    .map((m) => {
      const course = db.courses.find((c) => c.id === m.courseId);
      const batch = db.batches.find((b) => b.id === m.batchId);
      const tutor = db.tutors.find((t) => t.id === m.tutorId);

      // CRITICAL SECURITY REQUIREMENT (BR-20):
      // Do not expose raw meeting URLs in client payloads while access is disabled.
      const isJoinable = m.accessStatus === 'enabled' && m.status === 'scheduled';

      return {
        id: m.id,
        title: m.title,
        courseId: m.courseId,
        courseName: course?.name,
        batchId: m.batchId,
        batchName: batch?.name,
        tutorId: m.tutorId,
        tutorName: tutor?.name,
        date: m.date,
        startTime: m.startTime,
        endTime: m.endTime,
        timezone: m.timezone,
        meetingPlatform: m.meetingPlatform,
        status: m.status,
        accessStatus: m.accessStatus,
        description: m.description,
        cancelReason: m.cancelReason,
        rescheduleReason: m.rescheduleReason,
        meetingUrl: isJoinable ? m.meetingUrl : undefined,
        isJoinable,
      };
    });

  res.json({ meetings: sessions });
});

// Candidate Join Action (Backend URL Protection & Verification)
apiRouter.get('/candidate/meetings/:id/join', requireCandidate, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const cand = req.user as CandidateUser;
  const session = db.meetingSessions.find((m) => m.id === req.params.id);

  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }

  // Authorization check: Must be in this batch
  if (session.batchId !== cand.currentBatchId) {
    res.status(403).json({ error: 'You are not enrolled in the batch for this session.' });
    return;
  }

  // Access check: Must be enabled by Admin and scheduled
  if (session.status !== 'scheduled' || session.accessStatus !== 'enabled') {
    res.status(403).json({
      error: 'Meeting access is currently disabled by the instructor. Please wait until the instructor activates entry.',
    });
    return;
  }

  // Return protected meeting URL
  res.json({
    meetingUrl: session.meetingUrl,
    platform: session.meetingPlatform,
    title: session.title,
    disclaimer: 'Note: Once you join on the external provider, access is mediated independently by the meeting host.',
  });
});

// ==========================================
// 7. ATTENDANCE MANAGEMENT
// ==========================================

apiRouter.get('/attendance/session/:sessionId', requireAdmin, (req, res) => {
  const db = dbManager.get();
  const session = db.meetingSessions.find((m) => m.id === req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }

  // Eligible candidates enrolled in this batch
  const eligibleCandidates = db.candidates
    .filter((c) => c.currentBatchId === session.batchId && c.status !== 'archived')
    .map((c) => {
      const record = db.attendance.find((a) => a.sessionId === session.id && a.candidateId === c.id);
      return {
        candidateId: c.id,
        candidateCustomId: c.candidateId,
        candidateName: c.name,
        candidateEmail: c.email,
        status: record ? record.status : ('unmarked' as const),
        remarks: record?.remarks || '',
        recordId: record?.id,
        markedAt: record?.markedAt,
        correctionReason: record?.correctionReason,
      };
    });

  res.json({
    session,
    roster: eligibleCandidates,
  });
});

apiRouter.post('/attendance/mark', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { sessionId, records } = req.body;
  if (!sessionId || !Array.isArray(records)) {
    res.status(400).json({ error: 'Session ID and records array are required.' });
    return;
  }

  const db = dbManager.get();
  const session = db.meetingSessions.find((m) => m.id === sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }

  const savedRecords: AttendanceRecord[] = [];

  records.forEach((rec) => {
    const existingIndex = db.attendance.findIndex(
      (a) => a.sessionId === sessionId && a.candidateId === rec.candidateId
    );

    const cand = db.candidates.find((c) => c.id === rec.candidateId);
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      // Update existing record
      const existing = db.attendance[existingIndex];
      existing.status = rec.status;
      existing.remarks = rec.remarks || existing.remarks;
      existing.updatedAt = now;
      if (rec.correctionReason) {
        existing.correctionReason = rec.correctionReason;
      }
      savedRecords.push(existing);
    } else {
      // Create new record
      const newRec: AttendanceRecord = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sessionId,
        sessionTitle: session.title,
        sessionDate: session.date,
        candidateId: rec.candidateId,
        candidateName: cand?.name || 'Unknown',
        candidateCustomId: cand?.candidateId,
        status: rec.status as AttendanceStatus,
        remarks: rec.remarks || '',
        markedAt: now,
        markedBy: req.user!.email,
      };
      db.attendance.push(newRec);
      savedRecords.push(newRec);
    }
  });

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'ATTENDANCE_MARKED',
    'meeting',
    sessionId,
    `Recorded attendance for ${records.length} candidates in "${session.title}".`
  );

  dbManager.save();
  res.json({ success: true, count: savedRecords.length, records: savedRecords });
});

apiRouter.put('/attendance/:id/correct', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { status, remarks, correctionReason } = req.body;
  if (!status || !correctionReason) {
    res.status(400).json({ error: 'New status and mandatory correction reason are required.' });
    return;
  }

  const db = dbManager.get();
  const record = db.attendance.find((a) => a.id === req.params.id);
  if (!record) {
    res.status(404).json({ error: 'Attendance record not found.' });
    return;
  }

  const previousStatus = record.status;
  record.status = status;
  if (remarks !== undefined) record.remarks = remarks;
  record.correctionReason = correctionReason.trim();
  record.updatedAt = new Date().toISOString();

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'ATTENDANCE_CORRECTED',
    'attendance',
    record.id,
    `Corrected attendance for candidate ${record.candidateName}: ${previousStatus} -> ${status}. Reason: ${correctionReason}`
  );

  dbManager.save();
  res.json({ record });
});

apiRouter.delete('/attendance/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const index = db.attendance.findIndex((a) => a.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Attendance record not found.' });
    return;
  }
  const rec = db.attendance[index];
  db.attendance.splice(index, 1);
  dbManager.save();
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'ATTENDANCE_RECORD_DELETED',
    'attendance',
    rec.id,
    `Deleted attendance record for ${rec.candidateName} in session "${rec.sessionTitle}".`
  );
  res.json({ success: true, message: 'Attendance record deleted.' });
});

apiRouter.delete('/attendance/session/:sessionId', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const countBefore = db.attendance.length;
  db.attendance = db.attendance.filter((a) => a.sessionId !== req.params.sessionId);
  const deletedCount = countBefore - db.attendance.length;
  dbManager.save();
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'SESSION_ATTENDANCE_RESET',
    'attendance',
    req.params.sessionId,
    `Reset attendance for session ${req.params.sessionId} (${deletedCount} records removed).`
  );
  res.json({ success: true, resetCount: deletedCount });
});

// Candidate Personal Attendance View & Metric Calculation
apiRouter.get('/candidate/attendance', requireCandidate, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const cand = req.user as CandidateUser;

  // Find all attendance records for this candidate
  const records = db.attendance
    .filter((a) => a.candidateId === cand.id)
    .sort((a, b) => (b.sessionDate || '').localeCompare(a.sessionDate || ''));

  // Calculate statistics according to PRD formula:
  // Qualifying attended sessions / eligible sessions * 100
  const lateCountsAsAttended = db.settings.lateCountsAsAttended;
  const excludeExcused = db.settings.excludeExcusedFromDenominator;

  let presentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;
  let absentCount = 0;

  records.forEach((r) => {
    if (r.status === 'present') presentCount++;
    else if (r.status === 'late') lateCount++;
    else if (r.status === 'excused') excusedCount++;
    else if (r.status === 'absent') absentCount++;
  });

  const qualifyingAttended = presentCount + (lateCountsAsAttended ? lateCount : 0);
  const eligibleSessions = records.length - (excludeExcused ? excusedCount : 0);
  const attendanceRate = eligibleSessions > 0 ? Math.round((qualifyingAttended / eligibleSessions) * 100) : 100;

  res.json({
    metrics: {
      attendanceRate,
      totalSessions: records.length,
      presentCount,
      lateCount,
      excusedCount,
      absentCount,
      qualifyingAttended,
      eligibleSessions,
    },
    records,
  });
});

// ==========================================
// 8. RESOURCES & LEARNING DOCUMENTS
// ==========================================

apiRouter.get('/resources', requireAdmin, (req, res) => {
  const db = dbManager.get();
  const { courseId, batchId, category, status } = req.query;

  let list = db.resources.map((r) => {
    const course = db.courses.find((c) => c.id === r.courseId);
    const batch = db.batches.find((b) => b.id === r.batchId);
    return {
      ...r,
      courseName: course?.name,
      batchName: batch?.name,
    };
  });

  const isValidParam = (v: any) => v && v !== 'undefined' && v !== 'null' && v !== 'all' && String(v).trim().length > 0;

  if (isValidParam(courseId)) list = list.filter((r) => r.courseId === courseId);
  if (isValidParam(batchId)) list = list.filter((r) => r.batchId === batchId);
  if (isValidParam(category)) list = list.filter((r) => r.category === category);
  if (isValidParam(status)) list = list.filter((r) => r.status === status);

  res.json({ resources: list });
});

apiRouter.post('/resources', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { title, description, category, type, url, fileName, fileSize, mimeType, courseId, batchId, audience, status } = req.body;
  if (!title || !category || !url) {
    res.status(400).json({ error: 'Title, category, and file/URL are required.' });
    return;
  }

  const db = dbManager.get();
  const course = db.courses.find((c) => c.id === courseId);
  const batch = db.batches.find((b) => b.id === batchId);

  const resource: ResourceItem = {
    id: `res-${Date.now()}`,
    title: title.trim(),
    description: description?.trim() || '',
    category,
    type: type || 'file',
    url: url.trim(),
    fileName: fileName || title.replace(/\s+/g, '-').toLowerCase() + '.pdf',
    fileSize: fileSize || '1.2 MB',
    mimeType: mimeType || 'application/pdf',
    courseId,
    courseName: course?.name,
    batchId,
    batchName: batch?.name,
    audience: audience || (batchId ? 'batch' : courseId ? 'course' : 'all'),
    status: status || 'published',
    uploadedBy: req.user!.email,
    createdAt: new Date().toISOString(),
  };

  db.resources.unshift(resource);

  if (resource.status === 'published') {
    // Notify eligible candidates
    let audienceCandidates = db.candidates.filter((c) => c.status === 'active');
    if (resource.audience === 'batch' && resource.batchId) {
      audienceCandidates = audienceCandidates.filter((c) => c.currentBatchId === resource.batchId);
    } else if (resource.audience === 'course' && resource.courseId) {
      audienceCandidates = audienceCandidates.filter((c) => c.courseId === resource.courseId);
    }

    audienceCandidates.forEach((c) => {
      db.notifications.unshift({
        id: `notif-${Date.now()}-${c.id}`,
        title: `New Resource: ${resource.title}`,
        message: `New learning resource "${resource.title}" (${resource.category}) is now available in your documents repository.`,
        type: 'resource',
        targetAudience: 'candidate',
        candidateId: c.id,
        relatedEntity: { type: 'resource', id: resource.id },
        createdAt: new Date().toISOString(),
        read: false,
      });
    });
  }

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'RESOURCE_PUBLISHED',
    'resource',
    resource.id,
    `Published resource "${resource.title}" (${resource.category}) for ${resource.audience} audience.`
  );

  dbManager.save();
  res.status(201).json({ resource });
});

apiRouter.put('/resources/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const resource = db.resources.find((r) => r.id === req.params.id);
  if (!resource) {
    res.status(404).json({ error: 'Resource not found.' });
    return;
  }

  const { title, description, category, url, status, courseId, batchId, audience } = req.body;
  if (title) resource.title = title.trim();
  if (description !== undefined) resource.description = description.trim();
  if (category) resource.category = category;
  if (url) resource.url = url.trim();
  if (status) resource.status = status;
  if (courseId !== undefined) resource.courseId = courseId;
  if (batchId !== undefined) resource.batchId = batchId;
  if (audience) resource.audience = audience;

  dbManager.save();
  dbManager.logAudit(req.user!.email, 'admin', 'RESOURCE_UPDATED', 'resource', resource.id, `Resource "${resource.title}" updated.`);
  res.json({ resource });
});

apiRouter.get('/resources/:id', requireAuth, (req, res) => {
  const db = dbManager.get();
  const resource = db.resources.find((r) => r.id === req.params.id);
  if (!resource) {
    res.status(404).json({ error: 'Resource not found.' });
    return;
  }
  const course = db.courses.find((c) => c.id === resource.courseId);
  const batch = db.batches.find((b) => b.id === resource.batchId);
  res.json({
    resource: {
      ...resource,
      courseName: course?.name,
      batchName: batch?.name,
    },
  });
});

apiRouter.delete('/resources/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const index = db.resources.findIndex((r) => r.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Resource not found.' });
    return;
  }
  const resource = db.resources[index];
  if (req.query.soft === 'true') {
    resource.status = 'archived';
    dbManager.logAudit(req.user!.email, 'admin', 'RESOURCE_ARCHIVED', 'resource', resource.id, `Resource "${resource.title}" archived.`);
  } else {
    db.resources.splice(index, 1);
    dbManager.logAudit(req.user!.email, 'admin', 'RESOURCE_DELETED', 'resource', resource.id, `Resource "${resource.title}" deleted.`);
  }
  dbManager.save();
  res.json({ success: true, message: `Resource "${resource.title}" deleted successfully.` });
});

// Candidate Authorized Resources (Filtered strictly to candidate's course/batch!)
apiRouter.get('/candidate/resources', requireCandidate, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const cand = req.user as CandidateUser;

  // PRD §6.8, §7.3: Intersection default:
  // Candidates can access only resources assigned to their current course/batch or explicitly permitted audience.
  const authorized = db.resources.filter((r) => {
    if (r.status !== 'published') return false;
    if (r.audience === 'all') return true;
    if (r.audience === 'batch' && r.batchId === cand.currentBatchId) return true;
    if (r.audience === 'course' && r.courseId === cand.courseId && !r.batchId) return true;
    // Intersection rule: If both course & batch specified
    if (r.courseId && r.batchId) {
      return r.courseId === cand.courseId && r.batchId === cand.currentBatchId;
    }
    return false;
  });

  res.json({ resources: authorized });
});

// ==========================================
// 9. NOTIFICATIONS & ANNOUNCEMENTS
// ==========================================

apiRouter.get('/notifications', requireAdmin, (req, res) => {
  const db = dbManager.get();
  res.json({ notifications: db.notifications });
});

apiRouter.post('/notifications', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { title, message, targetAudience, courseId, batchId, sendEmail } = req.body;
  if (!title || !message) {
    res.status(400).json({ error: 'Title and message are required.' });
    return;
  }

  const db = dbManager.get();
  const notif: AppNotification = {
    id: `notif-${Date.now()}`,
    title: title.trim(),
    message: message.trim(),
    type: 'announcement',
    targetAudience: targetAudience || 'all',
    courseId,
    batchId,
    createdAt: new Date().toISOString(),
    read: false,
  };

  db.notifications.unshift(notif);

  // Filter recipients for email if selected
  let recipients = db.candidates.filter((c) => c.status === 'active');
  if (targetAudience === 'batch' && batchId) {
    recipients = recipients.filter((c) => c.currentBatchId === batchId);
  } else if (targetAudience === 'course' && courseId) {
    recipients = recipients.filter((c) => c.courseId === courseId);
  }

  if (sendEmail) {
    recipients.forEach((c) => {
      dbManager.queueEmail(c.email, c.name, notif.title, 'announcement', 'delivered');
    });
  }

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'ANNOUNCEMENT_PUBLISHED',
    'notification',
    notif.id,
    `Announcement "${notif.title}" posted to ${notif.targetAudience} audience (${recipients.length} candidates).`
  );

  dbManager.save();
  res.status(201).json({ notification: notif, recipientCount: recipients.length });
});

apiRouter.delete('/notifications/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const index = db.notifications.findIndex((n) => n.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Notification not found.' });
    return;
  }
  const notif = db.notifications[index];
  db.notifications.splice(index, 1);
  dbManager.save();
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'NOTIFICATION_DELETED',
    'notification',
    notif.id,
    `Notification "${notif.title}" deleted.`
  );
  res.json({ success: true, message: 'Notification deleted successfully.' });
});

apiRouter.get('/candidate/notifications', requireCandidate, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const cand = req.user as CandidateUser;

  const relevant = db.notifications.filter((n) => {
    if (n.targetAudience === 'all') return true;
    if (n.targetAudience === 'candidate' && n.candidateId === cand.id) return true;
    if (n.targetAudience === 'batch' && n.batchId === cand.currentBatchId) return true;
    if (n.targetAudience === 'course' && n.courseId === cand.courseId) return true;
    return false;
  });

  res.json({ notifications: relevant });
});

apiRouter.put('/candidate/notifications/:id/read', requireCandidate, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const notif = db.notifications.find((n) => n.id === req.params.id);
  if (notif) {
    notif.read = true;
    dbManager.save();
  }
  res.json({ success: true });
});

apiRouter.put('/candidate/notifications/read-all', requireCandidate, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const cand = req.user as CandidateUser;

  db.notifications.forEach((n) => {
    if (
      n.targetAudience === 'all' ||
      (n.targetAudience === 'candidate' && n.candidateId === cand.id) ||
      (n.targetAudience === 'batch' && n.batchId === cand.currentBatchId) ||
      (n.targetAudience === 'course' && n.courseId === cand.courseId)
    ) {
      n.read = true;
    }
  });

  dbManager.save();
  res.json({ success: true });
});

// ==========================================
// 10. REPORTS & EXPORTS
// ==========================================

apiRouter.get('/reports/summary', requireAdmin, (req, res) => {
  const db = dbManager.get();
  const today = new Date().toISOString().split('T')[0];

  const totalCandidates = db.candidates.filter((c) => c.status !== 'archived').length;
  const activeCandidates = db.candidates.filter((c) => c.status === 'active').length;
  const pendingCandidates = db.candidates.filter((c) => c.status === 'pending_activation').length;

  const totalCourses = db.courses.length;
  const activeBatches = db.batches.filter((b) => b.status === 'active').length;
  const activeTutors = db.tutors.filter((t) => t.status === 'active').length;

  const todayMeetings = db.meetingSessions.filter((m) => m.date === today);
  const upcomingMeetings = db.meetingSessions.filter((m) => m.date > today && m.status === 'scheduled');
  const cancelledMeetings = db.meetingSessions.filter((m) => m.status === 'cancelled');
  const completedMeetings = db.meetingSessions.filter((m) => m.status === 'completed');

  // Attendance metrics
  const totalAttendance = db.attendance.length;
  const presentCount = db.attendance.filter((a) => a.status === 'present').length;
  const lateCount = db.attendance.filter((a) => a.status === 'late').length;
  const overallAttendanceRate =
    totalAttendance > 0 ? Math.round(((presentCount + lateCount) / totalAttendance) * 100) : 100;

  res.json({
    candidates: { total: totalCandidates, active: activeCandidates, pending: pendingCandidates },
    academics: { courses: totalCourses, activeBatches, activeTutors },
    meetings: {
      today: todayMeetings.length,
      upcoming: upcomingMeetings.length,
      cancelled: cancelledMeetings.length,
      completed: completedMeetings.length,
    },
    attendance: {
      totalRecords: totalAttendance,
      presentRate: overallAttendanceRate,
    },
    recentAudit: db.auditLogs.slice(0, 5),
  });
});

apiRouter.get('/reports/export/:type', requireAdmin, (req, res) => {
  const { type } = req.params;
  const db = dbManager.get();

  let csvContent = '';

  if (type === 'candidates') {
    csvContent = 'Candidate ID,Full Name,Email,Phone,Course,Batch,Status,Enrollment Date\n';
    db.candidates.forEach((c) => {
      const crs = db.courses.find((cr) => cr.id === c.courseId)?.name || '';
      const bch = db.batches.find((b) => b.id === c.currentBatchId)?.name || '';
      csvContent += `"${c.candidateId}","${c.name}","${c.email}","${c.phone || ''}","${crs}","${bch}","${c.status}","${c.enrollmentDate}"\n`;
    });
  } else if (type === 'attendance') {
    csvContent = 'Session Date,Session Title,Candidate ID,Candidate Name,Status,Remarks,Marked By\n';
    db.attendance.forEach((a) => {
      csvContent += `"${a.sessionDate || ''}","${a.sessionTitle || ''}","${a.candidateCustomId || ''}","${a.candidateName || ''}","${a.status}","${a.remarks || ''}","${a.markedBy}"\n`;
    });
  } else if (type === 'meetings') {
    csvContent = 'Date,Start Time,End Time,Title,Course,Batch,Tutor,Status,Access Status\n';
    db.meetingSessions.forEach((m) => {
      csvContent += `"${m.date}","${m.startTime}","${m.endTime}","${m.title}","${m.courseName || ''}","${m.batchName || ''}","${m.tutorName || ''}","${m.status}","${m.accessStatus}"\n`;
    });
  } else {
    res.status(400).json({ error: 'Unknown export type.' });
    return;
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="kodewar-${type}-report.csv"`);
  res.send(csvContent);
});

// ==========================================
// 11. AUDIT LOGS & EMAIL OUTBOX LOGS
// ==========================================

apiRouter.get('/audit-logs', requireAdmin, (req, res) => {
  const db = dbManager.get();
  res.json({ logs: db.auditLogs });
});

apiRouter.get('/email-logs', requireAdmin, (req, res) => {
  const db = dbManager.get();
  const { status, search } = req.query;
  let logs = [...db.emailLogs];

  const isValidParam = (v: any) => v && v !== 'undefined' && v !== 'null' && v !== 'all' && String(v).trim().length > 0;

  if (isValidParam(status)) {
    logs = logs.filter((l) => l.deliveryStatus === status);
  }
  if (isValidParam(search)) {
    const q = String(search).trim().toLowerCase();
    logs = logs.filter(
      (l) =>
        l.recipientEmail.toLowerCase().includes(q) ||
        l.recipientName.toLowerCase().includes(q) ||
        l.subject.toLowerCase().includes(q) ||
        l.template.toLowerCase().includes(q)
    );
  }

  res.json({ logs });
});

apiRouter.get('/email-logs/:id', requireAdmin, (req, res) => {
  const db = dbManager.get();
  const log = db.emailLogs.find((l) => l.id === req.params.id);
  if (!log) {
    res.status(404).json({ error: 'Email log not found.' });
    return;
  }
  res.json({ log });
});

apiRouter.post('/email-logs', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { recipientEmail, recipientName, subject, template, deliveryStatus, failureReason } = req.body;
  if (!recipientEmail || !subject) {
    res.status(400).json({ error: 'Recipient email and subject are required.' });
    return;
  }

  const db = dbManager.get();
  const status = deliveryStatus || 'delivered';
  const now = new Date().toISOString();

  const newLog: EmailLog = {
    id: `email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    recipientEmail: recipientEmail.trim().toLowerCase(),
    recipientName: recipientName?.trim() || recipientEmail.split('@')[0],
    subject: subject.trim(),
    template: template || 'announcement',
    deliveryStatus: status,
    failureReason: status === 'failed' ? (failureReason || 'SMTP gateway timeout') : undefined,
    sentAt: now,
    deliveredAt: status === 'delivered' || status === 'sent' ? now : undefined,
  };

  db.emailLogs.unshift(newLog);
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'EMAIL_LOG_CREATED',
    'email_log',
    newLog.id,
    `Dispatched transactional email to ${newLog.recipientEmail} (${newLog.subject}).`
  );

  dbManager.save();
  res.status(201).json({ success: true, log: newLog });
});

apiRouter.put('/email-logs/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const log = db.emailLogs.find((l) => l.id === req.params.id);
  if (!log) {
    res.status(404).json({ error: 'Email log not found.' });
    return;
  }

  const { recipientEmail, recipientName, subject, template, deliveryStatus, failureReason } = req.body;
  if (recipientEmail) log.recipientEmail = recipientEmail.trim().toLowerCase();
  if (recipientName !== undefined) log.recipientName = recipientName.trim();
  if (subject) log.subject = subject.trim();
  if (template) log.template = template;
  if (deliveryStatus) {
    log.deliveryStatus = deliveryStatus;
    if (deliveryStatus === 'delivered' || deliveryStatus === 'sent') {
      log.deliveredAt = log.deliveredAt || new Date().toISOString();
      log.failureReason = undefined;
    } else if (deliveryStatus === 'failed') {
      log.failureReason = failureReason || log.failureReason || 'Manual failure override';
    }
  }
  if (failureReason !== undefined) log.failureReason = failureReason;

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'EMAIL_LOG_UPDATED',
    'email_log',
    log.id,
    `Updated email log for ${log.recipientEmail} (${log.subject}).`
  );

  dbManager.save();
  res.json({ success: true, log });
});

apiRouter.post('/email-logs/:id/retry', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const log = db.emailLogs.find((l) => l.id === req.params.id);
  if (!log) {
    res.status(404).json({ error: 'Email log not found.' });
    return;
  }

  log.deliveryStatus = 'delivered';
  log.failureReason = undefined;
  log.deliveredAt = new Date().toISOString();

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'EMAIL_RETRY',
    'email_log',
    log.id,
    `Retried queued email to ${log.recipientEmail} (${log.subject}).`
  );

  dbManager.save();
  res.json({ success: true, log });
});

apiRouter.delete('/email-logs/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const index = db.emailLogs.findIndex((l) => l.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Email log not found.' });
    return;
  }
  const deleted = db.emailLogs[index];
  db.emailLogs.splice(index, 1);

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'EMAIL_LOG_DELETED',
    'email_log',
    deleted.id,
    `Deleted transactional email log to ${deleted.recipientEmail} (${deleted.subject}).`
  );

  dbManager.save();
  res.json({ success: true, message: 'Email log entry deleted successfully.' });
});

apiRouter.delete('/email-logs', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const count = db.emailLogs.length;
  db.emailLogs = [];

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'EMAIL_LOGS_CLEARED',
    'email_log',
    'bulk',
    `Cleared all ${count} transactional email outbox logs.`
  );

  dbManager.save();
  res.json({ success: true, message: `Cleared ${count} email logs successfully.` });
});

// ==========================================
// 12. PLATFORM SETTINGS
// ==========================================

apiRouter.get('/settings', requireAuth, (req, res) => {
  const db = dbManager.get();
  res.json({ settings: db.settings });
});

apiRouter.put('/settings', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const {
    companyName,
    companyTimezone,
    lateCountsAsAttended,
    excludeExcusedFromDenominator,
    emailNotificationsEnabled,
    autoEmailReminders,
    defaultReminderOffsets,
    maxFileUploadSizeMb,
  } = req.body;

  if (companyName) db.settings.companyName = companyName.trim();
  if (companyTimezone) db.settings.companyTimezone = companyTimezone.trim();
  if (lateCountsAsAttended !== undefined) db.settings.lateCountsAsAttended = Boolean(lateCountsAsAttended);
  if (excludeExcusedFromDenominator !== undefined) db.settings.excludeExcusedFromDenominator = Boolean(excludeExcusedFromDenominator);
  if (emailNotificationsEnabled !== undefined) db.settings.emailNotificationsEnabled = Boolean(emailNotificationsEnabled);
  if (autoEmailReminders !== undefined) db.settings.autoEmailReminders = Boolean(autoEmailReminders);
  if (Array.isArray(defaultReminderOffsets)) db.settings.defaultReminderOffsets = defaultReminderOffsets;
  if (maxFileUploadSizeMb !== undefined) db.settings.maxFileUploadSizeMb = Number(maxFileUploadSizeMb);

  dbManager.logAudit(req.user!.email, 'admin', 'SETTINGS_UPDATED', 'settings', 'global', 'Updated platform configuration settings.');
  dbManager.save();

  res.json({ settings: db.settings });
});

// ==========================================
// 13. SUPABASE CLOUD DATABASE INTEGRATION
// ==========================================

apiRouter.get('/supabase/status', requireAdmin, (req, res) => {
  const config = getSupabaseConfig();
  res.json({
    connected: isSupabaseConnected(),
    url: config.url,
    hasKey: !!config.key,
    keyPreview: config.key,
    lastSyncedAt: getLastSyncedAt(),
  });
});

apiRouter.post('/supabase/config', requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { url, key } = req.body;
  if (!url || !key) {
    res.status(400).json({ error: 'Supabase URL and API Key are required.' });
    return;
  }

  const test = await testSupabaseConnection(url, key);
  if (!test.ok) {
    res.status(400).json({ error: test.message });
    return;
  }

  configureSupabase(url, key);
  // Auto-sync current database to Supabase
  await dbManager.forcePushToSupabase();

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'SUPABASE_CONFIGURED',
    'database',
    'supabase',
    `Connected Supabase project: ${url.trim()}`
  );

  res.json({
    success: true,
    message: 'Supabase connected and database successfully synced!',
    lastSyncedAt: getLastSyncedAt(),
  });
});

apiRouter.post('/supabase/sync', requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { direction } = req.body;

  if (!isSupabaseConnected()) {
    res.status(400).json({ error: 'Supabase is not configured yet. Please configure URL and API Key.' });
    return;
  }

  try {
    if (direction === 'pull') {
      const ok = await dbManager.forcePullFromSupabase();
      if (!ok) {
        res.status(400).json({ error: 'Failed to pull database from Supabase. Table may be empty.' });
        return;
      }
      res.json({ success: true, message: 'Database successfully pulled from Supabase!' });
    } else {
      const ok = await dbManager.forcePushToSupabase();
      if (!ok) {
        res.status(400).json({ error: 'Failed to push database to Supabase.' });
        return;
      }
      res.json({ success: true, message: 'Database successfully synced to Supabase!' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Sync failed.' });
  }
});
