import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const SESSION_TIMEOUT = 3600000;

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    if (isPublicRoute(req.path)) {
      return next();
    }
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded as UserPayload;

    if (Date.now() - req.user.issuedAt > SESSION_TIMEOUT) {
      return res.status(401).json({ error: 'Session expired' });
    }

    req.user.lastActivity = Date.now();
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function isPublicRoute(path: string): boolean {
  const publicRoutes = ['/health', '/api/public', '/login', '/register'];
  return publicRoutes.some((route) => path.startsWith(route));
}

interface UserPayload {
  id: string;
  email: string;
  role: string;
  issuedAt: number;
  lastActivity?: number;
}
