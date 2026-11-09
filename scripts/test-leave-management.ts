import express from 'express';
import { apiRouter } from '../server/api.ts';
import { authMiddleware, generateToken } from '../server/auth.ts';
import { dbManager } from '../server/db.ts';
import type { Server } from 'http';

let server: Server;
const PORT = 3987;
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
  console.log('--- Starting Leave Management Automated Verification ---');
  await startTestServer();

  try {
    const db = dbManager.get();
    const admin = db.admin;
    const adminToken = generateToken(admin.id, 'admin');

    // Ensure we have at least 2 active candidates for testing
    let cand1 = db.candidates.find((c) => c.status === 'active');
    if (!cand1 && db.candidates.length > 0) {
      cand1 = db.candidates[0];
      cand1.status = 'active';
      dbManager.save();
    }
    if (!cand1) {
      throw new Error('No candidate available in test database.');
    }

    let cand2 = db.candidates.find((c) => c.id !== cand1!.id);
    if (!cand2) {
      // create a mock second candidate for security isolation tests
      cand2 = {
        id: 'cand-test-security-2',
        candidateId: 'KDL-2026-999',
        name: 'Test Candidate 2',
        email: 'cand2@test.com',
        courseId: cand1.courseId,
        currentBatchId: cand1.currentBatchId,
        enrollmentDate: '2026-11-01',
        status: 'active',
        role: 'candidate',
        passwordHash: 'dummy',
        salt: 'dummy',
      };
      db.candidates.push(cand2);
      dbManager.save();
    }

    const cand1Token = generateToken(cand1.id, 'candidate');
    const cand2Token = generateToken(cand2.id, 'candidate');

    console.log(`[Setup] Admin: ${admin.email}, Candidate 1: ${cand1.name} (${cand1.id}), Candidate 2: ${cand2.name} (${cand2.id})`);

    // TEST 1: Get Leave Types & Policy
    console.log('\n[Test 1] Candidate & Admin can read leave types and policy');
    const typesRes = await fetch(`${BASE_URL}/leave/types`, {
      headers: { Authorization: `Bearer ${cand1Token}` },
    });
    const typesData = await typesRes.json();
    if (!typesRes.ok || !Array.isArray(typesData.leaveTypes) || typesData.leaveTypes.length === 0) {
      throw new Error('Failed to fetch leave types: ' + JSON.stringify(typesData));
    }
    console.log(`  ✓ Successfully fetched ${typesData.leaveTypes.length} leave types.`);

    const policyRes = await fetch(`${BASE_URL}/leave/policy`, {
      headers: { Authorization: `Bearer ${cand1Token}` },
    });
    const policyData = await policyRes.json();
    if (!policyRes.ok || !policyData.policy) {
      throw new Error('Failed to fetch leave policy: ' + JSON.stringify(policyData));
    }
    console.log(`  ✓ Successfully fetched policy (mode: ${policyData.policy.calculationMode}, allowRetro: ${policyData.policy.allowRetrospective}).`);

    // Reset policy for predictable tests: working_days, allowRetrospective: false
    await fetch(`${BASE_URL}/leave/policy`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        calculationMode: 'working_days',
        allowRetrospective: false,
        maxConsecutiveDays: 30,
        requireAttachmentAboveDays: 5,
      }),
    });

    // TEST 2: Validation - Past date when retrospective is disallowed
    console.log('\n[Test 2] Validate retrospective date rejection');
    const pastApplyRes = await fetch(`${BASE_URL}/candidate/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cand1Token}`,
      },
      body: JSON.stringify({
        leaveTypeId: typesData.leaveTypes[0].id,
        startDate: '2026-01-01',
        endDate: '2026-01-03',
        reason: 'Past leave attempt',
      }),
    });
    const pastApplyData = await pastApplyRes.json();
    if (pastApplyRes.status !== 400 || !pastApplyData.error?.includes('earlier than today')) {
      throw new Error('Expected 400 rejection for retrospective leave, got: ' + JSON.stringify(pastApplyData));
    }
    console.log(`  ✓ Correctly rejected past leave date with message: "${pastApplyData.error}"`);

    // TEST 3: Validation - End date before start date
    console.log('\n[Test 3] Validate end date before start date rejection');
    const invalidDatesRes = await fetch(`${BASE_URL}/candidate/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cand1Token}`,
      },
      body: JSON.stringify({
        leaveTypeId: typesData.leaveTypes[0].id,
        startDate: '2026-11-20',
        endDate: '2026-11-15',
        reason: 'Inverted dates attempt',
      }),
    });
    const invalidDatesData = await invalidDatesRes.json();
    if (invalidDatesRes.status !== 400) {
      throw new Error('Expected 400 rejection for inverted dates, got: ' + JSON.stringify(invalidDatesData));
    }
    console.log(`  ✓ Correctly rejected inverted date range.`);

    // TEST 4: Candidate 1 Submits a Valid Leave Application
    console.log('\n[Test 4] Candidate 1 submits a valid leave application');
    // Choose future dates: Mon Nov 16 to Wed Nov 18, 2026
    const applyRes1 = await fetch(`${BASE_URL}/candidate/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cand1Token}`,
      },
      body: JSON.stringify({
        leaveTypeId: 'lt-personal',
        startDate: '2026-11-16', // Monday
        endDate: '2026-11-18',   // Wednesday
        reason: 'Family wedding event in hometown.',
        attachments: [
          {
            fileName: 'wedding_invitation.pdf',
            fileSize: 45000,
            mimeType: 'application/pdf',
            dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK...',
          },
        ],
      }),
    });
    const applyData1 = await applyRes1.json();
    if (!applyRes1.ok || !applyData1.application) {
      throw new Error('Failed to submit valid application: ' + JSON.stringify(applyData1));
    }
    const app1 = applyData1.application;
    console.log(`  ✓ Application created: ${app1.applicationNumber} (Total Days: ${app1.totalDays}, Status: ${app1.status})`);
    if (app1.totalDays !== 3) {
      throw new Error(`Expected totalDays to be 3 (Mon-Wed), got: ${app1.totalDays}`);
    }
    if (app1.candidateId !== cand1.id) {
      throw new Error('Candidate ID mismatch in submitted application.');
    }
    if (!app1.history || app1.history.length === 0) {
      throw new Error('Initial status change history was not recorded.');
    }

    // Verify Admin in-app notification & email
    const freshDb = dbManager.get();
    const adminNotif = freshDb.notifications.find((n) => n.relatedEntity?.id === app1.id);
    if (!adminNotif) {
      throw new Error('Admin in-app notification was not generated for new leave application.');
    }
    console.log(`  ✓ Admin received in-app notification: "${adminNotif.title}"`);

    const adminEmail = freshDb.emailLogs.find((e) => e.template === 'leave_submitted');
    if (!adminEmail) {
      throw new Error('Admin email notification was not queued for new leave application.');
    }
    console.log(`  ✓ Admin email queued: "${adminEmail.subject}"`);

    // TEST 5: Overlap detection for same candidate
    console.log('\n[Test 5] Overlap detection for Candidate 1');
    const overlapRes = await fetch(`${BASE_URL}/candidate/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cand1Token}`,
      },
      body: JSON.stringify({
        leaveTypeId: 'lt-sick',
        startDate: '2026-11-17', // Overlaps with 2026-11-16 to 2026-11-18
        endDate: '2026-11-20',
        reason: 'Overlapping doctor checkup',
      }),
    });
    const overlapData = await overlapRes.json();
    if (overlapRes.status !== 400 || !overlapData.error?.includes('Overlapping leave request detected')) {
      throw new Error('Expected 400 rejection for overlapping dates, got: ' + JSON.stringify(overlapData));
    }
    console.log(`  ✓ Correctly rejected overlapping application: "${overlapData.error}"`);

    // TEST 6: Candidate Isolation & Authorization Checks
    console.log('\n[Test 6] Candidate 2 security isolation');
    // Candidate 2 tries to read Candidate 1's application
    const cand2AccessRes = await fetch(`${BASE_URL}/leave/applications/${app1.id}`, {
      headers: { Authorization: `Bearer ${cand2Token}` },
    });
    if (cand2AccessRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for Candidate 2 accessing Candidate 1's leave, got: ${cand2AccessRes.status}`);
    }
    console.log('  ✓ Candidate 2 forbidden (403) from accessing Candidate 1 application.');

    // Candidate 1 tries to approve their own application (Must fail with 403 Super Admin required)
    const candApproveRes = await fetch(`${BASE_URL}/leave/applications/${app1.id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${cand1Token}` },
    });
    if (candApproveRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for Candidate attempting approval, got: ${candApproveRes.status}`);
    }
    console.log('  ✓ Candidate forbidden (403) from approving leave applications.');

    // TEST 7: Super Admin Approval Workflow
    console.log('\n[Test 7] Super Admin approves Candidate 1 application');
    const approveRes = await fetch(`${BASE_URL}/leave/applications/${app1.id}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ remarks: 'Approved. Please coordinate with classmate for lecture notes.' }),
    });
    const approveData = await approveRes.json();
    if (!approveRes.ok || approveData.application?.status !== 'approved') {
      throw new Error('Super Admin approval failed: ' + JSON.stringify(approveData));
    }
    console.log(`  ✓ Application ${app1.applicationNumber} status updated to APPROVED.`);

    // Candidate 1 checks their own notifications and email
    const candNotifsRes = await fetch(`${BASE_URL}/candidate/notifications`, {
      headers: { Authorization: `Bearer ${cand1Token}` },
    });
    const candNotifsData = await candNotifsRes.json();
    const candLeaveNotif = candNotifsData.notifications.find((n: any) => n.relatedEntity?.id === app1.id);
    if (!candLeaveNotif) {
      throw new Error('Candidate did not receive in-app approval notification.');
    }
    console.log(`  ✓ Candidate received approval in-app notification: "${candLeaveNotif.title}"`);

    // TEST 8: Candidate cannot cancel approved application
    console.log('\n[Test 8] Candidate cannot cancel approved application');
    const cancelApprovedRes = await fetch(`${BASE_URL}/candidate/leave/${app1.id}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${cand1Token}` },
    });
    const cancelApprovedData = await cancelApprovedRes.json();
    if (cancelApprovedRes.status !== 400) {
      throw new Error('Expected 400 when cancelling approved application, got: ' + JSON.stringify(cancelApprovedData));
    }
    console.log(`  ✓ Candidate prevented from cancelling approved application.`);

    // TEST 9: Super Admin Revoke of Approved Application
    console.log('\n[Test 9] Super Admin revokes approved application');
    // Without reason -> must fail
    const revokeNoReasonRes = await fetch(`${BASE_URL}/leave/applications/${app1.id}/revoke`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ revokeReason: '' }),
    });
    if (revokeNoReasonRes.status !== 400) {
      throw new Error('Expected 400 when revoking without explanation.');
    }

    // With reason -> succeeds
    const revokeRes = await fetch(`${BASE_URL}/leave/applications/${app1.id}/revoke`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ revokeReason: 'Mandatory final exam scheduled on these dates.' }),
    });
    const revokeData = await revokeRes.json();
    if (!revokeRes.ok || revokeData.application?.status !== 'cancelled') {
      throw new Error('Super Admin revocation failed: ' + JSON.stringify(revokeData));
    }
    console.log(`  ✓ Application ${app1.applicationNumber} successfully revoked (status: CANCELLED).`);

    // TEST 10: Rejection Workflow with Mandatory Reason
    console.log('\n[Test 10] Application Rejection with Mandatory Reason');
    // Candidate 2 submits a new application for Dec 2026
    const applyRes2 = await fetch(`${BASE_URL}/candidate/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cand2Token}`,
      },
      body: JSON.stringify({
        leaveTypeId: 'lt-emergency',
        startDate: '2026-12-07', // Monday
        endDate: '2026-12-08',   // Tuesday
        reason: 'Need time off for family trip.',
      }),
    });
    const applyData2 = await applyRes2.json();
    const app2 = applyData2.application;

    // Admin attempts rejection without reason -> must fail
    const rejectNoReasonRes = await fetch(`${BASE_URL}/leave/applications/${app2.id}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ rejectionReason: '' }),
    });
    if (rejectNoReasonRes.status !== 400) {
      throw new Error('Expected 400 when rejecting without reason.');
    }
    console.log('  ✓ Rejection without reason rejected (mandatory explanation enforced).');

    // Admin rejects with valid explanation
    const rejectRes = await fetch(`${BASE_URL}/leave/applications/${app2.id}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        rejectionReason: 'Emergency leave cannot be claimed for pre-planned holiday trips. Please submit Personal leave.',
        remarks: 'Candidate advised to re-apply under personal leave.',
      }),
    });
    const rejectData = await rejectRes.json();
    if (!rejectRes.ok || rejectData.application?.status !== 'rejected') {
      throw new Error('Rejection with reason failed: ' + JSON.stringify(rejectData));
    }
    console.log(`  ✓ Application ${app2.applicationNumber} rejected with recorded reason.`);

    // TEST 11: Candidate Self-Cancellation of Pending Application
    console.log('\n[Test 11] Candidate self-cancelling a pending application');
    const applyRes3 = await fetch(`${BASE_URL}/candidate/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cand1Token}`,
      },
      body: JSON.stringify({
        leaveTypeId: 'lt-academic',
        startDate: '2026-12-21',
        endDate: '2026-12-22',
        reason: 'College symposium participation.',
      }),
    });
    const applyData3 = await applyRes3.json();
    const app3 = applyData3.application;

    // Candidate cancels pending application
    const cancelRes = await fetch(`${BASE_URL}/candidate/leave/${app3.id}/cancel`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cand1Token}`,
      },
      body: JSON.stringify({ cancelReason: 'Symposium dates were rescheduled by university.' }),
    });
    const cancelData = await cancelRes.json();
    if (!cancelRes.ok || cancelData.application?.status !== 'cancelled') {
      throw new Error('Self cancellation failed: ' + JSON.stringify(cancelData));
    }
    console.log(`  ✓ Candidate self-cancelled pending application ${app3.applicationNumber}.`);

    // TEST 12: Configurable Leave Types CRUD
    console.log('\n[Test 12] Super Admin Leave Types configuration');
    // Create new leave type
    const createTypeRes = await fetch(`${BASE_URL}/leave/types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Conference Attendance',
        code: 'CONF',
        description: 'Attending certified tech developer conferences or hackathons.',
        requiresDocument: true,
        maxDaysPerYear: 7,
        color: 'emerald',
      }),
    });
    const createTypeData = await createTypeRes.json();
    if (!createTypeRes.ok || !createTypeData.leaveType) {
      throw new Error('Failed to create new leave type: ' + JSON.stringify(createTypeData));
    }
    const newTypeId = createTypeData.leaveType.id;
    console.log(`  ✓ Created configurable leave type: "${createTypeData.leaveType.name}" (${newTypeId})`);

    // Update leave type
    const updateTypeRes = await fetch(`${BASE_URL}/leave/types/${newTypeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ maxDaysPerYear: 10 }),
    });
    const updateTypeData = await updateTypeRes.json();
    if (!updateTypeRes.ok || updateTypeData.leaveType?.maxDaysPerYear !== 10) {
      throw new Error('Failed to update leave type.');
    }
    console.log('  ✓ Updated leave type maxDaysPerYear to 10.');

    // Delete/deactivate leave type
    const deleteTypeRes = await fetch(`${BASE_URL}/leave/types/${newTypeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!deleteTypeRes.ok) {
      throw new Error('Failed to delete/deactivate leave type.');
    }
    console.log('  ✓ Deleted/deactivated leave type successfully.');

    // TEST 13: Leave Reports and Analytics Aggregation
    console.log('\n[Test 13] Super Admin Leave Reports endpoint');
    const reportsRes = await fetch(`${BASE_URL}/leave/reports`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const reportsData = await reportsRes.json();
    if (!reportsRes.ok || !reportsData.reports) {
      throw new Error('Failed to fetch leave reports: ' + JSON.stringify(reportsData));
    }
    console.log(`  ✓ Reports fetched: ${reportsData.reports.totalApplications} total applications, breakdown by status:`, reportsData.reports.byStatus);

    console.log('\n======================================================');
    console.log('🎉 ALL 13 LEAVE MANAGEMENT AUTOMATED TESTS PASSED!');
    console.log('======================================================');
  } finally {
    await stopTestServer();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed with error:', err);
  process.exit(1);
});

