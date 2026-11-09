import express from 'express';
import { apiRouter } from '../server/api.ts';
import { authMiddleware, generateToken } from '../server/auth.ts';
import { dbManager } from '../server/db.ts';
import type { Server } from 'http';

let server: Server;
const PORT = 3998;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

async function startTestServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(authMiddleware);
  app.use('/api', apiRouter);

  await new Promise<void>((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });
}

function stopTestServer(): Promise<void> {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

async function runTests() {
  console.log('--- Starting Dedicated Tutor Portal Verification Suite ---');
  await startTestServer();

  try {
    const db = dbManager.get();
    const admin = db.admin;
    const adminToken = generateToken(admin.id, 'admin');

    // Ensure we have courses and batches for testing
    let course = db.courses[0];
    let batch1 = db.batches[0];
    let batch2 = db.batches.find((b) => b.id !== batch1?.id);

    if (!batch2) {
      batch2 = {
        id: 'batch-test-security-02',
        code: 'B-TEST-SEC-02',
        name: 'Cloud DevOps Cohort B',
        courseId: course.id,
        courseName: course.name,
        capacity: 25,
        status: 'active',
        startDate: '2026-11-01',
        endDate: '2027-04-30',
        createdAt: new Date().toISOString(),
      };
      db.batches.push(batch2);
      dbManager.save();
    }

    // Ensure candidate exists
    let candidate = db.candidates[0];
    const candidateToken = generateToken(candidate.id, 'candidate');

    console.log(`[Setup] Admin: ${admin.email}, Course: ${course.name}, Batch 1: ${batch1.name}, Batch 2: ${batch2.name}`);

    // ==========================================
    // TEST 1: Super Admin creates a tutor account
    // ==========================================
    console.log('\n[Test 1] Super Admin creates a dedicated tutor account');
    const tutorEmail = `tutor_test_${Date.now()}@kodewar.com`;
    const createRes = await fetch(`${BASE_URL}/tutors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Professor Rajesh Verma',
        email: tutorEmail,
        phone: '+91 98765 11223',
        designation: 'Senior Cloud Mentor',
        specialization: 'Kubernetes, Go & Distributed Systems',
        assignedCourseIds: [course.id],
        assignedBatchIds: [batch1.id], // assigned only to batch 1
        notes: 'Lead instructor for backend cohorts',
      }),
    });

    const createData = await createRes.json();
    if (!createRes.ok || !createData.tutor || !createData.tutor.tempPassword) {
      throw new Error(`Failed to create tutor: ${JSON.stringify(createData)}`);
    }
    const createdTutor = createData.tutor;
    const initialTempPassword = createdTutor.tempPassword;
    console.log(`  ✓ Tutor created: ${createdTutor.name} (${createdTutor.tutorId})`);
    console.log(`  ✓ Auto-generated Temporary Password: ${initialTempPassword}`);
    console.log(`  ✓ Assigned Batch: ${batch1.name} (${batch1.id})`);

    // ==========================================
    // TEST 2: Tutor Login with Temporary Password
    // ==========================================
    console.log('\n[Test 2] Tutor logs in with email and temporary password');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: tutorEmail,
        password: initialTempPassword,
      }),
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.token || loginData.user.role !== 'tutor') {
      throw new Error(`Tutor login failed: ${JSON.stringify(loginData)}`);
    }
    let tutorToken = loginData.token;
    if (!loginData.user.mustChangePassword) {
      throw new Error('mustChangePassword should be true for first login!');
    }
    console.log(`  ✓ Successfully authenticated as role: ${loginData.user.role}`);
    console.log(`  ✓ mustChangePassword flag is correctly set to true.`);

    // ==========================================
    // TEST 3: Mandatory First-Login Password Change
    // ==========================================
    console.log('\n[Test 3] Tutor replaces temporary password with permanent credential');
    const permanentPassword = 'PermanentPass@2026';
    const changePassRes = await fetch(`${BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tutorToken}`,
      },
      body: JSON.stringify({
        newPassword: permanentPassword,
      }),
    });
    const changePassData = await changePassRes.json();
    if (!changePassRes.ok || !changePassData.success) {
      throw new Error(`Failed to change password: ${JSON.stringify(changePassData)}`);
    }

    // Verify session user now has mustChangePassword: false
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${tutorToken}` },
    });
    const meData = await meRes.json();
    if (meData.user.mustChangePassword) {
      throw new Error('mustChangePassword should be cleared after password change!');
    }
    console.log(`  ✓ Password successfully changed.`);
    console.log(`  ✓ mustChangePassword cleared from tutor session.`);

    // Re-verify login with new permanent password
    const reloginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: tutorEmail,
        password: permanentPassword,
      }),
    });
    const reloginData = await reloginRes.json();
    if (!reloginRes.ok) {
      throw new Error('Relogin with permanent password failed!');
    }
    tutorToken = reloginData.token;
    console.log(`  ✓ Tutor re-authenticated cleanly with permanent password.`);

    // ==========================================
    // TEST 4: Inactive Tutor Account Blocking
    // ==========================================
    console.log('\n[Test 4] Deactivated tutor accounts are blocked from authentication');
    await fetch(`${BASE_URL}/tutors/${createdTutor.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'inactive' }),
    });

    const inactiveLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: tutorEmail,
        password: permanentPassword,
      }),
    });
    if (inactiveLoginRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for inactive tutor, got: ${inactiveLoginRes.status}`);
    }
    console.log(`  ✓ Deactivated tutor login blocked with 403 Forbidden.`);

    // Reactivate for subsequent tests
    await fetch(`${BASE_URL}/tutors/${createdTutor.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'active' }),
    });
    console.log(`  ✓ Tutor reactivated.`);

    // ==========================================
    // TEST 5: Route Isolation & Security Boundaries
    // ==========================================
    console.log('\n[Test 5] Strict role-based route boundaries enforcement');
    // 1. Tutor trying to access admin candidate creation
    const tutorToAdminRes = await fetch(`${BASE_URL}/candidates`, {
      headers: { Authorization: `Bearer ${tutorToken}` },
    });
    if (tutorToAdminRes.status !== 403) {
      throw new Error(`Expected 403 for tutor hitting Admin /candidates, got: ${tutorToAdminRes.status}`);
    }
    console.log(`  ✓ Tutor accessing Admin endpoint (/candidates) rejected with 403 Forbidden.`);

    // 2. Candidate trying to access tutor dashboard
    const candToTutorRes = await fetch(`${BASE_URL}/tutor/dashboard`, {
      headers: { Authorization: `Bearer ${candidateToken}` },
    });
    if (candToTutorRes.status !== 403) {
      throw new Error(`Expected 403 for candidate hitting /tutor/dashboard, got: ${candToTutorRes.status}`);
    }
    console.log(`  ✓ Candidate accessing Tutor endpoint (/tutor/dashboard) rejected with 403 Forbidden.`);

    // ==========================================
    // TEST 6: Tutor Dashboard Metrics
    // ==========================================
    console.log('\n[Test 6] Tutor Dashboard returns dynamic assigned metrics');
    const dashRes = await fetch(`${BASE_URL}/tutor/dashboard`, {
      headers: { Authorization: `Bearer ${tutorToken}` },
    });
    const dashData = await dashRes.json();
    if (!dashRes.ok || !dashData.stats) {
      throw new Error(`Failed to load tutor dashboard: ${JSON.stringify(dashData)}`);
    }
    console.log(`  ✓ Dashboard loaded. Assigned batches: ${dashData.stats.assignedBatchesCount}, Total candidates: ${dashData.stats.totalCandidates}`);

    // ==========================================
    // TEST 7: Batch & Candidate Isolation
    // ==========================================
    console.log('\n[Test 7] Tutor can only access assigned batches and student rosters');
    const batchesRes = await fetch(`${BASE_URL}/tutor/batches`, {
      headers: { Authorization: `Bearer ${tutorToken}` },
    });
    const batchesData = await batchesRes.json();
    const batchIds = batchesData.batches.map((b: any) => b.id);
    if (!batchIds.includes(batch1.id)) {
      throw new Error(`Assigned batch ${batch1.id} missing from tutor batches.`);
    }
    if (batchIds.includes(batch2.id)) {
      throw new Error(`Unassigned batch ${batch2.id} should NOT be returned to tutor!`);
    }
    console.log(`  ✓ /tutor/batches returns only assigned batch ${batch1.name} (isolated from batch 2).`);

    // Verify detail access for assigned batch
    const batch1DetailRes = await fetch(`${BASE_URL}/tutor/batches/${batch1.id}`, {
      headers: { Authorization: `Bearer ${tutorToken}` },
    });
    if (!batch1DetailRes.ok) {
      throw new Error('Failed to fetch assigned batch details');
    }
    const batch1Detail = await batch1DetailRes.json();
    console.log(`  ✓ Successfully accessed assigned batch roster (${batch1Detail.roster.length} students).`);

    // Verify detail access for UNASSIGNED batch is forbidden
    const batch2DetailRes = await fetch(`${BASE_URL}/tutor/batches/${batch2.id}`, {
      headers: { Authorization: `Bearer ${tutorToken}` },
    });
    if (batch2DetailRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for unassigned batch detail, got: ${batch2DetailRes.status}`);
    }
    console.log(`  ✓ Direct URL manipulation attempt on unassigned batch (${batch2.id}) returned 403 Forbidden.`);

    // ==========================================
    // TEST 8: Meeting Access Permission Enforcement
    // ==========================================
    console.log('\n[Test 8] Meeting Access Management Permission Gate');
    // Create a meeting for batch 1 assigned to this tutor
    const meetingRes = await fetch(`${BASE_URL}/meetings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Microservices & Distributed Tracing Session',
        courseId: course.id,
        batchId: batch1.id,
        tutorId: createdTutor.id,
        date: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '11:30',
        meetingPlatform: 'Google Meet',
        meetingUrl: 'https://meet.google.com/abc-test-meet',
        description: 'Deep dive into distributed tracing',
      }),
    });
    const meetingData = await meetingRes.json();
    const testMeeting = meetingData.session;
    console.log(`  ✓ Test meeting created: ${testMeeting.title} (ID: ${testMeeting.id})`);

    // Tutor tries to toggle access, but canManageMeetingAccess is false by default
    const accessDenyRes = await fetch(`${BASE_URL}/tutor/meetings/${testMeeting.id}/access`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tutorToken}`,
      },
      body: JSON.stringify({ accessStatus: 'enabled' }),
    });
    if (accessDenyRes.status !== 403) {
      throw new Error(`Expected 403 when canManageMeetingAccess is false, got: ${accessDenyRes.status}`);
    }
    console.log(`  ✓ Meeting access toggle blocked when permission is disabled (403 Forbidden).`);

    // Admin grants canManageMeetingAccess
    await fetch(`${BASE_URL}/tutors/${createdTutor.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        permissions: {
          ...createdTutor.permissions,
          canManageMeetingAccess: true,
        },
      }),
    });

    // Tutor retries toggling access
    const accessAllowRes = await fetch(`${BASE_URL}/tutor/meetings/${testMeeting.id}/access`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tutorToken}`,
      },
      body: JSON.stringify({ accessStatus: 'enabled' }),
    });
    const accessAllowData = await accessAllowRes.json();
    if (!accessAllowRes.ok || accessAllowData.session.accessStatus !== 'enabled') {
      throw new Error(`Meeting access toggle failed after permission grant: ${JSON.stringify(accessAllowData)}`);
    }
    console.log(`  ✓ Meeting access toggle succeeded after permission granted by Super Admin.`);

    // ==========================================
    // TEST 9: Roll Call Attendance Marking & Permission Gate
    // ==========================================
    console.log('\n[Test 9] Tutor marks attendance for assigned meeting session');
    // Initially canRecordAttendance is false by default per PRD Section 7
    const markAttDenyRes = await fetch(`${BASE_URL}/tutor/attendance/mark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tutorToken}`,
      },
      body: JSON.stringify({
        sessionId: testMeeting.id,
        records: [
          {
            candidateId: candidate.id,
            status: 'present',
          },
        ],
      }),
    });
    if (markAttDenyRes.status !== 403) {
      throw new Error(`Expected 403 when canRecordAttendance is false, got: ${markAttDenyRes.status}`);
    }
    console.log(`  ✓ Attendance recording blocked when permission is disabled by Super Admin (403 Forbidden).`);

    // Super Admin enables canRecordAttendance
    await fetch(`${BASE_URL}/tutors/${createdTutor.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        permissions: {
          ...createdTutor.permissions,
          canManageMeetingAccess: true,
          canRecordAttendance: true,
        },
      }),
    });

    const markAttRes = await fetch(`${BASE_URL}/tutor/attendance/mark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tutorToken}`,
      },
      body: JSON.stringify({
        sessionId: testMeeting.id,
        records: [
          {
            candidateId: candidate.id,
            status: 'present',
            remarks: 'Active participant in live discussion',
          },
        ],
      }),
    });
    const markAttData = await markAttRes.json();
    if (!markAttRes.ok || markAttData.markedCount !== 1) {
      throw new Error(`Attendance marking failed: ${JSON.stringify(markAttData)}`);
    }
    const savedRecord = markAttData.records[0];
    console.log(`  ✓ Attendance successfully recorded after permission granted (Status: Present).`);

    // Verify session attendance endpoint
    const sessionAttRes = await fetch(`${BASE_URL}/tutor/attendance/session/${testMeeting.id}`, {
      headers: { Authorization: `Bearer ${tutorToken}` },
    });
    const sessionAttData = await sessionAttRes.json();
    if (!sessionAttRes.ok || sessionAttData.summary.present < 1) {
      throw new Error('Attendance session summary did not reflect marked present record.');
    }
    console.log(`  ✓ Session roll call verified. Total: ${sessionAttData.summary.total}, Present: ${sessionAttData.summary.present}`);

    // ==========================================
    // TEST 10: Attendance Correction & Window Enforcement
    // ==========================================
    console.log('\n[Test 10] Attendance Correction Permissions & Reason Requirement');
    // Initially canEditAttendance is false
    const corrDenyRes = await fetch(`${BASE_URL}/tutor/attendance/${savedRecord.id}/correct`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tutorToken}`,
      },
      body: JSON.stringify({
        status: 'late',
        correctionReason: 'Joined after 15 minutes due to audio setup',
      }),
    });
    if (corrDenyRes.status !== 403) {
      throw new Error(`Expected 403 when canEditAttendance is false, got: ${corrDenyRes.status}`);
    }
    console.log(`  ✓ Attendance correction rejected when canEditAttendance is false (403 Forbidden).`);

    // Admin grants canEditAttendance
    await fetch(`${BASE_URL}/tutors/${createdTutor.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        permissions: {
          ...createdTutor.permissions,
          canManageMeetingAccess: true,
          canEditAttendance: true,
          attendanceEditWindowHours: 24,
        },
      }),
    });

    // Tutor retries correction without reason -> Should fail validation
    const corrNoReasonRes = await fetch(`${BASE_URL}/tutor/attendance/${savedRecord.id}/correct`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tutorToken}`,
      },
      body: JSON.stringify({
        status: 'late',
        correctionReason: '',
      }),
    });
    if (corrNoReasonRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request when correctionReason is missing, got: ${corrNoReasonRes.status}`);
    }
    console.log(`  ✓ Correction without mandatory explanation rejected (400 Bad Request).`);

    // Tutor retries correction with proper reason
    const corrSuccessRes = await fetch(`${BASE_URL}/tutor/attendance/${savedRecord.id}/correct`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tutorToken}`,
      },
      body: JSON.stringify({
        status: 'late',
        remarks: 'Audio setup delay',
        correctionReason: 'Joined after 15 minutes due to audio setup',
      }),
    });
    const corrSuccessData = await corrSuccessRes.json();
    if (!corrSuccessRes.ok || corrSuccessData.record.status !== 'late') {
      throw new Error(`Attendance correction failed: ${JSON.stringify(corrSuccessData)}`);
    }
    console.log(`  ✓ Attendance correction applied with documented explanation reason.`);

    // ==========================================
    // TEST 11: Learning Resources Permissions
    // ==========================================
    console.log('\n[Test 11] Learning Resources Upload & Deletion Controls');
    // Initially canUploadResources is false
    const resUploadDenyRes = await fetch(`${BASE_URL}/tutor/resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tutorToken}`,
      },
      body: JSON.stringify({
        title: 'Kubernetes Cluster Setup Cheatsheet',
        url: 'https://kodewar.com/docs/k8s.pdf',
        category: 'Cheat Sheet',
        type: 'pdf',
      }),
    });
    if (resUploadDenyRes.status !== 403) {
      throw new Error(`Expected 403 when canUploadResources is false, got: ${resUploadDenyRes.status}`);
    }
    console.log(`  ✓ Resource upload rejected when canUploadResources is disabled (403 Forbidden).`);

    // Admin grants canUploadResources & canManageOwnResources
    await fetch(`${BASE_URL}/tutors/${createdTutor.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        permissions: {
          ...createdTutor.permissions,
          canUploadResources: true,
          canManageOwnResources: true,
        },
      }),
    });

    // Tutor uploads resource
    const resUploadSuccessRes = await fetch(`${BASE_URL}/tutor/resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tutorToken}`,
      },
      body: JSON.stringify({
        title: 'Kubernetes Cluster Setup Cheatsheet',
        url: 'https://kodewar.com/docs/k8s.pdf',
        category: 'Cheat Sheet',
        type: 'pdf',
        batchId: batch1.id,
      }),
    });
    const resUploadSuccessData = await resUploadSuccessRes.json();
    if (!resUploadSuccessRes.ok || !resUploadSuccessData.resource) {
      throw new Error(`Resource upload failed: ${JSON.stringify(resUploadSuccessData)}`);
    }
    const uploadedRes = resUploadSuccessData.resource;
    console.log(`  ✓ Learning resource published successfully: ${uploadedRes.title} (ID: ${uploadedRes.id})`);

    // Tutor deletes own resource
    const resDeleteSuccessRes = await fetch(`${BASE_URL}/tutor/resources/${uploadedRes.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tutorToken}` },
    });
    if (!resDeleteSuccessRes.ok) {
      throw new Error('Failed to delete own resource');
    }
    console.log(`  ✓ Tutor successfully deleted own uploaded resource.`);

    // ==========================================
    // TEST 12: Super Admin Password Reset & Activity Retrieval
    // ==========================================
    console.log('\n[Test 12] Super Admin Password Reset & Activity Audit');
    const resetRes = await fetch(`${BASE_URL}/tutors/${createdTutor.id}/reset-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const resetData = await resetRes.json();
    if (!resetRes.ok || !resetData.tempPassword) {
      throw new Error(`Super Admin password reset failed: ${JSON.stringify(resetData)}`);
    }
    console.log(`  ✓ Super Admin reset tutor password. New temp password: ${resetData.tempPassword}`);

    // Retrieve Tutor Activity Drawer Data
    const actRes = await fetch(`${BASE_URL}/tutors/${createdTutor.id}/activity`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const actData = await actRes.json();
    if (!actRes.ok || !actData.activity) {
      throw new Error(`Activity retrieval failed: ${JSON.stringify(actData)}`);
    }
    console.log(`  ✓ Tutor activity retrieved: ${actData.activity.assignedBatchesCount} batches, ${actData.activity.totalCandidates} candidates, ${actData.activity.attendanceSessionsMarked} marked sessions.`);

    // ==========================================
    // TEST 13: Tutor Profile View & Update (Settings Page)
    // ==========================================
    console.log('\n[Test 13] Tutor Profile View & Settings Page');
    const profRes = await fetch(`${BASE_URL}/tutor/profile`, {
      headers: { Authorization: `Bearer ${tutorToken}` },
    });
    const profData = await profRes.json();
    if (!profRes.ok || !profData.profile || !profData.tutor) {
      throw new Error(`Profile retrieval failed: ${JSON.stringify(profData)}`);
    }
    console.log(`  ✓ GET /tutor/profile returns both profile and tutor properties successfully`);

    const profUpdateRes = await fetch(`${BASE_URL}/tutor/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tutorToken}`,
      },
      body: JSON.stringify({
        phone: '+91 91122 33445',
        designation: 'Principal Mentor & Architect',
      }),
    });
    const profUpdateData = await profUpdateRes.json();
    if (!profUpdateRes.ok || profUpdateData.profile.phone !== '+91 91122 33445') {
      throw new Error(`Profile update failed: ${JSON.stringify(profUpdateData)}`);
    }
    console.log(`  ✓ PUT /tutor/profile updated contact info and designation successfully`);

    // ==========================================
    // TEST 14: Tutor Leave Management (Apply, List, Cancel)
    // ==========================================
    console.log('\n[Test 14] Tutor Leave Management Flow (Apply, List, Self-Cancel)');
    const leaveTypesRes = await fetch(`${BASE_URL}/leave/types`, {
      headers: { Authorization: `Bearer ${tutorToken}` },
    });
    const leaveTypesData = await leaveTypesRes.json();
    const sickLeave = leaveTypesData.leaveTypes.find((t: any) => t.name.toLowerCase().includes('sick')) || leaveTypesData.leaveTypes[0];

    // Tutor applies for leave with document attachment
    const applyLeaveRes = await fetch(`${BASE_URL}/tutor/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tutorToken}`,
      },
      body: JSON.stringify({
        leaveTypeId: sickLeave.id,
        startDate: '2026-11-20',
        endDate: '2026-11-21',
        reason: 'Attending annual distributed systems engineering summit',
        attachments: [
          {
            fileName: 'medical_certificate.pdf',
            fileSize: 2048,
            mimeType: 'application/pdf',
            dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK',
          },
        ],
      }),
    });
    const applyLeaveData = await applyLeaveRes.json();
    if (!applyLeaveRes.ok || !applyLeaveData.application || applyLeaveData.application.applicantRole !== 'tutor') {
      throw new Error(`Tutor leave application failed: ${JSON.stringify(applyLeaveData)}`);
    }
    const tutorLeaveApp = applyLeaveData.application;
    console.log(`  ✓ Tutor applied for leave: ${tutorLeaveApp.applicationNumber} (${tutorLeaveApp.totalDays} day(s), Status: ${tutorLeaveApp.status})`);
    console.log(`  ✓ Applicant Role correctly set to: ${tutorLeaveApp.applicantRole}`);

    // Tutor fetches their own leave applications
    const tutorLeaveListRes = await fetch(`${BASE_URL}/tutor/leave`, {
      headers: { Authorization: `Bearer ${tutorToken}` },
    });
    const tutorLeaveListData = await tutorLeaveListRes.json();
    if (!tutorLeaveListRes.ok || !tutorLeaveListData.applications || tutorLeaveListData.summary.pending < 1) {
      throw new Error(`Tutor leave list retrieval failed: ${JSON.stringify(tutorLeaveListData)}`);
    }
    console.log(`  ✓ Tutor retrieved their leave applications: Total=${tutorLeaveListData.summary.total}, Pending=${tutorLeaveListData.summary.pending}`);

    // Tutor cancels pending leave request
    const cancelLeaveRes = await fetch(`${BASE_URL}/tutor/leave/${tutorLeaveApp.id}/cancel`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tutorToken}`,
      },
      body: JSON.stringify({ cancelReason: 'Conference rescheduled to remote attendance' }),
    });
    const cancelLeaveData = await cancelLeaveRes.json();
    if (!cancelLeaveRes.ok || cancelLeaveData.application.status !== 'cancelled') {
      throw new Error(`Tutor leave cancellation failed: ${JSON.stringify(cancelLeaveData)}`);
    }
    console.log(`  ✓ Tutor successfully cancelled pending application: ${cancelLeaveData.application.applicationNumber}`);

    // ==========================================
    // TEST 15: Admin Reviews & Approves Tutor Leave Application
    // ==========================================
    console.log('\n[Test 15] Admin Reviews and Approves Tutor Leave Application');
    // Tutor submits another leave request
    const secondLeaveRes = await fetch(`${BASE_URL}/tutor/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tutorToken}`,
      },
      body: JSON.stringify({
        leaveTypeId: sickLeave.id,
        startDate: '2026-11-26',
        endDate: '2026-11-27',
        reason: 'Personal family emergency',
        attachments: [
          {
            fileName: 'medical_report.pdf',
            fileSize: 1540,
            mimeType: 'application/pdf',
            dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK',
          },
        ],
      }),
    });
    const secondLeaveData = await secondLeaveRes.json();
    const secondLeaveApp = secondLeaveData.application;

    // Admin views leave applications with applicantRole filter
    const adminTutorLeavesRes = await fetch(`${BASE_URL}/leave/applications?applicantRole=tutor`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminTutorLeavesData = await adminTutorLeavesRes.json();
    if (!adminTutorLeavesRes.ok || !adminTutorLeavesData.applications.some((a: any) => a.id === secondLeaveApp.id)) {
      throw new Error(`Admin failed to filter tutor leave applications: ${JSON.stringify(adminTutorLeavesData)}`);
    }
    console.log(`  ✓ Super Admin filtered and found tutor leave application in admin leave table`);

    // Admin approves tutor leave application
    const approveLeaveRes = await fetch(`${BASE_URL}/leave/applications/${secondLeaveApp.id}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ remarks: 'Approved. Substitute instructor assigned for Morning batch.' }),
    });
    const approveLeaveData = await approveLeaveRes.json();
    if (!approveLeaveRes.ok || approveLeaveData.application.status !== 'approved') {
      throw new Error(`Super Admin leave approval failed: ${JSON.stringify(approveLeaveData)}`);
    }
    console.log(`  ✓ Super Admin approved tutor leave application ${secondLeaveApp.applicationNumber}`);

    // Check tutor notifications received approval
    const tutorNotifsRes = await fetch(`${BASE_URL}/tutor/notifications`, {
      headers: { Authorization: `Bearer ${tutorToken}` },
    });
    const tutorNotifsData = await tutorNotifsRes.json();
    const approvalNotif = tutorNotifsData.notifications.find((n: any) => n.relatedEntity?.id === secondLeaveApp.id);
    if (!approvalNotif) {
      throw new Error('Tutor did not receive in-app approval notification');
    }
    console.log(`  ✓ Instructor received approval notification: "${approvalNotif.title}"`);

    console.log('\n======================================================');
    console.log('🎉 ALL 15 TUTOR PORTAL & LEAVE MANAGEMENT TESTS PASSED! 🎉');
    console.log('======================================================\n');
  } finally {
    await stopTestServer();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed with error:', err);
  process.exit(1);
});
