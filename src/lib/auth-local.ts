import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const COOKIE_NAME = 'auth_token';
const TOKEN_EXPIRY = '7d';

// In Electron, the app runs over http://localhost so secure cookies won't work.
// Also detect localhost in general to avoid cookie issues in development.
const IS_LOCALHOST = process.env.HOSTNAME === 'localhost' || process.env.ELECTRON_APP === 'true';

export interface JWTPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Set the auth cookie with a JWT token
 */
export async function setAuthCookie(payload: JWTPayload): Promise<void> {
  const token = generateToken(payload);
  const cookieStore = await cookies();
  
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && !IS_LOCALHOST,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

/**
 * Clear the auth cookie (logout)
 */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Get the current authenticated user from the cookie
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  
  if (!token) return null;
  
  const payload = verifyToken(token);
  if (!payload) return null;
  
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      isActive: true,
    },
  });
  
  if (!user || !user.isActive) return null;
  
  return user;
}

/**
 * Get authenticated user or redirect to login
 */
export async function getAuthenticatedUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

/**
 * Check if user has admin role
 */
export function isAdmin(user: AuthUser): boolean {
  return user.role === 'ADMIN';
}

/**
 * Require admin role or redirect
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await getAuthenticatedUser();
  if (!isAdmin(user)) {
    redirect('/dashboard');
  }
  return user;
}

/**
 * Get authenticated user with their tenants and active tenant
 */
export async function getAuthenticatedUserWithTenant(tenantId?: string) {
  const user = await getAuthenticatedUser();
  
  // Get user's own tenants first
  const ownTenants = await prisma.tenant.findMany({
    where: { userId: user.id },
    include: { businessProfile: true },
    orderBy: { createdAt: 'asc' },
  });

  // For admins, also get other tenants they can access
  let allTenants = ownTenants;
  if (isAdmin(user)) {
    const otherTenants = await prisma.tenant.findMany({
      where: { userId: { not: user.id } },
      include: { businessProfile: true },
      orderBy: { createdAt: 'asc' },
    });
    allTenants = [...ownTenants, ...otherTenants];
  }
  
  // Resolve active tenant
  let activeTenant = null;
  if (tenantId) {
    if (isAdmin(user)) {
      activeTenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { businessProfile: true },
      });
    } else {
      activeTenant = allTenants.find(t => t.id === tenantId) || null;
    }
  }
  
  // Default to user's own tenant first, then any available tenant
  if (!activeTenant && ownTenants.length > 0) {
    activeTenant = ownTenants[0];
  } else if (!activeTenant && allTenants.length > 0) {
    activeTenant = allTenants[0];
  }
  
  return {
    user,
    tenants: allTenants,
    activeTenant,
  };
}

/**
 * Create the default admin user if none exists
 */
export async function ensureAdminExists(): Promise<void> {
  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
  
  if (adminCount === 0) {
    const defaultPassword = 'admin123'; // Should be changed on first login
    const hashedPassword = await hashPassword(defaultPassword);
    
    await prisma.user.create({
      data: {
        email: 'admin@localhost',
        password: hashedPassword,
        name: 'Administrator',
        role: 'ADMIN',
      },
    });
    
    console.log('Default admin created: admin@localhost / admin123');
  }
}
