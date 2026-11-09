import { Router } from 'express';
import type { Response } from 'express';
import crypto from 'crypto';
import { dbManager, hashPassword, getDefaultTutorPermissions } from './db.ts';
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
  requireTutor,
  requireTutorOrAdmin,
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
  TutorUser,
  TutorPermissions,
  EmailLog,
  LeaveApplication,
  LeaveType,
  LeavePolicy,
  LeaveStatus,
} from '../src/types/index.ts';
import {
  calculateLeaveDays,
  validateLeaveDates,
  checkLeaveOverlap,
  getTodayDateString,
} from '../src/common/validation/leaveValidation.ts';
import { triggerN8nCandidateOnboarding } from './n8n.ts';

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

  // Check Tutors
  const tut = db.tutors.find(
    (t) =>
      t.email.toLowerCase() === normalizedId ||
      t.tutorId.toLowerCase() === normalizedId
  );

  if (tut) {
    const computedHash = hashPassword(password, tut.salt || '');
    if (computedHash === tut.passwordHash) {
      if (tut.status === 'inactive') {
        res.status(403).json({ error: 'Your tutor account has been deactivated. Please contact administrator.' });
        return;
      }

      const token = generateToken(tut.id, 'tutor');
      const assignedCourseNames = (tut.assignedCourseIds || [])
        .map((cid) => db.courses.find((c) => c.id === cid)?.name)
        .filter(Boolean) as string[];
      const assignedBatchNames = (tut.assignedBatchIds || [])
        .map((bid) => db.batches.find((b) => b.id === bid)?.name)
        .filter(Boolean) as string[];

      dbManager.logAudit(
        tut.email,
        'tutor',
        'TUTOR_LOGIN',
        'tutor',
        tut.id,
        `Tutor ${tut.name} (${tut.tutorId}) logged in.`
      );

      res.json({
        token,
        user: {
          id: tut.id,
          tutorId: tut.tutorId,
          name: tut.name,
          email: tut.email,
          phone: tut.phone,
          specialization: tut.specialization,
          designation: tut.designation,
          avatarUrl: tut.avatarUrl,
          status: tut.status,
          assignedCourseIds: tut.assignedCourseIds || [],
          assignedCourseNames,
          assignedBatchIds: tut.assignedBatchIds || [],
          assignedBatchNames,
          permissions: tut.permissions || getDefaultTutorPermissions(),
          mustChangePassword: tut.mustChangePassword,
          notes: tut.notes,
          createdAt: tut.createdAt,
          role: 'tutor',
        },
      });
      return;
    }
  }

  res.status(401).json({ error: 'Invalid email, Candidate/Tutor ID, or password.' });
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

  if (req.user!.role === 'tutor') {
    const tut = db.tutors.find((t) => t.id === req.user!.id);
    if (!tut) {
      res.status(404).json({ error: 'Tutor account not found.' });
      return;
    }

    if (!tut.mustChangePassword && currentPassword) {
      const checkHash = hashPassword(currentPassword, tut.salt || '');
      if (checkHash !== tut.passwordHash) {
        res.status(400).json({ error: 'Current password is incorrect.' });
        return;
      }
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    tut.salt = newSalt;
    tut.passwordHash = hashPassword(newPassword, newSalt);
    tut.mustChangePassword = false;
    delete tut.tempPassword;

    dbManager.save();
    dbManager.logAudit(tut.email, 'tutor', 'PASSWORD_CHANGED', 'tutor', tut.id, `Tutor ${tut.name} (${tut.tutorId}) updated password.`);
    dbManager.queueEmail(tut.email, tut.name, 'Tutor Portal Password Updated', 'tutor_password_reset', 'sent');

    res.json({
      success: true,
      message: 'Password updated successfully. Tutor account is fully active.',
      user: {
        ...req.user,
        mustChangePassword: false,
      },
    });
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

  if (role === 'tutor') {
    let tut = candidateId
      ? db.tutors.find((t) => t.id === candidateId || t.tutorId === candidateId || t.email === candidateId)
      : db.tutors.find((t) => t.status === 'active') || db.tutors[0];

    if (!tut) {
      res.status(404).json({ error: 'No tutors found.' });
      return;
    }

    const token = generateToken(tut.id, 'tutor');
    const assignedCourseNames = (tut.assignedCourseIds || [])
      .map((cid) => db.courses.find((c) => c.id === cid)?.name)
      .filter(Boolean) as string[];
    const assignedBatchNames = (tut.assignedBatchIds || [])
      .map((bid) => db.batches.find((b) => b.id === bid)?.name)
      .filter(Boolean) as string[];

    res.json({
      token,
      user: {
        id: tut.id,
        tutorId: tut.tutorId,
        name: tut.name,
        email: tut.email,
        phone: tut.phone,
        specialization: tut.specialization,
        designation: tut.designation,
        avatarUrl: tut.avatarUrl,
        status: tut.status,
        assignedCourseIds: tut.assignedCourseIds || [],
        assignedCourseNames,
        assignedBatchIds: tut.assignedBatchIds || [],
        assignedBatchNames,
        permissions: tut.permissions || getDefaultTutorPermissions(),
        mustChangePassword: tut.mustChangePassword,
        notes: tut.notes,
        createdAt: tut.createdAt,
        role: 'tutor',
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

apiRouter.post('/candidates', requireAdmin, async (req: AuthenticatedRequest, res) => {
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

  // Trigger n8n Automated Candidate Onboarding Email Workflow
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const n8nStatus = await triggerN8nCandidateOnboarding({
    eventType: 'candidate_created',
    userName: newCandidate.name,
    userCourse: course.name,
    userEmail: newCandidate.email,
    tempPassword,
    candidateId: newCandidate.candidateId,
    enrollmentDate: newCandidate.enrollmentDate,
    adminEmail: req.user?.email,
    loginUrl: `${baseUrl}`,
  });

  res.status(201).json({
    candidate: {
      ...newCandidate,
      courseName: course.name,
      batchName: batch.name,
      passwordHash: undefined,
      salt: undefined,
    },
    tempPassword,
    n8nStatus,
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

apiRouter.post('/candidates/:id/resend-activation', requireAdmin, async (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const cand = db.candidates.find((c) => c.id === req.params.id);
  if (!cand) {
    res.status(404).json({ error: 'Candidate not found.' });
    return;
  }

  const course = db.courses.find((cr) => cr.id === cand.courseId);
  const courseName = course?.name || 'Internship Training Program';

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

  if (isSupabaseConnected()) {
    await dbManager.flushToSupabase();
  }

  // Trigger n8n Automated Candidate Onboarding Email Workflow
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const n8nStatus = await triggerN8nCandidateOnboarding({
    eventType: 'resend_activation',
    userName: cand.name,
    userCourse: courseName,
    userEmail: cand.email,
    tempPassword,
    candidateId: cand.candidateId,
    enrollmentDate: cand.enrollmentDate,
    adminEmail: req.user?.email,
    loginUrl: `${baseUrl}`,
  });

  res.json({
    success: true,
    message: 'Activation credentials updated and n8n onboarding email triggered.',
    tempPassword,
    n8nStatus,
  });
});

// Test n8n Webhook Connection (Admin only)
apiRouter.post('/n8n/test', requireAdmin, async (req: AuthenticatedRequest, res) => {
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const testEmail = req.body.email || req.user?.email || 'admin@kodewar.com';

  const n8nStatus = await triggerN8nCandidateOnboarding({
    eventType: 'candidate_created',
    userName: req.body.name || 'Sample Intern',
    userCourse: req.body.course || 'Full Stack Web Development',
    userEmail: testEmail,
    tempPassword: 'Pass@Test2026',
    candidateId: 'KDL-TEST-001',
    enrollmentDate: new Date().toISOString().split('T')[0],
    adminEmail: req.user?.email,
    loginUrl: `${baseUrl}`,
  });

  res.json({
    success: n8nStatus.success,
    message: n8nStatus.message,
    n8nStatus,
  });
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
  const {
    tutorId,
    name,
    email,
    phone,
    specialization,
    designation,
    avatarUrl,
    assignedCourseIds,
    assignedBatchIds,
    permissions,
    notes,
    customPassword,
  } = req.body;

  if (!name || !email) {
    res.status(400).json({ error: 'Tutor name and email are required.' });
    return;
  }

  const db = dbManager.get();
  const normalizedEmail = email.trim().toLowerCase();
  if (db.tutors.some((t) => t.email.toLowerCase() === normalizedEmail)) {
    res.status(400).json({ error: 'A tutor with this email address already exists.' });
    return;
  }

  const customId = tutorId?.trim() || `TUT-${100 + db.tutors.length + 1}`;
  const assignedCourses = Array.isArray(assignedCourseIds) ? assignedCourseIds : [];
  const assignedCourseNames = db.courses
    .filter((c) => assignedCourses.includes(c.id))
    .map((c) => c.name);

  const assignedBatches = Array.isArray(assignedBatchIds) ? assignedBatchIds : [];
  const assignedBatchNames = db.batches
    .filter((b) => assignedBatches.includes(b.id))
    .map((b) => b.name);

  // Generate initial temporary password
  const tempPass = customPassword?.trim() || `Pass@${Math.floor(1000 + Math.random() * 9000)}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(tempPass, salt);

  const tutor: Tutor & { passwordHash: string; salt: string; tempPassword?: string } = {
    id: `tut-${Date.now()}`,
    tutorId: customId,
    name: name.trim(),
    email: normalizedEmail,
    phone: phone?.trim() || '',
    specialization: specialization?.trim() || 'Software Engineering',
    designation: designation?.trim() || 'Instructor / Tutor',
    avatarUrl: avatarUrl?.trim() || '',
    status: 'active',
    assignedCourseIds: assignedCourses,
    assignedCourseNames,
    assignedBatchIds: assignedBatches,
    assignedBatchNames,
    permissions: permissions ? { ...getDefaultTutorPermissions(), ...permissions } : getDefaultTutorPermissions(),
    mustChangePassword: true,
    tempPassword: tempPass,
    notes: notes?.trim() || '',
    createdAt: new Date().toISOString(),
    role: 'tutor',
    passwordHash,
    salt,
  };

  db.tutors.push(tutor);

  // Queue Welcome Email
  dbManager.queueEmail(
    tutor.email,
    tutor.name,
    'Welcome to Kodewar LMS - Tutor Portal Activation Credentials',
    'tutor_welcome',
    'delivered'
  );

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'TUTOR_CREATED',
    'tutor',
    tutor.id,
    `Tutor ${tutor.name} (${tutor.tutorId}) created with initial credentials.`
  );

  dbManager.save();
  res.status(201).json({ tutor, tempPassword: tempPass });
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

  const {
    name,
    email,
    phone,
    specialization,
    designation,
    avatarUrl,
    status,
    assignedCourseIds,
    assignedBatchIds,
    permissions,
    notes,
  } = req.body;

  if (name) tutor.name = name.trim();
  if (email) tutor.email = email.trim().toLowerCase();
  if (phone !== undefined) tutor.phone = phone.trim();
  if (specialization) tutor.specialization = specialization.trim();
  if (designation !== undefined) tutor.designation = designation.trim();
  if (avatarUrl !== undefined) tutor.avatarUrl = avatarUrl;
  if (status) tutor.status = status;

  if (Array.isArray(assignedCourseIds)) {
    tutor.assignedCourseIds = assignedCourseIds;
    tutor.assignedCourseNames = db.courses
      .filter((c) => assignedCourseIds.includes(c.id))
      .map((c) => c.name);
  }

  if (Array.isArray(assignedBatchIds)) {
    tutor.assignedBatchIds = assignedBatchIds;
    tutor.assignedBatchNames = db.batches
      .filter((b) => assignedBatchIds.includes(b.id))
      .map((b) => b.name);
  }

  if (permissions && typeof permissions === 'object') {
    tutor.permissions = {
      ...(tutor.permissions || getDefaultTutorPermissions()),
      ...permissions,
    };
  }

  if (notes !== undefined) tutor.notes = notes.trim();

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'TUTOR_UPDATED',
    'tutor',
    tutor.id,
    `Tutor ${tutor.name} (${tutor.tutorId}) profile & permissions updated.`
  );

  dbManager.save();
  res.json({ tutor });
});

// Reset Tutor Password (Admin only)
apiRouter.post('/tutors/:id/reset-password', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const tutor = db.tutors.find((t) => t.id === req.params.id);
  if (!tutor) {
    res.status(404).json({ error: 'Tutor not found.' });
    return;
  }

  const tempPass = `Pass@${Math.floor(1000 + Math.random() * 9000)}`;
  const salt = crypto.randomBytes(16).toString('hex');
  tutor.salt = salt;
  tutor.passwordHash = hashPassword(tempPass, salt);
  tutor.tempPassword = tempPass;
  tutor.mustChangePassword = true;

  dbManager.queueEmail(
    tutor.email,
    tutor.name,
    'Your Temporary Password Reset - Kodewar LMS Tutor Portal',
    'tutor_password_reset',
    'delivered'
  );

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'TUTOR_PASSWORD_RESET',
    'tutor',
    tutor.id,
    `Password reset initiated for Tutor ${tutor.name} (${tutor.tutorId}).`
  );

  dbManager.save();
  res.json({ success: true, tempPassword: tempPass, message: `Password reset. Temporary password is: ${tempPass}` });
});

// Get Tutor Activity History (Admin & Tutor)
apiRouter.get('/tutors/:id/activity', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const tutor = db.tutors.find((t) => t.id === req.params.id);
  if (!tutor) {
    res.status(404).json({ error: 'Tutor not found.' });
    return;
  }

  // Security check: Tutor can only access their own activity unless user is admin
  if (req.user!.role === 'tutor' && req.user!.id !== tutor.id) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  const assignedBatchIds = new Set(tutor.assignedBatchIds || []);
  const assignedBatches = db.batches.filter((b) => b.tutorId === tutor.id || assignedBatchIds.has(b.id));
  const meetings = db.meetingSessions.filter((m) => m.tutorId === tutor.id || assignedBatchIds.has(m.batchId));
  const markedAttendanceCount = db.attendance.filter((a) => a.markedBy === tutor.name).length;
  const resourcesCount = db.resources.filter((r) => r.uploadedBy === tutor.name || r.uploadedBy === tutor.id).length;

  const totalCandidates = db.candidates.filter(
    (c) => assignedBatchIds.has(c.currentBatchId) && c.status !== 'archived'
  ).length;

  res.json({
    activity: {
      assignedBatchesCount: assignedBatches.length,
      assignedBatches,
      batches: assignedBatches,
      totalCandidates,
      totalMeetings: meetings.length,
      upcomingMeetings: meetings.filter((m) => m.status === 'scheduled'),
      completedMeetings: meetings.filter((m) => m.status === 'completed'),
      completedMeetingsCount: meetings.filter((m) => m.status === 'completed').length,
      markedAttendanceCount,
      attendanceSessionsMarked: markedAttendanceCount,
      resourcesCount,
    },
  });
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

// ==========================================
// 14. LEAVE MANAGEMENT API MODULE
// ==========================================

// --- Helper: Generate unique application number ---
function generateApplicationNumber(existingApplications: LeaveApplication[]): string {
  const currentYear = new Date().getFullYear();
  const yearPrefix = `LV-${currentYear}-`;
  const thisYearApps = existingApplications.filter((a) =>
    a.applicationNumber && a.applicationNumber.startsWith(yearPrefix)
  );
  let maxSeq = 0;
  for (const app of thisYearApps) {
    const seqPart = parseInt(app.applicationNumber.replace(yearPrefix, ''), 10);
    if (!isNaN(seqPart) && seqPart > maxSeq) {
      maxSeq = seqPart;
    }
  }
  const nextSeq = maxSeq + 1;
  return `${yearPrefix}${String(nextSeq).padStart(4, '0')}`;
}

// 1. Get Leave Types (Auth required - both Admin and Candidates)
apiRouter.get('/leave/types', requireAuth, (req, res) => {
  const db = dbManager.get();
  res.json({ leaveTypes: db.leaveTypes || [] });
});

// 2. Create Leave Type (Admin only)
apiRouter.post('/leave/types', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { name, code, description, isActive, requiresDocument, maxDaysPerYear, color } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Leave type name is required.' });
    return;
  }
  if (!code || !code.trim()) {
    res.status(400).json({ error: 'Leave type code is required (e.g. SICK, PERSONAL).' });
    return;
  }

  const db = dbManager.get();
  const normalizedCode = code.trim().toUpperCase();
  const exists = db.leaveTypes.some((t) => t.code.toUpperCase() === normalizedCode);
  if (exists) {
    res.status(400).json({ error: `A leave type with code "${normalizedCode}" already exists.` });
    return;
  }

  const newType: LeaveType = {
    id: `lt-${Date.now()}`,
    name: name.trim(),
    code: normalizedCode,
    description: description ? description.trim() : '',
    isActive: isActive !== false,
    requiresDocument: !!requiresDocument,
    maxDaysPerYear: typeof maxDaysPerYear === 'number' ? maxDaysPerYear : 12,
    color: color || 'blue',
    createdAt: new Date().toISOString(),
  };

  db.leaveTypes.push(newType);
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'LEAVE_TYPE_CREATED',
    'leave_type',
    newType.id,
    `Created leave type "${newType.name}" (${newType.code}).`
  );
  dbManager.save();
  res.status(201).json({ leaveType: newType });
});

// 3. Update Leave Type (Admin only)
apiRouter.put('/leave/types/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const index = db.leaveTypes.findIndex((t) => t.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Leave type not found.' });
    return;
  }

  const target = db.leaveTypes[index];
  const { name, code, description, isActive, requiresDocument, maxDaysPerYear, color } = req.body;

  if (name !== undefined) target.name = name.trim();
  if (code !== undefined) target.code = code.trim().toUpperCase();
  if (description !== undefined) target.description = description.trim();
  if (isActive !== undefined) target.isActive = !!isActive;
  if (requiresDocument !== undefined) target.requiresDocument = !!requiresDocument;
  if (maxDaysPerYear !== undefined) target.maxDaysPerYear = Number(maxDaysPerYear);
  if (color !== undefined) target.color = color;

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'LEAVE_TYPE_UPDATED',
    'leave_type',
    target.id,
    `Updated leave type "${target.name}".`
  );
  dbManager.save();
  res.json({ leaveType: target });
});

// 4. Delete / Deactivate Leave Type (Admin only)
apiRouter.delete('/leave/types/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const index = db.leaveTypes.findIndex((t) => t.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Leave type not found.' });
    return;
  }

  const target = db.leaveTypes[index];
  // Check if any leave applications use this leave type
  const inUse = db.leaveApplications.some((a) => a.leaveTypeId === target.id);
  if (inUse) {
    // If in use, soft-deactivate instead of breaking historical references
    target.isActive = false;
    dbManager.logAudit(
      req.user!.email,
      'admin',
      'LEAVE_TYPE_DEACTIVATED',
      'leave_type',
      target.id,
      `Deactivated leave type "${target.name}" because historical applications reference it.`
    );
    dbManager.save();
    res.json({
      success: true,
      message: `Leave type "${target.name}" has existing applications and was deactivated instead of deleted.`,
    });
    return;
  }

  db.leaveTypes.splice(index, 1);
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'LEAVE_TYPE_DELETED',
    'leave_type',
    target.id,
    `Deleted leave type "${target.name}".`
  );
  dbManager.save();
  res.json({ success: true, message: `Leave type "${target.name}" deleted successfully.` });
});

// 5. Get Leave Policy (Auth required)
apiRouter.get('/leave/policy', requireAuth, (req, res) => {
  const db = dbManager.get();
  res.json({ policy: db.leavePolicy });
});

// 6. Update Leave Policy (Admin only)
apiRouter.put('/leave/policy', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const { calculationMode, allowRetrospective, maxConsecutiveDays, requireAttachmentAboveDays } = req.body;

  if (calculationMode && !['calendar_days', 'working_days'].includes(calculationMode)) {
    res.status(400).json({ error: 'Invalid calculation mode. Must be "calendar_days" or "working_days".' });
    return;
  }

  db.leavePolicy = {
    calculationMode: calculationMode || db.leavePolicy.calculationMode || 'working_days',
    allowRetrospective: allowRetrospective !== undefined ? !!allowRetrospective : db.leavePolicy.allowRetrospective,
    maxConsecutiveDays: typeof maxConsecutiveDays === 'number' ? maxConsecutiveDays : (db.leavePolicy.maxConsecutiveDays || 30),
    requireAttachmentAboveDays: typeof requireAttachmentAboveDays === 'number' ? requireAttachmentAboveDays : (db.leavePolicy.requireAttachmentAboveDays || 2),
  };

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'LEAVE_POLICY_UPDATED',
    'policy',
    'leave-policy',
    `Updated leave calculation policy (mode: ${db.leavePolicy.calculationMode}, allowRetro: ${db.leavePolicy.allowRetrospective}).`
  );
  dbManager.save();
  res.json({ policy: db.leavePolicy });
});

// 7. Get All Leave Applications (Admin only with full filtering)
apiRouter.get('/leave/applications', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const { candidateId, courseId, batchId, leaveTypeId, status, startDate, endDate, search, applicantRole } = req.query;

  let apps = [...db.leaveApplications];

  // Helper filter checker
  const isValid = (v: any) => v && v !== 'all' && v !== 'undefined' && v !== 'null' && String(v).trim().length > 0;

  if (isValid(applicantRole)) {
    apps = apps.filter((a) => (a.applicantRole || 'candidate') === applicantRole);
  }
  if (isValid(candidateId)) {
    apps = apps.filter(
      (a) =>
        a.candidateId === candidateId ||
        a.candidateCustomId === candidateId ||
        a.tutorId === candidateId ||
        a.tutorCustomId === candidateId
    );
  }
  if (isValid(courseId)) {
    apps = apps.filter((a) => a.courseId === courseId);
  }
  if (isValid(batchId)) {
    apps = apps.filter((a) => a.batchId === batchId);
  }
  if (isValid(leaveTypeId)) {
    apps = apps.filter((a) => a.leaveTypeId === leaveTypeId);
  }
  if (isValid(status)) {
    apps = apps.filter((a) => a.status === status);
  }
  if (isValid(startDate)) {
    apps = apps.filter((a) => a.startDate >= String(startDate));
  }
  if (isValid(endDate)) {
    apps = apps.filter((a) => a.endDate <= String(endDate));
  }
  if (isValid(search)) {
    const q = String(search).toLowerCase().trim();
    apps = apps.filter(
      (a) =>
        a.applicationNumber.toLowerCase().includes(q) ||
        a.candidateName.toLowerCase().includes(q) ||
        a.candidateCustomId.toLowerCase().includes(q) ||
        (a.tutorCustomId && a.tutorCustomId.toLowerCase().includes(q)) ||
        a.candidateEmail.toLowerCase().includes(q) ||
        a.leaveTypeName.toLowerCase().includes(q) ||
        a.reason.toLowerCase().includes(q) ||
        (a.adminRemarks && a.adminRemarks.toLowerCase().includes(q))
    );
  }

  // Sort descending by appliedAt (most recent first)
  apps.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());

  // Aggregate stats across all leave applications in DB
  const allApps = db.leaveApplications;
  const summary = {
    total: allApps.length,
    pending: allApps.filter((a) => a.status === 'pending').length,
    approved: allApps.filter((a) => a.status === 'approved').length,
    rejected: allApps.filter((a) => a.status === 'rejected').length,
    cancelled: allApps.filter((a) => a.status === 'cancelled').length,
    totalApprovedDays: allApps
      .filter((a) => a.status === 'approved')
      .reduce((sum, a) => sum + (a.totalDays || 0), 0),
  };

  res.json({ applications: apps, summary });
});

// 8. Get Single Leave Application Details
apiRouter.get('/leave/applications/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const app = db.leaveApplications.find((a) => a.id === req.params.id);
  if (!app) {
    res.status(404).json({ error: 'Leave application not found.' });
    return;
  }

  // Security check: Candidate can ONLY access their own application
  if (req.user!.role === 'candidate' && app.candidateId !== req.user!.id) {
    res.status(403).json({ error: 'You are not authorized to view another candidate’s leave application.' });
    return;
  }

  // Security check: Tutor can ONLY access their own application
  if (
    req.user!.role === 'tutor' &&
    app.candidateId !== req.user!.id &&
    app.tutorId !== req.user!.id &&
    app.candidateEmail !== req.user!.email
  ) {
    res.status(403).json({ error: 'You are not authorized to view another user’s leave application.' });
    return;
  }

  res.json({ application: app });
});

// 9. Approve Leave Application (Admin only)
apiRouter.put('/leave/applications/:id/approve', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const app = db.leaveApplications.find((a) => a.id === req.params.id);
  if (!app) {
    res.status(404).json({ error: 'Leave application not found.' });
    return;
  }

  if (app.status === 'approved') {
    res.status(400).json({ error: 'This leave application is already approved.' });
    return;
  }

  const { remarks } = req.body;
  const now = new Date().toISOString();

  app.status = 'approved';
  if (remarks && remarks.trim()) {
    app.adminRemarks = remarks.trim();
  }
  app.updatedAt = now;

  // Append to status history
  app.history.unshift({
    id: `hist-${Date.now()}`,
    status: 'approved',
    changedBy: req.user!.email,
    changedByRole: 'admin',
    remarks: remarks?.trim() || undefined,
    timestamp: now,
  });

  // Candidate or Tutor In-App Notification
  const isTutorApp = app.applicantRole === 'tutor';
  db.notifications.unshift({
    id: `notif-${Date.now()}-${app.tutorId || app.candidateId}`,
    title: `Leave Application Approved (${app.applicationNumber})`,
    message: `Your ${app.leaveTypeName} request from ${app.startDate} to ${app.endDate} (${app.totalDays} day(s)) has been APPROVED by Super Admin.${remarks ? ` Remarks: ${remarks.trim()}` : ''}`,
    type: 'leave',
    targetAudience: isTutorApp ? 'tutor' : 'candidate',
    ...(isTutorApp ? { tutorId: app.tutorId || app.candidateId } : { candidateId: app.candidateId }),
    relatedEntity: { type: 'leave', id: app.id },
    createdAt: now,
    read: false,
  });

  // Email Notification
  dbManager.queueEmail(
    app.candidateEmail,
    app.candidateName,
    `Leave Application Approved - ${app.applicationNumber}`,
    'leave_approved',
    'delivered'
  );

  // Super Admin Audit Log
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'LEAVE_APPROVED',
    'leave',
    app.id,
    `Approved leave application ${app.applicationNumber} for ${isTutorApp ? 'instructor' : 'candidate'} ${app.candidateName} (${app.tutorCustomId || app.candidateCustomId}, ${app.totalDays} day(s)).`
  );

  dbManager.save();
  res.json({ application: app });
});

// 10. Reject Leave Application (Admin only - Mandatory Reason!)
apiRouter.put('/leave/applications/:id/reject', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { rejectionReason, remarks } = req.body;
  if (!rejectionReason || !rejectionReason.trim()) {
    res.status(400).json({ error: 'A mandatory rejection reason is required to reject a leave application.' });
    return;
  }

  const db = dbManager.get();
  const app = db.leaveApplications.find((a) => a.id === req.params.id);
  if (!app) {
    res.status(404).json({ error: 'Leave application not found.' });
    return;
  }

  if (app.status === 'rejected') {
    res.status(400).json({ error: 'This leave application is already rejected.' });
    return;
  }

  const now = new Date().toISOString();
  app.status = 'rejected';
  app.rejectionReason = rejectionReason.trim();
  if (remarks && remarks.trim()) {
    app.adminRemarks = remarks.trim();
  }
  app.updatedAt = now;

  // Append to status history
  app.history.unshift({
    id: `hist-${Date.now()}`,
    status: 'rejected',
    changedBy: req.user!.email,
    changedByRole: 'admin',
    reason: rejectionReason.trim(),
    remarks: remarks?.trim() || undefined,
    timestamp: now,
  });

  // Candidate or Tutor In-App Notification
  const isTutorReject = app.applicantRole === 'tutor';
  db.notifications.unshift({
    id: `notif-${Date.now()}-${app.tutorId || app.candidateId}`,
    title: `Leave Application Rejected (${app.applicationNumber})`,
    message: `Your ${app.leaveTypeName} application (${app.startDate} to ${app.endDate}) was REJECTED. Reason: ${rejectionReason.trim()}`,
    type: 'leave',
    targetAudience: isTutorReject ? 'tutor' : 'candidate',
    ...(isTutorReject ? { tutorId: app.tutorId || app.candidateId } : { candidateId: app.candidateId }),
    relatedEntity: { type: 'leave', id: app.id },
    createdAt: now,
    read: false,
  });

  // Email Notification
  dbManager.queueEmail(
    app.candidateEmail,
    app.candidateName,
    `Leave Application Rejected - ${app.applicationNumber}`,
    'leave_rejected',
    'delivered'
  );

  // Super Admin Audit Log
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'LEAVE_REJECTED',
    'leave',
    app.id,
    `Rejected leave application ${app.applicationNumber} for ${isTutorReject ? 'instructor' : 'candidate'} ${app.candidateName}. Reason: ${rejectionReason.trim()}`
  );

  dbManager.save();
  res.json({ application: app });
});

// 11. Revoke / Cancel Approved Leave Application (Admin only)
apiRouter.put('/leave/applications/:id/revoke', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { revokeReason, remarks } = req.body;
  if (!revokeReason || !revokeReason.trim()) {
    res.status(400).json({ error: 'A mandatory explanation is required to revoke an approved leave application.' });
    return;
  }

  const db = dbManager.get();
  const app = db.leaveApplications.find((a) => a.id === req.params.id);
  if (!app) {
    res.status(404).json({ error: 'Leave application not found.' });
    return;
  }

  if (app.status !== 'approved') {
    res.status(400).json({ error: 'Only previously approved leave applications can be revoked.' });
    return;
  }

  const now = new Date().toISOString();
  app.status = 'cancelled';
  app.adminRemarks = (app.adminRemarks ? `${app.adminRemarks} | ` : '') + `Revocation Note: ${revokeReason.trim()}`;
  app.updatedAt = now;

  // Append to status history
  app.history.unshift({
    id: `hist-${Date.now()}`,
    status: 'cancelled',
    changedBy: req.user!.email,
    changedByRole: 'admin',
    reason: revokeReason.trim(),
    remarks: remarks?.trim() || undefined,
    timestamp: now,
  });

  // Candidate or Tutor In-App Notification
  const isTutorRevoke = app.applicantRole === 'tutor';
  db.notifications.unshift({
    id: `notif-${Date.now()}-${app.tutorId || app.candidateId}`,
    title: `Approved Leave Revoked (${app.applicationNumber})`,
    message: `Your approved leave for ${app.startDate} to ${app.endDate} has been revoked by Administration. Reason: ${revokeReason.trim()}`,
    type: 'leave',
    targetAudience: isTutorRevoke ? 'tutor' : 'candidate',
    ...(isTutorRevoke ? { tutorId: app.tutorId || app.candidateId } : { candidateId: app.candidateId }),
    relatedEntity: { type: 'leave', id: app.id },
    createdAt: now,
    read: false,
  });

  // Email Notification
  dbManager.queueEmail(
    app.candidateEmail,
    app.candidateName,
    `Notice: Approved Leave Revoked - ${app.applicationNumber}`,
    'leave_revoked',
    'delivered'
  );

  // Super Admin Audit Log
  dbManager.logAudit(
    req.user!.email,
    'admin',
    'LEAVE_REVOKED',
    'leave',
    app.id,
    `Revoked approved leave application ${app.applicationNumber} for ${isTutorRevoke ? 'instructor' : 'candidate'} ${app.candidateName}. Reason: ${revokeReason.trim()}`
  );

  dbManager.save();
  res.json({ application: app });
});

// 12. Update Admin Remarks (Admin only)
apiRouter.put('/leave/applications/:id/remarks', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { remarks } = req.body;
  const db = dbManager.get();
  const app = db.leaveApplications.find((a) => a.id === req.params.id);
  if (!app) {
    res.status(404).json({ error: 'Leave application not found.' });
    return;
  }

  app.adminRemarks = remarks ? remarks.trim() : '';
  app.updatedAt = new Date().toISOString();

  dbManager.logAudit(
    req.user!.email,
    'admin',
    'LEAVE_REMARKS_UPDATED',
    'leave',
    app.id,
    `Updated remarks for leave application ${app.applicationNumber}.`
  );

  dbManager.save();
  res.json({ application: app });
});

// 13. Candidate: Get Own Leave Applications
apiRouter.get('/candidate/leave', requireCandidate, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const cand = req.user as CandidateUser;

  // Strict ownership isolation: ONLY return current candidate's applications
  const myApps = db.leaveApplications.filter((a) => a.candidateId === cand.id);

  // Sort descending by appliedAt
  myApps.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());

  const summary = {
    total: myApps.length,
    pending: myApps.filter((a) => a.status === 'pending').length,
    approved: myApps.filter((a) => a.status === 'approved').length,
    rejected: myApps.filter((a) => a.status === 'rejected').length,
    cancelled: myApps.filter((a) => a.status === 'cancelled').length,
    totalApprovedDays: myApps
      .filter((a) => a.status === 'approved')
      .reduce((sum, a) => sum + (a.totalDays || 0), 0),
  };

  res.json({ applications: myApps, summary });
});

// 14. Candidate: Apply for Leave
apiRouter.post('/candidate/leave', requireCandidate, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const cand = req.user as CandidateUser;

  // Verify candidate account is active
  if (cand.status === 'archived' || cand.status === 'inactive') {
    res.status(403).json({ error: 'Your account is inactive. Please contact administration to apply for leave.' });
    return;
  }

  const { leaveTypeId, startDate, endDate, reason, attachments } = req.body;

  // Validation 1: Required fields
  if (!leaveTypeId) {
    res.status(400).json({ error: 'Please select a leave type.' });
    return;
  }
  if (!reason || !reason.trim()) {
    res.status(400).json({ error: 'Please enter the reason for your leave application.' });
    return;
  }

  // Validation 2: Leave type exists and active
  const leaveType = db.leaveTypes.find((t) => t.id === leaveTypeId);
  if (!leaveType) {
    res.status(400).json({ error: 'Selected leave type was not found.' });
    return;
  }
  if (!leaveType.isActive) {
    res.status(400).json({ error: `The leave type "${leaveType.name}" is currently inactive.` });
    return;
  }

  // Validation 3: Date validity and retrospective check
  const dateValidation = validateLeaveDates(
    startDate,
    endDate,
    db.leavePolicy,
    db.settings.companyTimezone || 'Asia/Kolkata'
  );
  if (!dateValidation.isValid) {
    res.status(400).json({ error: dateValidation.error });
    return;
  }

  // Validation 4: Calculate total leave days
  const totalDays = calculateLeaveDays(startDate, endDate, db.leavePolicy.calculationMode || 'working_days');
  if (totalDays <= 0) {
    res.status(400).json({
      error: `The selected date range (${startDate} to ${endDate}) yields 0 days under the current company policy (${db.leavePolicy.calculationMode === 'working_days' ? 'working days excluding weekends' : 'calendar days'}).`,
    });
    return;
  }

  // Validation 5: Overlap check with candidate's existing pending or approved applications
  const candExistingApps = db.leaveApplications.filter((a) => a.candidateId === cand.id);
  const overlapCheck = checkLeaveOverlap(startDate, endDate, candExistingApps);
  if (overlapCheck.hasOverlap && overlapCheck.overlappingApp) {
    const opp = overlapCheck.overlappingApp;
    res.status(400).json({
      error: `Overlapping leave request detected: You already have a ${opp.status.toUpperCase()} leave application (${opp.applicationNumber} from ${opp.startDate} to ${opp.endDate}) during this period.`,
    });
    return;
  }

  // Validation 6: Supporting document requirement
  const sanitizedAttachments: any[] = Array.isArray(attachments) ? attachments : [];
  if (leaveType.requiresDocument && sanitizedAttachments.length === 0) {
    res.status(400).json({
      error: `Supporting documentation is mandatory for "${leaveType.name}". Please attach supporting documents.`,
    });
    return;
  }
  if (
    db.leavePolicy.requireAttachmentAboveDays > 0 &&
    totalDays > db.leavePolicy.requireAttachmentAboveDays &&
    sanitizedAttachments.length === 0
  ) {
    res.status(400).json({
      error: `Company policy requires a supporting document for leave requests exceeding ${db.leavePolicy.requireAttachmentAboveDays} days.`,
    });
    return;
  }

  // Fetch course and batch details
  const course = db.courses.find((c) => c.id === cand.courseId);
  const batch = db.batches.find((b) => b.id === cand.currentBatchId);

  const applicationNumber = generateApplicationNumber(db.leaveApplications);
  const now = new Date().toISOString();

  const newApp: LeaveApplication = {
    id: `leave-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    applicationNumber,
    candidateId: cand.id,
    candidateCustomId: cand.candidateId,
    candidateName: cand.name,
    candidateEmail: cand.email,
    courseId: cand.courseId,
    courseName: course?.name || 'General Course',
    batchId: cand.currentBatchId,
    batchName: batch?.name || 'General Batch',
    leaveTypeId: leaveType.id,
    leaveTypeName: leaveType.name,
    startDate,
    endDate,
    totalDays,
    reason: reason.trim(),
    status: 'pending',
    attachments: sanitizedAttachments.map((att: any) => ({
      id: att.id || `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fileName: att.fileName || 'document',
      fileSize: Number(att.fileSize) || 0,
      mimeType: att.mimeType || 'application/octet-stream',
      dataUrl: att.dataUrl || '',
      uploadedAt: now,
    })),
    history: [
      {
        id: `hist-${Date.now()}`,
        status: 'pending',
        changedBy: cand.email,
        changedByRole: 'candidate',
        reason: 'Application submitted by candidate',
        timestamp: now,
      },
    ],
    appliedAt: now,
    updatedAt: now,
  };

  db.leaveApplications.unshift(newApp);

  // In-app Notification for Super Admin
  db.notifications.unshift({
    id: `notif-${Date.now()}-admin-leave`,
    title: `New Leave Application: ${cand.name}`,
    message: `${cand.name} (${cand.candidateId}) submitted a ${leaveType.name} application for ${startDate} to ${endDate} (${totalDays} day(s)).`,
    type: 'leave',
    targetAudience: 'all',
    relatedEntity: { type: 'leave', id: newApp.id },
    createdAt: now,
    read: false,
  });

  // Email Notification to Super Admin
  dbManager.queueEmail(
    db.admin.email,
    db.admin.name,
    `New Leave Application: ${cand.name} (${newApp.applicationNumber})`,
    'leave_submitted',
    'delivered'
  );

  // Audit Log
  dbManager.logAudit(
    cand.email,
    'candidate',
    'LEAVE_APPLICATION_SUBMITTED',
    'leave',
    newApp.id,
    `Candidate ${cand.name} (${cand.candidateId}) submitted leave application ${newApp.applicationNumber} (${startDate} to ${endDate}, ${totalDays} days).`
  );

  dbManager.save();
  res.status(201).json({ application: newApp });
});

// 15. Candidate: Cancel Pending Leave Application
apiRouter.put('/candidate/leave/:id/cancel', requireCandidate, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const cand = req.user as CandidateUser;
  const app = db.leaveApplications.find((a) => a.id === req.params.id);

  if (!app) {
    res.status(404).json({ error: 'Leave application not found.' });
    return;
  }

  // Security check: Candidate can ONLY cancel their own application
  if (app.candidateId !== cand.id) {
    res.status(403).json({ error: 'You are not authorized to cancel this application.' });
    return;
  }

  // Only PENDING applications can be self-cancelled by candidate
  if (app.status !== 'pending') {
    res.status(400).json({
      error: `Cannot cancel application with status "${app.status.toUpperCase()}". Only Pending applications can be self-cancelled.`,
    });
    return;
  }

  const { cancelReason } = req.body;
  const now = new Date().toISOString();

  app.status = 'cancelled';
  app.updatedAt = now;

  app.history.unshift({
    id: `hist-${Date.now()}`,
    status: 'cancelled',
    changedBy: cand.email,
    changedByRole: 'candidate',
    reason: cancelReason ? cancelReason.trim() : 'Cancelled by candidate',
    timestamp: now,
  });

  // Admin In-App Notification
  db.notifications.unshift({
    id: `notif-${Date.now()}-admin-leave-cancel`,
    title: `Leave Cancelled by Candidate: ${cand.name}`,
    message: `${cand.name} (${cand.candidateId}) cancelled pending leave application ${app.applicationNumber} (${app.startDate} to ${app.endDate}).`,
    type: 'leave',
    targetAudience: 'all',
    relatedEntity: { type: 'leave', id: app.id },
    createdAt: now,
    read: false,
  });

  // Admin Email Notification
  dbManager.queueEmail(
    db.admin.email,
    db.admin.name,
    `Leave Application Cancelled: ${cand.name} (${app.applicationNumber})`,
    'leave_cancelled',
    'delivered'
  );

  // Audit Log
  dbManager.logAudit(
    cand.email,
    'candidate',
    'LEAVE_APPLICATION_CANCELLED',
    'leave',
    app.id,
    `Candidate ${cand.name} (${cand.candidateId}) cancelled pending leave application ${app.applicationNumber}.`
  );

  dbManager.save();
  res.json({ application: app });
});

// 16. Leave Reports & Analytics (Admin only)
apiRouter.get('/leave/reports', requireAdmin, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const allApps = db.leaveApplications;

  // Breakdown by Leave Type
  const byType: Record<string, { name: string; count: number; approvedDays: number; color: string }> = {};
  for (const t of db.leaveTypes) {
    byType[t.id] = { name: t.name, count: 0, approvedDays: 0, color: t.color || 'blue' };
  }
  for (const a of allApps) {
    if (!byType[a.leaveTypeId]) {
      byType[a.leaveTypeId] = { name: a.leaveTypeName, count: 0, approvedDays: 0, color: 'slate' };
    }
    byType[a.leaveTypeId].count++;
    if (a.status === 'approved') {
      byType[a.leaveTypeId].approvedDays += a.totalDays || 0;
    }
  }

  // Breakdown by Status
  const byStatus = {
    pending: allApps.filter((a) => a.status === 'pending').length,
    approved: allApps.filter((a) => a.status === 'approved').length,
    rejected: allApps.filter((a) => a.status === 'rejected').length,
    cancelled: allApps.filter((a) => a.status === 'cancelled').length,
  };

  // Breakdown by Batch
  const byBatch: Record<string, { batchName: string; courseName: string; totalApps: number; approvedDays: number }> = {};
  for (const b of db.batches) {
    byBatch[b.id] = { batchName: b.name, courseName: b.courseName || '', totalApps: 0, approvedDays: 0 };
  }
  for (const a of allApps) {
    if (byBatch[a.batchId]) {
      byBatch[a.batchId].totalApps++;
      if (a.status === 'approved') {
        byBatch[a.batchId].approvedDays += a.totalDays || 0;
      }
    }
  }

  // Top candidates with leave
  const candidateLeaveMap: Record<string, { candidateName: string; candidateCustomId: string; totalDays: number; appCount: number }> = {};
  for (const a of allApps) {
    if (a.status === 'approved') {
      if (!candidateLeaveMap[a.candidateId]) {
        candidateLeaveMap[a.candidateId] = {
          candidateName: a.candidateName,
          candidateCustomId: a.candidateCustomId,
          totalDays: 0,
          appCount: 0,
        };
      }
      candidateLeaveMap[a.candidateId].totalDays += a.totalDays || 0;
      candidateLeaveMap[a.candidateId].appCount++;
    }
  }

  const topCandidates = Object.values(candidateLeaveMap)
    .sort((a, b) => b.totalDays - a.totalDays)
    .slice(0, 10);

  res.json({
    reports: {
      totalApplications: allApps.length,
      totalApprovedDays: allApps
        .filter((a) => a.status === 'approved')
        .reduce((sum, a) => sum + (a.totalDays || 0), 0),
      byStatus,
      byType: Object.values(byType),
      byBatch: Object.values(byBatch).filter((b) => b.totalApps > 0),
      topCandidates,
    },
  });
});

// ==========================================
// 15. TUTOR PORTAL API MODULE
// ==========================================

// Helper to get fresh Tutor entity and assigned batch set
function getTutorContext(tutorId: string) {
  const db = dbManager.get();
  const tut = db.tutors.find((t) => t.id === tutorId);
  const assignedBatchIds = new Set(tut?.assignedBatchIds || []);

  // If no specific batch assignments are set, default to batches of assigned courses
  if (assignedBatchIds.size === 0 && tut?.assignedCourseIds && tut.assignedCourseIds.length > 0) {
    for (const b of db.batches) {
      if (tut.assignedCourseIds.includes(b.courseId)) {
        assignedBatchIds.add(b.id);
      }
    }
  }

  // Also include batches where batch.tutorId === tutorId
  for (const b of db.batches) {
    if (b.tutorId === tutorId) {
      assignedBatchIds.add(b.id);
    }
  }
  return { db, tut, assignedBatchIds };
}

// 1. Tutor Dashboard: Real-time statistics derived strictly from actual assigned records
apiRouter.get('/tutor/dashboard', requireTutor, (req: AuthenticatedRequest, res) => {
  const { db, tut, assignedBatchIds } = getTutorContext(req.user!.id);
  if (!tut) {
    res.status(404).json({ error: 'Tutor account not found.' });
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Assigned Batches
  const assignedBatches = db.batches.filter((b) => assignedBatchIds.has(b.id));

  // 2. Candidates in assigned batches
  const candidates = db.candidates.filter(
    (c) => assignedBatchIds.has(c.currentBatchId) && c.status !== 'archived'
  );

  // 3. Meetings for this tutor or assigned batches
  const meetings = db.meetingSessions.filter(
    (m) => m.tutorId === tut.id || assignedBatchIds.has(m.batchId)
  );

  const upcomingMeetings = meetings
    .filter((m) => m.status === 'scheduled' && m.date >= todayStr)
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  const completedMeetings = meetings.filter((m) => m.status === 'completed');

  // 4. Pending/Unmarked Attendance Sessions (within past 7 days up to today)
  const recentPastSessions = meetings.filter(
    (m) => m.date <= todayStr && (m.status === 'completed' || m.status === 'scheduled')
  );
  const unmarkedSessions = recentPastSessions.filter((s) => {
    const records = db.attendance.filter((a) => a.sessionId === s.id);
    return records.length === 0;
  });

  // 5. Relevant Resources
  const relevantResources = db.resources.filter((r) => {
    if (r.status !== 'published') return false;
    if (r.audience === 'all') return true;
    if (r.audience === 'course' && tut.assignedCourseIds?.includes(r.courseId || '')) return true;
    if (r.audience === 'batch' && assignedBatchIds.has(r.batchId || '')) return true;
    return false;
  });

  // 6. Notifications for this tutor
  const notifications = db.notifications.filter((n) => {
    if (n.targetAudience === 'all') return true;
    if (n.targetAudience === 'tutor' && (n.tutorId === tut.id || !n.tutorId)) return true;
    if (n.targetAudience === 'batch' && assignedBatchIds.has(n.batchId || '')) return true;
    if (n.targetAudience === 'course' && tut.assignedCourseIds?.includes(n.courseId || '')) return true;
    return false;
  });

  const dashboardPayload = {
    tutor: {
      id: tut.id,
      tutorId: tut.tutorId,
      name: tut.name,
      email: tut.email,
      phone: tut.phone,
      specialization: tut.specialization,
      designation: tut.designation || 'Instructor',
      avatarUrl: tut.avatarUrl || '',
      permissions: tut.permissions || getDefaultTutorPermissions(),
      status: tut.status,
    },
    counts: {
      assignedBatches: assignedBatches.length,
      totalCandidates: candidates.length,
      upcomingMeetings: upcomingMeetings.length,
      completedMeetings: completedMeetings.length,
      unmarkedSessions: unmarkedSessions.length,
      resourcesCount: relevantResources.length,
      unreadNotifications: notifications.filter((n) => !n.read).length,
    },
    stats: {
      assignedBatchesCount: assignedBatches.length,
      totalCandidates: candidates.length,
      upcomingMeetingsCount: upcomingMeetings.length,
      completedMeetingsCount: completedMeetings.length,
      pendingAttendanceCount: unmarkedSessions.length,
      totalResourcesCount: relevantResources.length,
    },
    assignedBatches,
    nextSession: upcomingMeetings[0] || null,
    upcomingMeetings: upcomingMeetings.slice(0, 5),
    recentMeetings: completedMeetings.slice(0, 5),
    unmarkedSessions: unmarkedSessions.slice(0, 5),
    recentResources: relevantResources.slice(0, 4),
    recentNotifications: notifications.slice(0, 5),
    notifications: notifications.slice(0, 5),
  };

  res.json({
    dashboard: dashboardPayload,
    ...dashboardPayload,
  });
});

// 2. Tutor Batches: View assigned batches with candidate roster
apiRouter.get('/tutor/batches', requireTutor, (req: AuthenticatedRequest, res) => {
  const { db, assignedBatchIds } = getTutorContext(req.user!.id);
  const batches = db.batches.filter((b) => assignedBatchIds.has(b.id));

  const enriched = batches.map((b) => {
    const roster = db.candidates.filter(
      (c) => c.currentBatchId === b.id && c.status !== 'archived'
    ).map((c) => ({
      id: c.id,
      candidateId: c.candidateId,
      name: c.name,
      email: c.email,
      phone: c.phone,
      enrollmentDate: c.enrollmentDate,
      status: c.status,
    }));

    const meetingCount = db.meetingSessions.filter((m) => m.batchId === b.id).length;

    return {
      ...b,
      candidateCount: roster.length,
      roster,
      meetingCount,
    };
  });

  res.json({ batches: enriched });
});

// 3. Tutor Single Batch Details
apiRouter.get('/tutor/batches/:id', requireTutor, (req: AuthenticatedRequest, res) => {
  const { db, assignedBatchIds } = getTutorContext(req.user!.id);

  if (!assignedBatchIds.has(req.params.id)) {
    res.status(403).json({ error: 'You are not assigned to this batch.' });
    return;
  }

  const batch = db.batches.find((b) => b.id === req.params.id);
  if (!batch) {
    res.status(404).json({ error: 'Batch not found.' });
    return;
  }

  const roster = db.candidates.filter(
    (c) => c.currentBatchId === batch.id && c.status !== 'archived'
  ).map((c) => {
    const attendanceRecords = db.attendance.filter((a) => a.candidateId === c.id);
    const presentCount = attendanceRecords.filter((a) => a.status === 'present').length;
    const lateCount = attendanceRecords.filter((a) => a.status === 'late').length;
    const absentCount = attendanceRecords.filter((a) => a.status === 'absent').length;

    return {
      id: c.id,
      candidateId: c.candidateId,
      name: c.name,
      email: c.email,
      phone: c.phone,
      enrollmentDate: c.enrollmentDate,
      status: c.status,
      attendanceStats: {
        total: attendanceRecords.length,
        presentCount,
        lateCount,
        absentCount,
      },
    };
  });

  const meetings = db.meetingSessions
    .filter((m) => m.batchId === batch.id)
    .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));

  const resources = db.resources.filter(
    (r) => r.status === 'published' && (r.batchId === batch.id || (r.courseId === batch.courseId && r.audience === 'course'))
  );

  res.json({ batch, roster, meetings, resources });
});

// 4. Tutor Meetings
apiRouter.get('/tutor/meetings', requireTutor, (req: AuthenticatedRequest, res) => {
  const { db, tut, assignedBatchIds } = getTutorContext(req.user!.id);
  const { batchId, status, date } = req.query;

  let meetings = db.meetingSessions.filter(
    (m) => m.tutorId === tut!.id || assignedBatchIds.has(m.batchId)
  );

  if (batchId && batchId !== 'all') {
    meetings = meetings.filter((m) => m.batchId === batchId);
  }
  if (status && status !== 'all') {
    meetings = meetings.filter((m) => m.status === status);
  }
  if (date) {
    meetings = meetings.filter((m) => m.date === date);
  }

  meetings.sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));

  const canViewLinks = tut?.permissions?.canViewMeetingLinks !== false;

  // Mask meeting link if tutor lacks link visibility permission
  const safeMeetings = meetings.map((m) => ({
    ...m,
    meetingUrl: canViewLinks ? m.meetingUrl : undefined,
  }));

  res.json({ meetings: safeMeetings });
});

// 5. Tutor Toggle Meeting Access (Only if Super Admin granted permission)
apiRouter.put('/tutor/meetings/:id/access', requireTutor, (req: AuthenticatedRequest, res) => {
  const { db, tut, assignedBatchIds } = getTutorContext(req.user!.id);

  if (!tut?.permissions?.canManageMeetingAccess) {
    res.status(403).json({
      error: 'Meeting access control is restricted to Super Admin. You do not have permission to enable/disable meeting links.',
    });
    return;
  }

  const meeting = db.meetingSessions.find((m) => m.id === req.params.id);
  if (!meeting) {
    res.status(404).json({ error: 'Meeting not found.' });
    return;
  }

  if (meeting.tutorId !== tut.id && !assignedBatchIds.has(meeting.batchId)) {
    res.status(403).json({ error: 'You are not assigned to this meeting.' });
    return;
  }

  const { accessStatus } = req.body;
  if (!['enabled', 'disabled'].includes(accessStatus)) {
    res.status(400).json({ error: 'accessStatus must be "enabled" or "disabled".' });
    return;
  }

  meeting.accessStatus = accessStatus;
  meeting.accessEnabledAt = accessStatus === 'enabled' ? new Date().toISOString() : undefined;

  dbManager.logAudit(
    tut.email,
    'tutor',
    'TUTOR_MEETING_ACCESS_CHANGED',
    'meeting',
    meeting.id,
    `Tutor ${tut.name} set meeting access to ${accessStatus.toUpperCase()} for "${meeting.title}".`
  );

  dbManager.save();
  res.json({ session: meeting });
});

// 6. Tutor Session Attendance Roster
apiRouter.get('/tutor/attendance/session/:sessionId', requireTutor, (req: AuthenticatedRequest, res) => {
  const { db, tut, assignedBatchIds } = getTutorContext(req.user!.id);

  const session = db.meetingSessions.find((m) => m.id === req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Meeting session not found.' });
    return;
  }

  if (session.tutorId !== tut!.id && !assignedBatchIds.has(session.batchId)) {
    res.status(403).json({ error: 'You are not authorized for this meeting session.' });
    return;
  }

  const candidates = db.candidates.filter(
    (c) => c.currentBatchId === session.batchId && c.status !== 'archived'
  );

  const existingRecords = db.attendance.filter((a) => a.sessionId === session.id);
  const recordsMap = new Map(existingRecords.map((r) => [r.candidateId, r]));

  const roster = candidates.map((cand) => {
    const existing = recordsMap.get(cand.id);
    return {
      candidateId: cand.id,
      candidateCustomId: cand.candidateId,
      name: cand.name,
      email: cand.email,
      phone: cand.phone,
      status: existing ? existing.status : 'unmarked',
      remarks: existing ? existing.remarks : '',
      recordId: existing ? existing.id : null,
      markedAt: existing ? existing.markedAt : null,
      markedBy: existing ? existing.markedBy : null,
    };
  });

  const present = existingRecords.filter((r) => r.status === 'present').length;
  const absent = existingRecords.filter((r) => r.status === 'absent').length;
  const late = existingRecords.filter((r) => r.status === 'late').length;
  const excused = existingRecords.filter((r) => r.status === 'excused').length;
  const unmarked = Math.max(0, candidates.length - existingRecords.length);

  const windowHours = tut?.permissions?.attendanceEditWindowHours || 48;
  const meetingDateObj = new Date(`${session.date}T${session.endTime || '23:59'}`);
  const hoursSinceSession = (Date.now() - meetingDateObj.getTime()) / (1000 * 60 * 60);
  const isWindowExpired = hoursSinceSession > windowHours;

  res.json({
    session,
    batch: db.batches.find((b) => b.id === session.batchId) || null,
    roster,
    attendance: existingRecords,
    summary: {
      total: candidates.length,
      present,
      absent,
      late,
      excused,
      unmarked,
    },
    canRecordAttendance: !!tut?.permissions?.canRecordAttendance,
    canEditAttendance: !!tut?.permissions?.canEditAttendance,
    isWindowExpired,
    windowHours,
    permissions: {
      canRecordAttendance: !!tut?.permissions?.canRecordAttendance,
      canEditAttendance: !!tut?.permissions?.canEditAttendance,
      attendanceEditWindowHours: windowHours,
    },
  });
});

// 7. Tutor Mark Attendance
apiRouter.post('/tutor/attendance/mark', requireTutor, (req: AuthenticatedRequest, res) => {
  const { db, tut, assignedBatchIds } = getTutorContext(req.user!.id);

  if (!tut?.permissions?.canRecordAttendance) {
    res.status(403).json({
      error: 'Attendance recording permission is not enabled for your account by Super Admin.',
    });
    return;
  }

  const { sessionId, records } = req.body;
  if (!sessionId || !Array.isArray(records)) {
    res.status(400).json({ error: 'sessionId and records array are required.' });
    return;
  }

  const session = db.meetingSessions.find((m) => m.id === sessionId);
  if (!session) {
    res.status(404).json({ error: 'Meeting session not found.' });
    return;
  }

  if (session.tutorId !== tut.id && !assignedBatchIds.has(session.batchId)) {
    res.status(403).json({ error: 'You are not authorized to mark attendance for this session.' });
    return;
  }

  const now = new Date().toISOString();
  let markedCount = 0;
  const markedRecords: any[] = [];

  for (const item of records) {
    if (!item.candidateId || !item.status) continue;
    const existingIndex = db.attendance.findIndex(
      (a) => a.sessionId === sessionId && a.candidateId === item.candidateId
    );

    const cand = db.candidates.find((c) => c.id === item.candidateId);

    if (existingIndex !== -1) {
      // If already marked, check if tutor has edit permission
      if (!tut.permissions?.canEditAttendance) {
        continue;
      }
      db.attendance[existingIndex].status = item.status;
      db.attendance[existingIndex].remarks = item.remarks || '';
      db.attendance[existingIndex].updatedAt = now;
      db.attendance[existingIndex].markedBy = tut.name;
      markedRecords.push(db.attendance[existingIndex]);
    } else {
      const newRec = {
        id: `att-${Date.now()}-${item.candidateId}`,
        sessionId,
        sessionTitle: session.title,
        sessionDate: session.date,
        candidateId: item.candidateId,
        candidateName: cand?.name,
        candidateCustomId: cand?.candidateId,
        status: item.status,
        remarks: item.remarks || '',
        markedAt: now,
        markedBy: tut.name,
      };
      db.attendance.push(newRec);
      markedRecords.push(newRec);
      markedCount++;
    }
  }

  dbManager.logAudit(
    tut.email,
    'tutor',
    'TUTOR_ATTENDANCE_MARKED',
    'attendance',
    sessionId,
    `Tutor ${tut.name} marked roll call for session "${session.title}" (${session.date}).`
  );

  dbManager.save();
  res.json({ success: true, count: markedCount, markedCount, records: markedRecords });
});

// 8. Tutor Correct Attendance (Subject to Allowed Edit Window)
apiRouter.put('/tutor/attendance/:id/correct', requireTutor, (req: AuthenticatedRequest, res) => {
  const { db, tut, assignedBatchIds } = getTutorContext(req.user!.id);

  if (!tut?.permissions?.canEditAttendance) {
    res.status(403).json({
      error: 'Attendance modification permission is not enabled for your account by Super Admin.',
    });
    return;
  }

  const record = db.attendance.find((a) => a.id === req.params.id);
  if (!record) {
    res.status(404).json({ error: 'Attendance record not found.' });
    return;
  }

  const session = db.meetingSessions.find((m) => m.id === record.sessionId);
  if (!session || (session.tutorId !== tut.id && !assignedBatchIds.has(session.batchId))) {
    res.status(403).json({ error: 'You are not authorized for this session.' });
    return;
  }

  const { status, remarks, correctionReason } = req.body;
  if (!correctionReason || !correctionReason.trim()) {
    res.status(400).json({ error: 'A mandatory correction reason is required.' });
    return;
  }

  // Check editing period window constraint
  const windowHours = tut.permissions?.attendanceEditWindowHours || 48;
  const sessionTime = new Date(`${session.date}T${session.startTime || '00:00'}`).getTime();
  const diffHours = (Date.now() - sessionTime) / (1000 * 60 * 60);

  if (diffHours > windowHours) {
    res.status(400).json({
      error: `The allowed attendance modification period (${windowHours} hours) has expired for this session. Please contact Super Admin for historical corrections.`,
    });
    return;
  }

  record.status = status;
  record.remarks = remarks !== undefined ? remarks : record.remarks;
  record.correctionReason = correctionReason.trim();
  record.updatedAt = new Date().toISOString();
  record.markedBy = `${tut.name} (corrected)`;

  dbManager.logAudit(
    tut.email,
    'tutor',
    'TUTOR_ATTENDANCE_CORRECTED',
    'attendance',
    record.id,
    `Tutor ${tut.name} corrected attendance for ${record.candidateName}. Reason: ${correctionReason.trim()}`
  );

  dbManager.save();
  res.json({ record });
});

// 9. Tutor Learning Resources
apiRouter.get('/tutor/resources', requireTutor, (req: AuthenticatedRequest, res) => {
  const { db, tut, assignedBatchIds } = getTutorContext(req.user!.id);
  const { category, batchId } = req.query;

  let resources = db.resources.filter((r) => {
    if (r.status !== 'published') return false;
    if (r.audience === 'all') return true;
    if (r.audience === 'course' && tut!.assignedCourseIds?.includes(r.courseId || '')) return true;
    if (r.audience === 'batch' && assignedBatchIds.has(r.batchId || '')) return true;
    return false;
  });

  if (category && category !== 'all') {
    resources = resources.filter((r) => r.category === category);
  }
  if (batchId && batchId !== 'all') {
    resources = resources.filter((r) => r.batchId === batchId);
  }

  res.json({
    resources,
    permissions: {
      canUploadResources: !!tut?.permissions?.canUploadResources,
      canManageOwnResources: !!tut?.permissions?.canManageOwnResources,
    },
  });
});

// 10. Tutor Upload Learning Resource
apiRouter.post('/tutor/resources', requireTutor, (req: AuthenticatedRequest, res) => {
  const { db, tut, assignedBatchIds } = getTutorContext(req.user!.id);

  if (!tut?.permissions?.canUploadResources) {
    res.status(403).json({
      error: 'Resource upload permission is not enabled for your account by Super Admin.',
    });
    return;
  }

  const { title, description, category, type, url, fileName, fileSize, mimeType, courseId, batchId, audience } = req.body;
  if (!title || !url || !category) {
    res.status(400).json({ error: 'Title, category, and document URL are required.' });
    return;
  }

  // Validate audience assignment
  if (batchId && !assignedBatchIds.has(batchId)) {
    res.status(403).json({ error: 'You can only upload resources to your assigned batches.' });
    return;
  }
  if (courseId && !tut.assignedCourseIds?.includes(courseId)) {
    res.status(403).json({ error: 'You can only upload resources to your assigned courses.' });
    return;
  }

  const course = db.courses.find((c) => c.id === courseId);
  const batch = db.batches.find((b) => b.id === batchId);

  const resource: ResourceItem = {
    id: `res-${Date.now()}`,
    title: title.trim(),
    description: description ? description.trim() : '',
    category,
    type: type || 'file',
    url: url.trim(),
    fileName,
    fileSize,
    mimeType,
    courseId,
    courseName: course?.name,
    batchId,
    batchName: batch?.name,
    audience: audience || (batchId ? 'batch' : courseId ? 'course' : 'all'),
    status: 'published',
    uploadedBy: tut.name,
    createdAt: new Date().toISOString(),
  };

  db.resources.unshift(resource);

  dbManager.logAudit(
    tut.email,
    'tutor',
    'TUTOR_RESOURCE_UPLOADED',
    'resource',
    resource.id,
    `Tutor ${tut.name} uploaded learning material "${resource.title}".`
  );

  dbManager.save();
  res.status(201).json({ resource });
});

// 11. Tutor Delete Own Resource
apiRouter.delete('/tutor/resources/:id', requireTutor, (req: AuthenticatedRequest, res) => {
  const { db, tut } = getTutorContext(req.user!.id);

  if (!tut?.permissions?.canManageOwnResources) {
    res.status(403).json({
      error: 'Resource deletion permission is not enabled for your account by Super Admin.',
    });
    return;
  }

  const index = db.resources.findIndex((r) => r.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Resource not found.' });
    return;
  }

  const resource = db.resources[index];
  // Security restriction: Tutors can never delete Super Admin resources
  if (resource.uploadedBy !== tut.name && resource.uploadedBy !== tut.id) {
    res.status(403).json({
      error: 'You are only authorized to delete learning resources uploaded by yourself.',
    });
    return;
  }

  db.resources.splice(index, 1);
  dbManager.logAudit(
    tut.email,
    'tutor',
    'TUTOR_RESOURCE_DELETED',
    'resource',
    resource.id,
    `Tutor ${tut.name} removed own resource "${resource.title}".`
  );

  dbManager.save();
  res.json({ success: true, message: 'Resource removed successfully.' });
});

// 12. Tutor Notifications
apiRouter.get('/tutor/notifications', requireTutor, (req: AuthenticatedRequest, res) => {
  const { db, tut, assignedBatchIds } = getTutorContext(req.user!.id);

  const notifications = db.notifications.filter((n) => {
    if (n.targetAudience === 'all') return true;
    if (n.targetAudience === 'tutor' && (n.tutorId === tut!.id || !n.tutorId)) return true;
    if (n.targetAudience === 'batch' && assignedBatchIds.has(n.batchId || '')) return true;
    if (n.targetAudience === 'course' && tut!.assignedCourseIds?.includes(n.courseId || '')) return true;
    return false;
  });

  res.json({ notifications });
});

apiRouter.put('/tutor/notifications/:id/read', requireTutor, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const notif = db.notifications.find((n) => n.id === req.params.id);
  if (notif) {
    notif.read = true;
    dbManager.save();
  }
  res.json({ success: true });
});

apiRouter.put('/tutor/notifications/read-all', requireTutor, (req: AuthenticatedRequest, res) => {
  const { db, tut, assignedBatchIds } = getTutorContext(req.user!.id);
  db.notifications.forEach((n) => {
    if (
      n.targetAudience === 'all' ||
      (n.targetAudience === 'tutor' && (n.tutorId === tut!.id || !n.tutorId)) ||
      (n.targetAudience === 'batch' && assignedBatchIds.has(n.batchId || '')) ||
      (n.targetAudience === 'course' && tut!.assignedCourseIds?.includes(n.courseId || ''))
    ) {
      n.read = true;
    }
  });
  dbManager.save();
  res.json({ success: true });
});

// 13. Tutor Profile View & Update
apiRouter.get('/tutor/profile', requireTutor, (req: AuthenticatedRequest, res) => {
  const { tut } = getTutorContext(req.user!.id);
  if (!tut) {
    res.status(404).json({ error: 'Tutor account not found.' });
    return;
  }
  res.json({ profile: tut, tutor: tut });
});

apiRouter.put('/tutor/profile', requireTutor, (req: AuthenticatedRequest, res) => {
  const { db, tut } = getTutorContext(req.user!.id);
  if (!tut) {
    res.status(404).json({ error: 'Tutor account not found.' });
    return;
  }

  const { phone, specialization, designation, avatarUrl } = req.body;
  if (phone !== undefined) tut.phone = String(phone).trim();
  if (specialization !== undefined) tut.specialization = String(specialization).trim();
  if (designation !== undefined) tut.designation = String(designation).trim();
  if (avatarUrl !== undefined) tut.avatarUrl = String(avatarUrl).trim();

  dbManager.logAudit(
    tut.email,
    'tutor',
    'TUTOR_PROFILE_UPDATED',
    'tutor',
    tut.id,
    `Tutor ${tut.name} updated their personal profile settings.`
  );

  dbManager.save();
  res.json({ profile: tut, tutor: tut });
});

// 14. Tutor Leave Management Module
apiRouter.get('/tutor/leave', requireTutor, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const tutorId = req.user!.id;
  const tutorEmail = req.user!.email;

  // Strict ownership isolation: ONLY return current tutor's leave applications
  const myApps = db.leaveApplications.filter(
    (a) =>
      a.applicantRole === 'tutor' &&
      (a.candidateId === tutorId || a.tutorId === tutorId || a.candidateEmail === tutorEmail)
  );

  // Sort descending by appliedAt
  myApps.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());

  const summary = {
    total: myApps.length,
    pending: myApps.filter((a) => a.status === 'pending').length,
    approved: myApps.filter((a) => a.status === 'approved').length,
    rejected: myApps.filter((a) => a.status === 'rejected').length,
    cancelled: myApps.filter((a) => a.status === 'cancelled').length,
    totalApprovedDays: myApps
      .filter((a) => a.status === 'approved')
      .reduce((sum, a) => sum + (a.totalDays || 0), 0),
  };

  res.json({ applications: myApps, summary });
});

apiRouter.post('/tutor/leave', requireTutor, (req: AuthenticatedRequest, res) => {
  const { db, tut } = getTutorContext(req.user!.id);
  if (!tut) {
    res.status(404).json({ error: 'Tutor account not found.' });
    return;
  }

  if (tut.status === 'inactive') {
    res.status(403).json({ error: 'Your tutor account is inactive. Please contact administration.' });
    return;
  }

  const { leaveTypeId, startDate, endDate, reason, attachments } = req.body;

  if (!leaveTypeId) {
    res.status(400).json({ error: 'Please select a leave type.' });
    return;
  }
  if (!reason || !reason.trim()) {
    res.status(400).json({ error: 'Please enter the reason for your leave application.' });
    return;
  }

  const leaveType = db.leaveTypes.find((t) => t.id === leaveTypeId);
  if (!leaveType) {
    res.status(400).json({ error: 'Selected leave type was not found.' });
    return;
  }
  if (!leaveType.isActive) {
    res.status(400).json({ error: `The leave type "${leaveType.name}" is currently inactive.` });
    return;
  }

  // Date validity and retrospective check
  const dateValidation = validateLeaveDates(
    startDate,
    endDate,
    db.leavePolicy,
    db.settings.companyTimezone || 'Asia/Kolkata'
  );
  if (!dateValidation.isValid) {
    res.status(400).json({ error: dateValidation.error });
    return;
  }

  // Calculate total leave days
  const totalDays = calculateLeaveDays(startDate, endDate, db.leavePolicy.calculationMode || 'working_days');
  if (totalDays <= 0) {
    res.status(400).json({
      error: `The selected date range (${startDate} to ${endDate}) yields 0 days under the current company policy (${
        db.leavePolicy.calculationMode === 'working_days' ? 'working days excluding weekends' : 'calendar days'
      }).`,
    });
    return;
  }

  // Overlap check with tutor's existing pending or approved applications
  const tutorExistingApps = db.leaveApplications.filter(
    (a) =>
      a.applicantRole === 'tutor' &&
      (a.candidateId === tut.id || a.tutorId === tut.id || a.candidateEmail === tut.email)
  );
  const overlapCheck = checkLeaveOverlap(startDate, endDate, tutorExistingApps);
  if (overlapCheck.hasOverlap && overlapCheck.overlappingApp) {
    const opp = overlapCheck.overlappingApp;
    res.status(400).json({
      error: `Overlapping leave request detected: You already have a ${opp.status.toUpperCase()} leave application (${opp.applicationNumber} from ${opp.startDate} to ${opp.endDate}) during this period.`,
    });
    return;
  }

  // Supporting document requirement
  const sanitizedAttachments: any[] = Array.isArray(attachments) ? attachments : [];
  if (leaveType.requiresDocument && sanitizedAttachments.length === 0) {
    res.status(400).json({
      error: `Supporting documentation is mandatory for "${leaveType.name}". Please attach supporting documents.`,
    });
    return;
  }
  if (
    db.leavePolicy.requireAttachmentAboveDays > 0 &&
    totalDays > db.leavePolicy.requireAttachmentAboveDays &&
    sanitizedAttachments.length === 0
  ) {
    res.status(400).json({
      error: `Company policy requires a supporting document for leave requests exceeding ${db.leavePolicy.requireAttachmentAboveDays} days.`,
    });
    return;
  }

  const applicationNumber = generateApplicationNumber(db.leaveApplications);
  const now = new Date().toISOString();

  const newApp: LeaveApplication = {
    id: `leave-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    applicationNumber,
    applicantRole: 'tutor',
    candidateId: tut.id,
    candidateCustomId: tut.tutorId,
    candidateName: tut.name,
    candidateEmail: tut.email,
    tutorId: tut.id,
    tutorCustomId: tut.tutorId,
    courseId: (tut.assignedCourseIds && tut.assignedCourseIds[0]) || '',
    courseName: tut.assignedCourseNames && tut.assignedCourseNames.length > 0 ? tut.assignedCourseNames.join(', ') : 'Assigned Courses',
    batchId: (tut.assignedBatchIds && tut.assignedBatchIds[0]) || '',
    batchName: tut.assignedBatchNames && tut.assignedBatchNames.length > 0 ? tut.assignedBatchNames.join(', ') : 'Assigned Batches',
    leaveTypeId: leaveType.id,
    leaveTypeName: leaveType.name,
    startDate,
    endDate,
    totalDays,
    reason: reason.trim(),
    status: 'pending',
    attachments: sanitizedAttachments.map((att: any) => ({
      id: att.id || `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fileName: att.fileName || 'document',
      fileSize: Number(att.fileSize) || 0,
      mimeType: att.mimeType || 'application/octet-stream',
      dataUrl: att.dataUrl || '',
      uploadedAt: now,
    })),
    history: [
      {
        id: `hist-${Date.now()}`,
        status: 'pending',
        changedBy: tut.email,
        changedByRole: 'tutor',
        reason: 'Application submitted by instructor',
        timestamp: now,
      },
    ],
    appliedAt: now,
    updatedAt: now,
  };

  db.leaveApplications.unshift(newApp);

  // In-app Notification for Super Admin
  db.notifications.unshift({
    id: `notif-${Date.now()}-admin-tutor-leave`,
    title: `New Instructor Leave Application: ${tut.name}`,
    message: `Instructor ${tut.name} (${tut.tutorId}) submitted a ${leaveType.name} application for ${startDate} to ${endDate} (${totalDays} day(s)).`,
    type: 'leave',
    targetAudience: 'all',
    relatedEntity: { type: 'leave', id: newApp.id },
    createdAt: now,
    read: false,
  });

  // Email Notification to Super Admin
  dbManager.queueEmail(
    db.admin.email,
    db.admin.name,
    `New Instructor Leave Application: ${tut.name} (${newApp.applicationNumber})`,
    'leave_submitted',
    'delivered'
  );

  // Audit Log
  dbManager.logAudit(
    tut.email,
    'tutor',
    'TUTOR_LEAVE_APPLIED',
    'leave',
    newApp.id,
    `Instructor ${tut.name} (${tut.tutorId}) submitted leave application ${newApp.applicationNumber} (${startDate} to ${endDate}, ${totalDays} days).`
  );

  dbManager.save();
  res.status(201).json({ application: newApp });
});

apiRouter.put('/tutor/leave/:id/cancel', requireTutor, (req: AuthenticatedRequest, res) => {
  const db = dbManager.get();
  const tutorId = req.user!.id;
  const tutorEmail = req.user!.email;
  const app = db.leaveApplications.find((a) => a.id === req.params.id);

  if (!app) {
    res.status(404).json({ error: 'Leave application not found.' });
    return;
  }

  // Security check: Tutor can ONLY cancel their own application
  if (app.applicantRole !== 'tutor' || (app.candidateId !== tutorId && app.tutorId !== tutorId && app.candidateEmail !== tutorEmail)) {
    res.status(403).json({ error: 'You are not authorized to cancel this application.' });
    return;
  }

  // Only PENDING applications can be self-cancelled
  if (app.status !== 'pending') {
    res.status(400).json({
      error: `Cannot cancel application with status "${app.status.toUpperCase()}". Only Pending applications can be self-cancelled.`,
    });
    return;
  }

  const { cancelReason } = req.body;
  const now = new Date().toISOString();

  app.status = 'cancelled';
  app.updatedAt = now;

  app.history.unshift({
    id: `hist-${Date.now()}`,
    status: 'cancelled',
    changedBy: tutorEmail,
    changedByRole: 'tutor',
    reason: cancelReason ? cancelReason.trim() : 'Cancelled by instructor',
    timestamp: now,
  });

  // Notify Super Admin
  db.notifications.unshift({
    id: `notif-${Date.now()}-admin-tutor-leave-cancelled`,
    title: `Instructor Leave Cancelled: ${app.candidateName}`,
    message: `Instructor ${app.candidateName} (${app.tutorCustomId || app.candidateCustomId}) cancelled their leave request ${app.applicationNumber}.${
      cancelReason ? ` Reason: ${cancelReason.trim()}` : ''
    }`,
    type: 'leave',
    targetAudience: 'all',
    relatedEntity: { type: 'leave', id: app.id },
    createdAt: now,
    read: false,
  });

  // Audit Log
  dbManager.logAudit(
    tutorEmail,
    'tutor',
    'TUTOR_LEAVE_CANCELLED',
    'leave',
    app.id,
    `Instructor ${app.candidateName} cancelled leave application ${app.applicationNumber}.`
  );

  dbManager.save();
  res.json({ application: app });
});



