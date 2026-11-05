import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { dbManager, hashPassword } from './db.ts';
import type { AuthUser, AdminUser, CandidateUser } from '../src/types/index.ts';

// Stateless HMAC token secret (ensures tokens validate across all Vercel serverless containers)
const SESSION_SECRET = process.env.SESSION_SECRET || 'kodewar-lms-secure-token-secret-2026';

interface Session {
  userId: string;
  role: 'admin' | 'candidate';
  createdAt: number;
}

interface TokenPayload {
  userId: string;
  role: 'admin' | 'candidate';
  exp: number;
}

const sessions = new Map<string, Session>();

export function generateToken(userId: string, role: 'admin' | 'candidate'): string {
  const payload: TokenPayload = {
    userId,
    role,
    exp: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 days valid
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const token = `${data}.${sig}`;

  // Keep in memory map as fallback for local dev
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

export function parseToken(token: string): { userId: string; role: 'admin' | 'candidate' } | null {
  // 1. Verify stateless HMAC signature (works across all serverless lambda instances)
  try {
    const parts = token.split('.');
    if (parts.length === 2) {
      const [data, sig] = parts;
      const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
      if (sig === expectedSig) {
        const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as TokenPayload;
        if (payload.exp && Date.now() <= payload.exp) {
          return { userId: payload.userId, role: payload.role };
        }
      }
    }
  } catch {}

  // 2. Fallback to in-memory map for legacy tokens
  const session = sessions.get(token);
  if (session) {
    return { userId: session.userId, role: session.role };
  }

  return null;
}

export function getUserFromToken(token: string): AuthUser | null {
  const session = parseToken(token);
  if (!session) return null;

  const db = dbManager.get();
  if (session.role === 'admin') {
    if (db.admin.id === session.userId || session.userId === 'admin-1') {
      return {
        id: db.admin.id,
        email: db.admin.email,
        name: db.admin.name,
        role: 'admin',
      };
    }
  } else if (session.role === 'candidate') {
    const cand = db.candidates.find((c) => c.id === session.userId || c.candidateId === session.userId);
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
