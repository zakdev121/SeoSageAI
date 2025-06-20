import bcrypt from 'bcryptjs';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { db } from './db';
import { users, tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { Express, Request, Response, NextFunction } from 'express';

declare module 'express-session' {
  interface SessionData {
    userId: number;
    tenantId: string;
    user: {
      id: number;
      email: string;
      name: string;
      tenantId: string;
      role: string;
    };
  }
}

const pgStore = connectPg(session);

export const sessionMiddleware = session({
  store: new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

export async function createUser(userData: {
  email: string;
  password: string;
  name: string;
  tenantId: string;
}) {
  const hashedPassword = await hashPassword(userData.password);
  
  const [user] = await db.insert(users).values({
    email: userData.email,
    password: hashedPassword,
    name: userData.name,
    tenantId: userData.tenantId,
  }).returning({
    id: users.id,
    email: users.email,
    name: users.name,
    tenantId: users.tenantId,
    role: users.role,
  });
  
  return user;
}

export async function authenticateUser(email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  
  if (!user || !user.isActive) {
    return null;
  }
  
  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return null;
  }
  
  // Update last login
  await db.update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));
  
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tenantId: user.tenantId,
    role: user.role,
  };
}

export async function getUserById(id: number) {
  const [user] = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    tenantId: users.tenantId,
    role: users.role,
  }).from(users).where(eq(users.id, id));
  
  return user || null;
}

export async function getTenantById(tenantId: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.tenantId, tenantId));
  return tenant || null;
}