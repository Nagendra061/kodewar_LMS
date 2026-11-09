import type { LeaveStatus, LeavePolicy } from '../../types/index.ts';

/**
 * Returns today's date formatted as YYYY-MM-DD in the designated timezone or local date.
 */
export function getTodayDateString(timezone = 'Asia/Kolkata'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Parses YYYY-MM-DD string into a Date object at noon local time to prevent timezone skew.
 */
export function parseDateSafe(dateStr: string): Date {
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    return new Date(dateStr);
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day, 12, 0, 0);
}

/**
 * Automatically calculates leave duration in days based on company policy.
 * - 'calendar_days': Every calendar day between start and end inclusive.
 * - 'working_days': Excludes Saturdays and Sundays (standard Mon-Fri working days).
 */
export function calculateLeaveDays(
  startDateStr: string,
  endDateStr: string,
  mode: 'calendar_days' | 'working_days' = 'working_days'
): number {
  if (!startDateStr || !endDateStr) return 0;

  const start = parseDateSafe(startDateStr);
  const end = parseDateSafe(endDateStr);

  if (end < start) return 0;

  if (mode === 'calendar_days') {
    const diffMs = end.getTime() - start.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }

  // Working days calculation (Monday through Friday)
  let count = 0;
  const cur = new Date(start.getTime());

  while (cur <= end) {
    const dayOfWeek = cur.getDay(); // 0 is Sunday, 6 is Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return count;
}

/**
 * Validates leave start and end dates according to business rules.
 */
export function validateLeaveDates(
  startDateStr: string,
  endDateStr: string,
  policy?: Partial<LeavePolicy>,
  timezone = 'Asia/Kolkata'
): { isValid: boolean; error?: string } {
  if (!startDateStr) {
    return { isValid: false, error: 'Start date is required.' };
  }
  if (!endDateStr) {
    return { isValid: false, error: 'End date is required.' };
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDateStr) || !dateRegex.test(endDateStr)) {
    return { isValid: false, error: 'Dates must be in YYYY-MM-DD format.' };
  }

  const start = parseDateSafe(startDateStr);
  const end = parseDateSafe(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { isValid: false, error: 'Invalid date values provided.' };
  }

  if (end < start) {
    return { isValid: false, error: 'End date cannot be earlier than start date.' };
  }

  const todayStr = getTodayDateString(timezone);
  const today = parseDateSafe(todayStr);

  // Retrospective leave rule
  if (!policy?.allowRetrospective && start < today) {
    return {
      isValid: false,
      error: `Leave start date (${startDateStr}) cannot be earlier than today (${todayStr}) unless retrospective leave is explicitly enabled by Administrator.`,
    };
  }

  // Max consecutive days check
  if (policy?.maxConsecutiveDays) {
    const totalDays = calculateLeaveDays(startDateStr, endDateStr, policy.calculationMode || 'working_days');
    if (totalDays > policy.maxConsecutiveDays) {
      return {
        isValid: false,
        error: `Requested duration of ${totalDays} days exceeds maximum allowed limit of ${policy.maxConsecutiveDays} consecutive days.`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Checks for overlapping pending or approved leave applications.
 * Two intervals [A, B] and [C, D] overlap if A <= D and B >= C.
 */
export function checkLeaveOverlap<T extends { id?: string; startDate: string; endDate: string; status: LeaveStatus; applicationNumber?: string }>(
  newStart: string,
  newEnd: string,
  existingApplications: T[],
  excludeApplicationId?: string
): { hasOverlap: boolean; overlappingApp?: T } {
  const activeApplications = existingApplications.filter(
    (app) =>
      app.id !== excludeApplicationId &&
      (app.status === 'pending' || app.status === 'approved')
  );

  for (const app of activeApplications) {
    // Overlap condition: start <= otherEnd && end >= otherStart
    if (newStart <= app.endDate && newEnd >= app.startDate) {
      return { hasOverlap: true, overlappingApp: app };
    }
  }

  return { hasOverlap: false };
}

