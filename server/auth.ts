import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { dbManager, hashPassword } from './db.ts';
import type { AuthUser, AdminUser, CandidateUser } from '../src/types/index.ts';

// In-memory token session storage mapping token -> userId + role
interface Session {
  userId: string;
  role: 'admin' | 'candidate';
  createdAt: number;
}

const sessions = new Map<string, Session>();

export function generateToken(userId: string, role: 'admin' | 'candidate'): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    userId,
    role,
    createdAt: Date.now(),
  });
  return token;
}

export function revokeToken(token: string): void {
  sessions.delete(token);
}

export function getUserFromToken(token: string): AuthUser | null {
  const session = sessions.get(token);
  if (!session) return null;

  const db = dbManager.get();
  if (session.role === 'admin') {
    if (db.admin.id === session.userId) {
      return {
        id: db.admin.id,
        email: db.admin.email,
        name: db.admin.name,
        role: 'admin',
      };
    }
  } else if (session.role === 'candidate') {
    const cand = db.candidates.find((c) => c.id === session.userId);
    if (cand) {
      const course = db.courses.find((cr) => cr.id === cand.courseId);
      const batch = db.batches.find((b) => b.id === cand.currentBatchId);
      return {
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
      };
    }
  }
  return null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split(' ')[1];
  const user = getUserFromToken(token);
  if (user) {
    req.user = user;
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Super Admin authority required' });
    return;
  }
  next();
}

export function requireCandidate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'candidate') {
    res.status(403).json({ error: 'Candidate authority required' });
    return;
  }
  next();
}
