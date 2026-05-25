import jwt from "jsonwebtoken";

const CLERK_JWT_VERIFICATION_KEY = process.env.CLERK_JWT_VERIFICATION_KEY || "";
const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";

export interface User {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface JwtPayload {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  iat?: number;
  exp?: number;
}

export function verifyClerkJwt(token: string): JwtPayload | null {
  if (!AUTH_ENABLED) return { sub: "anonymous", email: "anon@transmux.local" };
  if (!CLERK_JWT_VERIFICATION_KEY) {
    // In dev when auth enabled but no key configured, allow through
    return { sub: "anonymous", email: "anon@transmux.local" };
  }
  try {
    const decoded = jwt.verify(token, CLERK_JWT_VERIFICATION_KEY, {
      algorithms: ["RS256"],
    }) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

export function isAuthEnabled(): boolean {
  return AUTH_ENABLED;
}

export function getUserFromRequest(req: any): User | null {
  if (!AUTH_ENABLED) return null;
  return req.user || null;
}

export function authMiddleware(req: any, res: any, next: any) {
  if (!AUTH_ENABLED) {
    req.user = { sub: "anonymous", email: "anon@transmux.local" };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Auth is enabled but no token provided — reject
    return res.status(401).json({ success: false, error: "Unauthorized. Authentication required." });
  }

  const token = authHeader.slice(7);
  const payload = verifyClerkJwt(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized. Invalid or expired token." });
  }

  req.user = payload;
  next();
}

export function requireAuth(req: any, res: any, next: any) {
  if (!AUTH_ENABLED) {
    req.user = { sub: "anonymous", email: "anon@transmux.local" };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Unauthorized. Authentication required." });
  }

  const token = authHeader.slice(7);
  const payload = verifyClerkJwt(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized. Invalid or expired token." });
  }

  req.user = payload;
  next();
}
