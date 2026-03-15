# 🚀 Project Blueprint & Core Functionality Guide
*A comprehensive, modular template for building scalable applications from zero*

## 📚 Table of Contents
- [Core Architecture Pattern](#-core-architecture-pattern)
- [Database Structure](#-database-structure-postgresql)
- [Authentication System](#-authentication-system)
- [Dark Theme System](#-dark-theme-system)
- [Settings System](#-comprehensive-settings-system)
- [Icon System](#-icon-system)
- [Performance Optimizations](#-performance-optimizations)
- [State Management](#-state-management)
- [API Service Layer](#-api-service-layer)
- [Form Management](#-form-management--validation)
- [Notification System](#-notification-system)
- [File Upload System](#-file-upload-system)
- [Real-time Features](#-real-time-features)
- [Internationalization](#-internationalization-i18n)
- [Testing Strategy](#-testing-strategy)
- [DevOps & Deployment](#-devops--deployment)
- [Security Best Practices](#-security-best-practices)
- [Monitoring & Analytics](#-monitoring--analytics)

---

## 🏗️ Core Architecture Pattern

### What This Does
This section defines the fundamental structure of your project. Think of it as the skeleton that supports all other features. A well-organized project structure makes it easier to find files, onboard new developers, and maintain code consistency.

### Tech Stack Pattern
```yaml
# This configuration serves as your project's DNA - defining which technologies to use
Frontend:
  - Framework: React/Next.js  # Next.js provides SSR, routing, and optimization out of the box
  - Language: TypeScript       # Adds type safety, preventing runtime errors
  - Styling: Tailwind CSS      # Utility-first CSS for rapid development
  - State: Zustand/Context API # Lightweight state management
  
Backend:
  - Runtime: Node.js           # JavaScript runtime for server-side code
  - Database: PostgreSQL       # Robust relational database with advanced features
  - ORM: Prisma/Drizzle       # Type-safe database queries
  - API: REST/tRPC/GraphQL    # Choose based on complexity needs
  
Infrastructure:
  - Hosting: Vercel/AWS        # Scalable cloud hosting
  - CDN: Cloudflare           # Global content delivery
  - Storage: S3/Cloudinary    # File and media storage
  
Tools:
  - Build: Vite/Next.js       # Fast build tools with HMR
  - Package: pnpm/bun         # Efficient package management
  - Version Control: Git      # Code versioning
  - CI/CD: GitHub Actions     # Automated testing and deployment
```

### Project Structure
```
# Each folder has a specific purpose - this separation of concerns makes the project scalable
project/
├── src/
│   ├── app/                 # Next.js 13+ app directory (routes and pages)
│   │   ├── api/            # API endpoints (/api/*)
│   │   ├── (auth)/         # Grouped routes for authentication pages
│   │   ├── (dashboard)/    # Admin/dashboard pages with shared layout
│   │   └── (marketing)/    # Public-facing marketing pages
│   │
│   ├── components/          # Reusable React components
│   │   ├── ui/             # Basic UI elements (buttons, inputs, cards)
│   │   ├── forms/          # Form-specific components
│   │   ├── layouts/        # Page layouts and navigation
│   │   ├── charts/         # Data visualization components
│   │   └── shared/         # Shared across multiple features
│   │
│   ├── lib/                 # Core utilities and configurations
│   │   ├── db.ts           # Database connection singleton
│   │   ├── auth.ts         # Authentication helpers
│   │   ├── utils.ts        # Utility functions
│   │   ├── constants.ts    # App-wide constants
│   │   └── validators.ts   # Input validation schemas
│   │
│   ├── hooks/               # Custom React hooks for logic reuse
│   │   ├── useAuth.ts      # Authentication state
│   │   ├── useDebounce.ts  # Debounce user input
│   │   └── useLocalStorage.ts # Persistent local storage
│   │
│   ├── services/            # External service integrations
│   │   ├── api/            # API call abstractions
│   │   ├── email/          # Email service
│   │   └── payment/        # Payment processing
│   │
│   ├── store/               # Global state management
│   │   ├── slices/         # State slices (user, app, etc.)
│   │   └── index.ts        # Root store configuration
│   │
│   ├── styles/              # Global styles and themes
│   │   ├── globals.css     # Base styles and CSS variables
│   │   └── themes/         # Theme configurations
│   │
│   └── types/               # TypeScript type definitions
│       ├── api.ts          # API response types
│       ├── database.ts     # Database model types
│       └── global.d.ts     # Global type declarations
│
├── database/
│   ├── migrations/          # Version-controlled schema changes
│   ├── seeds/              # Initial data for development
│   ├── functions/          # PostgreSQL functions
│   └── backups/            # Backup scripts
│
├── public/                  # Static files served directly
│   ├── images/             # Optimized images
│   ├── fonts/              # Custom fonts
│   └── locales/            # Translation files
│
├── tests/                   # Test suites
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   └── e2e/                # End-to-end tests
│
├── scripts/                 # Utility scripts
│   ├── setup.js            # Initial project setup
│   ├── seed.js             # Database seeding
│   └── migrate.js          # Run migrations
│
└── config/                  # Configuration files
    ├── nginx.conf          # Web server config
    ├── docker/             # Docker configurations
    └── k8s/                # Kubernetes manifests
```

---

## 🗄️ Database Structure (PostgreSQL)

### What This Does
This section provides a robust, scalable database schema that handles users, permissions, audit trails, and performance optimization. PostgreSQL's advanced features like JSONB, full-text search, and custom functions make it ideal for complex applications.

### Base Schema Pattern
```sql
-- =====================================================
-- CORE DATABASE SETUP
-- This creates the foundation for all your data storage
-- =====================================================

-- Extensions add extra functionality to PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- Generate unique IDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- Encryption functions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gist";     -- Advanced indexing

-- =====================================================
-- ENUM TYPES - Define allowed values for fields
-- =====================================================
CREATE TYPE user_role AS ENUM ('admin', 'moderator', 'user', 'guest');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'deleted');
CREATE TYPE notification_type AS ENUM ('info', 'warning', 'error', 'success');

-- =====================================================
-- USERS TABLE - Core user data
-- This is the foundation of your authentication system
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Authentication fields
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    username VARCHAR(100) UNIQUE,
    password_hash TEXT NOT NULL, -- Never store plain passwords!
    
    -- User information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    
    -- Role and permissions
    role user_role DEFAULT 'user',
    status user_status DEFAULT 'active',
    permissions JSONB DEFAULT '[]'::jsonb, -- Flexible permission system
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete support
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional data
    metadata JSONB DEFAULT '{}'::jsonb, -- Flexible storage for extra data
    
    -- Constraints
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- =====================================================
-- USER SESSIONS - Track active sessions
-- Enables features like "logout from all devices"
-- =====================================================
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, -- Hashed session token
    
    -- Session data
    ip_address INET,
    user_agent TEXT,
    device_name VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    CONSTRAINT valid_session CHECK (expires_at > created_at)
);

-- =====================================================
-- USER SETTINGS - Customizable preferences
-- Stores all user preferences in a flexible JSON structure
-- =====================================================
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Grouped settings in JSONB for flexibility
    appearance JSONB DEFAULT '{"theme": "system", "fontSize": "medium"}'::jsonb,
    notifications JSONB DEFAULT '{"email": true, "push": false}'::jsonb,
    privacy JSONB DEFAULT '{"profileVisibility": "public"}'::jsonb,
    localization JSONB DEFAULT '{"language": "en", "timezone": "UTC"}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- AUDIT LOGS - Track all important actions
-- Essential for compliance and debugging
-- =====================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Who did what
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', etc.
    
    -- What was affected
    entity_type VARCHAR(100), -- 'user', 'post', 'comment', etc.
    entity_id UUID,
    
    -- Change details
    old_values JSONB, -- Previous state
    new_values JSONB, -- New state
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    request_id UUID, -- Link related actions
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- NOTIFICATIONS - User notification queue
-- =====================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification content
    type notification_type DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    action_url TEXT, -- Where to go when clicked
    
    -- Status
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE -- Auto-delete old notifications
);

-- =====================================================
-- PERFORMANCE INDEXES
-- These make queries faster by creating sorted lookups
-- =====================================================

-- User lookups
CREATE INDEX idx_users_email_lower ON users(LOWER(email)); -- Case-insensitive email search
CREATE INDEX idx_users_username_lower ON users(LOWER(username)); -- Case-insensitive username search
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL; -- Active users by role
CREATE INDEX idx_users_created_at ON users(created_at DESC); -- Recent users first
CREATE INDEX idx_users_metadata ON users USING gin(metadata); -- JSON search

-- Session management
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at) WHERE expires_at > CURRENT_TIMESTAMP;

-- Audit trail
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Notifications
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) 
    WHERE read = FALSE AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);
```

### PLpgSQL Functions Pattern
```sql
-- =====================================================
-- REUSABLE DATABASE FUNCTIONS
-- These are like stored procedures that run in the database
-- They're faster than application code for data operations
-- =====================================================

-- -----------------------------------------------------
-- Auto-update timestamps on any table
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Soft delete functionality
-- Marks records as deleted without removing them
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION soft_delete_record(
    table_name TEXT,
    record_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    EXECUTE format('UPDATE %I SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', table_name)
    USING record_id;
    RETURN FOUND; -- Returns true if a row was updated
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------
-- Restore soft-deleted records
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION restore_record(
    table_name TEXT,
    record_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    EXECUTE format('UPDATE %I SET deleted_at = NULL WHERE id = $1', table_name)
    USING record_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------
-- Full-text search across multiple columns
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION search_users(
    search_query TEXT,
    limit_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    email VARCHAR,
    username VARCHAR,
    full_name TEXT,
    relevance REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.username,
        CONCAT(u.first_name, ' ', u.last_name) as full_name,
        ts_rank(
            to_tsvector('english', COALESCE(u.email, '') || ' ' || 
                                   COALESCE(u.username, '') || ' ' || 
                                   COALESCE(u.first_name, '') || ' ' || 
                                   COALESCE(u.last_name, '')),
            plainto_tsquery('english', search_query)
        ) as relevance
    FROM users u
    WHERE 
        u.deleted_at IS NULL
        AND (
            u.email ILIKE '%' || search_query || '%'
            OR u.username ILIKE '%' || search_query || '%'
            OR u.first_name ILIKE '%' || search_query || '%'
            OR u.last_name ILIKE '%' || search_query || '%'
        )
    ORDER BY relevance DESC, u.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------
-- Cleanup expired sessions automatically
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------
-- Get user statistics
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
    total_logins BIGINT,
    last_login TIMESTAMP WITH TIME ZONE,
    total_sessions BIGINT,
    active_sessions BIGINT,
    total_actions BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM audit_logs WHERE user_id = p_user_id AND action = 'LOGIN'),
        (SELECT last_login_at FROM users WHERE id = p_user_id),
        (SELECT COUNT(*) FROM user_sessions WHERE user_id = p_user_id),
        (SELECT COUNT(*) FROM user_sessions WHERE user_id = p_user_id AND expires_at > CURRENT_TIMESTAMP),
        (SELECT COUNT(*) FROM audit_logs WHERE user_id = p_user_id);
END;
$$ LANGUAGE plpgsql;
```

---

## 🔐 Authentication System

### What This Does
A complete authentication system that handles user registration, login, password reset, session management, and JWT tokens. This is the gatekeeper of your application - ensuring only authorized users can access protected resources.

### JWT-based Auth Pattern
```typescript
// lib/auth.ts
// This file contains all authentication logic in one place

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from './db';

// =====================================================
// CONFIGURATION
// =====================================================
export const authConfig = {
  // JWT secrets should be long, random strings
  accessTokenSecret: process.env.JWT_ACCESS_SECRET!,
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET!,
  
  // Token expiration times
  accessTokenExpiry: '15m',    // Short-lived for security
  refreshTokenExpiry: '7d',    // Longer for convenience
  
  // Password requirements
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireNumber: true,
  passwordRequireSpecial: true,
  
  // Rate limiting
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
};

// =====================================================
// PASSWORD UTILITIES
// =====================================================

/**
 * Hash a password using bcrypt
 * Cost factor 12 is a good balance of security and speed
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

/**
 * Verify a password against its hash
 */
export const verifyPassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

/**
 * Validate password strength
 */
export const validatePassword = (password: string): string[] => {
  const errors: string[] = [];
  
  if (password.length < authConfig.passwordMinLength) {
    errors.push(`Password must be at least ${authConfig.passwordMinLength} characters`);
  }
  
  if (authConfig.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (authConfig.passwordRequireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (authConfig.passwordRequireSpecial && !/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return errors;
};

// =====================================================
// TOKEN MANAGEMENT
// =====================================================

/**
 * Generate access and refresh tokens for a user
 */
export const generateTokens = (userId: string, email: string) => {
  // Access token - contains minimal data, short-lived
  const accessToken = jwt.sign(
    { 
      userId, 
      email,
      type: 'access' 
    },
    authConfig.accessTokenSecret,
    { 
      expiresIn: authConfig.accessTokenExpiry,
      issuer: 'your-app-name',
      audience: 'your-app-users'
    }
  );
  
  // Refresh token - used to get new access tokens
  const refreshToken = jwt.sign(
    { 
      userId,
      type: 'refresh',
      tokenId: crypto.randomUUID() // Unique ID for revocation
    },
    authConfig.refreshTokenSecret,
    { 
      expiresIn: authConfig.refreshTokenExpiry,
      issuer: 'your-app-name'
    }
  );
  
  return { accessToken, refreshToken };
};

/**
 * Verify and decode a JWT token
 */
export const verifyToken = (token: string, type: 'access' | 'refresh') => {
  const secret = type === 'access' 
    ? authConfig.accessTokenSecret 
    : authConfig.refreshTokenSecret;
    
  try {
    const decoded = jwt.verify(token, secret) as any;
    
    // Verify token type
    if (decoded.type !== type) {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

// =====================================================
// AUTHENTICATION FLOWS
// =====================================================

/**
 * Register a new user
 */
export const register = async (data: {
  email: string;
  password: string;
  username?: string;
}) => {
  // Validate password
  const passwordErrors = validatePassword(data.password);
  if (passwordErrors.length > 0) {
    throw new Error(passwordErrors.join(', '));
  }
  
  // Check if user exists
  const existingUser = await db.query(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [data.email, data.username]
  );
  
  if (existingUser.rows.length > 0) {
    throw new Error('User already exists');
  }
  
  // Hash password and create user
  const hashedPassword = await hashPassword(data.password);
  
  const result = await db.query(
    `INSERT INTO users (email, username, password_hash) 
     VALUES ($1, $2, $3) 
     RETURNING id, email, username`,
    [data.email, data.username, hashedPassword]
  );
  
  const user = result.rows[0];
  
  // Generate tokens
  const tokens = generateTokens(user.id, user.email);
  
  // Create session
  await createSession(user.id, tokens.refreshToken);
  
  return {
    user,
    ...tokens
  };
};

/**
 * Login user
 */
export const login = async (data: {
  email: string;
  password: string;
  deviceName?: string;
}) => {
  // Get user
  const result = await db.query(
    'SELECT id, email, username, password_hash, status FROM users WHERE email = $1',
    [data.email]
  );
  
  const user = result.rows[0];
  
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  // Check account status
  if (user.status !== 'active') {
    throw new Error(`Account is ${user.status}`);
  }
  
  // Verify password
  const isValid = await verifyPassword(data.password, user.password_hash);
  
  if (!isValid) {
    // Log failed attempt
    await logFailedLogin(data.email);
    throw new Error('Invalid credentials');
  }
  
  // Generate tokens
  const tokens = generateTokens(user.id, user.email);
  
  // Create session
  await createSession(user.id, tokens.refreshToken, data.deviceName);
  
  // Update last login
  await db.query(
    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
    [user.id]
  );
  
  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username
    },
    ...tokens
  };
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (refreshToken: string) => {
  // Verify refresh token
  const decoded = verifyToken(refreshToken, 'refresh');
  
  // Check if session exists and is valid
  const session = await db.query(
    'SELECT * FROM user_sessions WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP',
    [hashToken(refreshToken)]
  );
  
  if (session.rows.length === 0) {
    throw new Error('Invalid session');
  }
  
  // Get user
  const user = await db.query(
    'SELECT id, email FROM users WHERE id = $1',
    [decoded.userId]
  );
  
  if (user.rows.length === 0) {
    throw new Error('User not found');
  }
  
  // Generate new access token
  const accessToken = jwt.sign(
    { 
      userId: decoded.userId,
      email: user.rows[0].email,
      type: 'access'
    },
    authConfig.accessTokenSecret,
    { expiresIn: authConfig.accessTokenExpiry }
  );
  
  // Update session activity
  await db.query(
    'UPDATE user_sessions SET last_activity_at = CURRENT_TIMESTAMP WHERE id = $1',
    [session.rows[0].id]
  );
  
  return { accessToken };
};

// =====================================================
// SESSION MANAGEMENT
// =====================================================

/**
 * Create a new session
 */
const createSession = async (
  userId: string, 
  refreshToken: string,
  deviceName?: string
) => {
  const hashedToken = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  await db.query(
    `INSERT INTO user_sessions (user_id, token_hash, device_name, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, hashedToken, deviceName, expiresAt]
  );
};

/**
 * Hash a token for storage
 */
const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Logout user (invalidate session)
 */
export const logout = async (refreshToken: string) => {
  const hashedToken = hashToken(refreshToken);
  
  await db.query(
    'DELETE FROM user_sessions WHERE token_hash = $1',
    [hashedToken]
  );
};

/**
 * Logout from all devices
 */
export const logoutAllDevices = async (userId: string) => {
  await db.query(
    'DELETE FROM user_sessions WHERE user_id = $1',
    [userId]
  );
};

// =====================================================
// MIDDLEWARE
// =====================================================

/**
 * Express/Next.js middleware to protect routes
 */
export const authMiddleware = async (req: Request) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('No token provided');
  }
  
  try {
    const decoded = verifyToken(token, 'access');
    
    // Add user to request
    (req as any).user = {
      id: decoded.userId,
      email: decoded.email
    };
    
    return decoded;
  } catch (error) {
    throw new Error('Unauthorized');
  }
};

// =====================================================
// SECURITY UTILITIES
// =====================================================

/**
 * Log failed login attempt
 */
const logFailedLogin = async (email: string) => {
  await db.query(
    `INSERT INTO audit_logs (action, entity_type, metadata)
     VALUES ('LOGIN_FAILED', 'user', $1)`,
    [JSON.stringify({ email, timestamp: new Date() })]
  );
};

/**
 * Generate secure random token
 */
export const generateSecureToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate OTP for 2FA
 */
export const generateOTP = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};
```

---

## 🌓 Dark Theme System

### What This Does
A complete theme system that respects user preferences, system settings, and provides smooth transitions. This enhances user experience and reduces eye strain in low-light conditions.

### Theme Provider Implementation
```typescript
// providers/ThemeProvider.tsx
// This wraps your entire app and manages theme state globally

'use client';

import { createContext, useContext, useEffect, useState } from 'react';

// Define the possible theme values
type Theme = 'dark' | 'light' | 'system';

// Define what the theme context will provide
interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

// Create the context
const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'dark' | 'light'; // The actual theme being used
}>({
  theme: 'system',
  setTheme: () => null,
  resolvedTheme: 'light',
});

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'app-theme',
  enableSystem = true,
  disableTransitionOnChange = false,
  ...props
}: ThemeProviderProps) {
  // Initialize theme from localStorage or use default
  const [theme, setThemeState] = useState<Theme>(
    () => (typeof window !== 'undefined' 
      ? (localStorage.getItem(storageKey) as Theme) 
      : defaultTheme) || defaultTheme
  );
  
  // Track the resolved theme (what's actually being displayed)
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('light');

  // Apply theme to document root
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Optional: disable transitions when changing themes
    if (disableTransitionOnChange) {
      root.classList.add('[&_*]:!transition-none');
      window.setTimeout(() => {
        root.classList.remove('[&_*]:!transition-none');
      }, 0);
    }
    
    // Remove both classes first
    root.classList.remove('light', 'dark');

    if (theme === 'system' && enableSystem) {
      // Use system preference
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
      setResolvedTheme(systemTheme);
      
      // Listen for system theme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? 'dark' : 'light';
        root.classList.remove('light', 'dark');
        root.classList.add(newTheme);
        setResolvedTheme(newTheme);
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Use manual theme
      root.classList.add(theme);
      setResolvedTheme(theme as 'dark' | 'light');
    }
  }, [theme, enableSystem, disableTransitionOnChange]);

  // Enhanced setTheme that also saves to localStorage
  const setTheme = (newTheme: Theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, newTheme);
    }
    setThemeState(newTheme);
  };

  const value = {
    theme,
    setTheme,
    resolvedTheme,
  };

  return (
    <ThemeContext.Provider {...props} value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to use theme in any component
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
```

### Theme Toggle Component
```typescript
// components/ThemeToggle.tsx
// A reusable theme toggle button

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  
  // Cycle through themes
  const toggleTheme = () => {
    const themeOrder: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themeOrder.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    setTheme(themeOrder[nextIndex]);
  };
  
  return (
    <button
      onClick={toggleTheme}
      className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label="Toggle theme"
    >
      {/* Show appropriate icon based on current theme */}
      {theme === 'system' ? (
        <Monitor className="h-5 w-5" />
      ) : resolvedTheme === 'dark' ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </button>
  );
}
```

---

## ⚙️ Comprehensive Settings System

### What This Does
A flexible settings system that handles all user preferences, from UI customization to privacy settings. This creates a personalized experience for each user and stores preferences efficiently.

### Settings Implementation
```typescript
// providers/SettingsProvider.tsx
// Manages all user settings with automatic persistence

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { debounce } from '@/lib/utils';

// Complete settings schema
export interface UserSettings {
  appearance: {
    theme: 'light' | 'dark' | 'system';
    accentColor: string;
    fontSize: 'small' | 'medium' | 'large';
    fontFamily: 'system' | 'serif' | 'mono';
    animations: boolean;
    compactMode: boolean;
    sidebarCollapsed: boolean;
  };
  
  notifications: {
    email: {
      enabled: boolean;
      frequency: 'instant' | 'daily' | 'weekly';
      types: {
        updates: boolean;
        security: boolean;
        marketing: boolean;
        mentions: boolean;
      };
    };
    push: boolean;
    inApp: boolean;
    sound: boolean;
    desktop: boolean;
  };
  
  privacy: {
    profileVisibility: 'public' | 'private' | 'contacts';
    activityStatus: boolean;
    lastSeen: boolean;
    readReceipts: boolean;
    dataSharing: boolean;
    analytics: boolean;
    personalization: boolean;
  };
  
  localization: {
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
    currency: string;
    numberFormat: string;
  };
  
  accessibility: {
    screenReader: boolean;
    keyboardNavigation: boolean;
    reducedMotion: boolean;
    highContrast: boolean;
    focusIndicators: boolean;
    captions: boolean;
  };
  
  editor: {
    autoSave: boolean;
    autoSaveInterval: number;
    spellCheck: boolean;
    wordWrap: boolean;
    lineNumbers: boolean;
    minimap: boolean;
    bracketMatching: boolean;
  };
}

// Default settings
const defaultSettings: UserSettings = {
  appearance: {
    theme: 'system',
    accentColor: '#3b82f6',
    fontSize: 'medium',
    fontFamily: 'system',
    animations: true,
    compactMode: false,
    sidebarCollapsed: false,
  },
  // ... rest of defaults
};

// Context
const SettingsContext = createContext<{
  settings: UserSettings;
  updateSettings: (path: string, value: any) => void;
  resetSettings: () => void;
  importSettings: (settings: Partial<UserSettings>) => void;
  exportSettings: () => UserSettings;
}>({} as any);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Try localStorage first
        const stored = localStorage.getItem('userSettings');
        if (stored) {
          setSettings(JSON.parse(stored));
        }
        
        // Then sync with server
        const response = await fetch('/api/settings');
        if (response.ok) {
          const serverSettings = await response.json();
          setSettings(serverSettings);
          localStorage.setItem('userSettings', JSON.stringify(serverSettings));
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, []);

  // Debounced save to server
  const saveToServer = useCallback(
    debounce(async (newSettings: UserSettings) => {
      try {
        await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSettings),
        });
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    }, 1000),
    []
  );

  // Update a specific setting using dot notation
  const updateSettings = useCallback((path: string, value: any) => {
    setSettings((prev) => {
      const updated = { ...prev };
      const keys = path.split('.');
      let current: any = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      
      // Save locally
      localStorage.setItem('userSettings', JSON.stringify(updated));
      
      // Save to server
      saveToServer(updated);
      
      return updated;
    });
  }, [saveToServer]);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
    localStorage.setItem('userSettings', JSON.stringify(defaultSettings));
    saveToServer(defaultSettings);
  }, [saveToServer]);

  // Import settings
  const importSettings = useCallback((imported: Partial<UserSettings>) => {
    const merged = { ...defaultSettings, ...imported };
    setSettings(merged);
    localStorage.setItem('userSettings', JSON.stringify(merged));
    saveToServer(merged);
  }, [saveToServer]);

  // Export settings
  const exportSettings = useCallback(() => settings, [settings]);

  return (
    <SettingsContext.Provider 
      value={{
        settings,
        updateSettings,
        resetSettings,
        importSettings,
        exportSettings,
      }}
    >
      {!isLoading && children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};
```

---

## 🎨 Icon System

### What This Does
A centralized icon management system that provides consistent iconography across your app. Supports multiple icon libraries and custom icons with optimized loading.

### Dynamic Icon System
```typescript
// lib/icons.ts
// Centralized icon management with lazy loading

import dynamic from 'next/dynamic';
import { LucideProps } from 'lucide-react';
import dynamicIconImports from 'lucide-react/dynamicIconImports';

// Define available icons
export type IconName = keyof typeof dynamicIconImports;

// Icon component with dynamic loading
interface IconProps extends Omit<LucideProps, 'ref'> {
  name: IconName;
  fallback?: React.ReactNode;
}

export const Icon = ({ name, fallback, ...props }: IconProps) => {
  const LucideIcon = dynamic(
    dynamicIconImports[name],
    {
      loading: () => fallback || <div className="animate-pulse bg-gray-200 rounded" style={{ width: props.size || 24, height: props.size || 24 }} />,
    }
  );
  
  return <LucideIcon {...props} />;
};

// Custom icons for branding
export const CustomIcons = {
  logo: (props: LucideProps) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  
  spinner: (props: LucideProps) => (
    <svg {...props} className={`animate-spin ${props.className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  ),
};

// Icon picker component for settings
export const IconPicker = ({ 
  value, 
  onChange 
}: { 
  value: IconName; 
  onChange: (icon: IconName) => void;
}) => {
  const popularIcons: IconName[] = [
    'home', 'settings', 'user', 'search', 'heart', 
    'star', 'bell', 'mail', 'calendar', 'clock'
  ];
  
  return (
    <div className="grid grid-cols-5 gap-2">
      {popularIcons.map((icon) => (
        <button
          key={icon}
          onClick={() => onChange(icon)}
          className={`p-2 rounded hover:bg-gray-100 ${value === icon ? 'bg-blue-100' : ''}`}
        >
          <Icon name={icon} size={20} />
        </button>
      ))}
    </div>
  );
};
```

---

## ⚡ Performance Optimizations

### What This Does
Performance optimizations ensure your app runs smoothly even with large datasets. These patterns prevent unnecessary re-renders, optimize database queries, and implement efficient caching strategies.

### React Performance Patterns
```typescript
// hooks/useOptimized.ts
// Collection of performance optimization hooks and utilities

import { 
  useMemo, 
  useCallback, 
  memo, 
  useRef, 
  useEffect,
  useState,
  useTransition,
  useDeferredValue 
} from 'react';

// =====================================================
// DEBOUNCE HOOK
// Delays execution of a function until after delay
// =====================================================
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// =====================================================
// THROTTLE HOOK
// Limits function execution to once per interval
// =====================================================
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRun = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRun.current >= interval) {
        setThrottledValue(value);
        lastRun.current = Date.now();
      }
    }, interval - (Date.now() - lastRun.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, interval]);

  return throttledValue;
}

// =====================================================
// INTERSECTION OBSERVER HOOK
// Detect when elements enter/leave viewport
// =====================================================
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options?: IntersectionObserverInit
) {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return isIntersecting;
}

// =====================================================
// VIRTUAL SCROLLING HOOK
// Renders only visible items in long lists
// =====================================================
export function useVirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
}: {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  return {
    visibleItems,
    totalHeight,
    offsetY,
    onScroll: (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    },
  };
}

// =====================================================
// LAZY LOAD IMAGE COMPONENT
// Loads images only when they're about to enter viewport
// =====================================================
export const LazyImage = memo(({ 
  src, 
  alt, 
  placeholder,
  ...props 
}: React.ImgHTMLAttributes<HTMLImageElement> & { placeholder?: string }) => {
  const [imageSrc, setImageSrc] = useState(placeholder || '');
  const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let observer: IntersectionObserver;

    if (imageRef && src) {
      observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              setImageSrc(src);
              observer.unobserve(imageRef);
            }
          });
        },
        { threshold: 0.1 }
      );
      observer.observe(imageRef);
    }

    return () => {
      if (observer) observer.disconnect();
    };
  }, [imageRef, src]);

  return (
    <img
      ref={setImageRef}
      src={imageSrc}
      alt={alt}
      {...props}
    />
  );
});

// =====================================================
// MEMOIZED LIST COMPONENT
// Prevents unnecessary re-renders of list items
// =====================================================
interface ListItemProps {
  item: any;
  onAction: (id: string) => void;
}

const ListItem = memo(({ item, onAction }: ListItemProps) => {
  // Component only re-renders if item or onAction changes
  return (
    <div onClick={() => onAction(item.id)}>
      {item.name}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.name === nextProps.item.name
  );
});

// =====================================================
// OPTIMIZED SEARCH WITH CONCURRENT FEATURES
// Uses React 18 concurrent features for better UX
// =====================================================
export function OptimizedSearch({ data }: { data: any[] }) {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);

  // Heavy filtering operation
  const filteredData = useMemo(() => {
    if (!deferredQuery) return data;
    
    return data.filter(item => 
      item.name.toLowerCase().includes(deferredQuery.toLowerCase())
    );
  }, [data, deferredQuery]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Mark state update as non-urgent
    startTransition(() => {
      setQuery(e.target.value);
    });
  };

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={handleSearch}
        placeholder="Search..."
        className={isPending ? 'opacity-50' : ''}
      />
      <div>
        {filteredData.map(item => (
          <div key={item.id}>{item.name}</div>
        ))}
      </div>
    </div>
  );
}
```

### Database Optimization Patterns
```sql
-- =====================================================
-- ADVANCED INDEXING STRATEGIES
-- Indexes make queries faster by creating sorted lookups
-- =====================================================

-- Partial index: Only index rows that match a condition
-- Saves space and improves performance for common queries
CREATE INDEX idx_active_users ON users(email) 
WHERE deleted_at IS NULL AND status = 'active';

-- Composite index: Multiple columns for complex queries
CREATE INDEX idx_users_search ON users(lower(email), lower(username), created_at DESC);

-- GIN index for JSONB columns: Enables fast JSON queries
CREATE INDEX idx_users_metadata_gin ON users USING gin(metadata);

-- Full-text search index
CREATE INDEX idx_users_fulltext ON users 
USING gin(to_tsvector('english', coalesce(email, '') || ' ' || coalesce(username, '') || ' ' || coalesce(first_name, '') || ' ' || coalesce(last_name, '')));

-- =====================================================
-- MATERIALIZED VIEWS FOR EXPENSIVE QUERIES
-- Pre-computed results that update periodically
-- =====================================================

-- User statistics that would be expensive to calculate on every request
CREATE MATERIALIZED VIEW user_activity_stats AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(DISTINCT s.id) as total_sessions,
    COUNT(DISTINCT DATE(al.created_at)) as active_days,
    MAX(s.last_activity_at) as last_active,
    COALESCE(
        json_agg(
            DISTINCT jsonb_build_object(
                'action', al.action,
                'count', action_counts.count
            )
        ) FILTER (WHERE al.action IS NOT NULL),
        '[]'::json
    ) as action_summary
FROM users u
LEFT JOIN user_sessions s ON s.user_id = u.id
LEFT JOIN audit_logs al ON al.user_id = u.id
LEFT JOIN LATERAL (
    SELECT action, COUNT(*) as count
    FROM audit_logs
    WHERE user_id = u.id
    GROUP BY action
) action_counts ON true
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.email;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX ON user_activity_stats(user_id);

-- Refresh function to be called periodically
CREATE OR REPLACE FUNCTION refresh_user_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_activity_stats;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- QUERY OPTIMIZATION FUNCTIONS
-- =====================================================

-- Optimized pagination with cursor
CREATE OR REPLACE FUNCTION get_users_cursor(
    p_cursor TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    email VARCHAR,
    username VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE,
    has_more BOOLEAN
) AS $$
DECLARE
    v_has_more BOOLEAN;
BEGIN
    -- Create temp table with results
    CREATE TEMP TABLE temp_results AS
    SELECT 
        u.id,
        u.email,
        u.username,
        u.created_at
    FROM users u
    WHERE 
        u.deleted_at IS NULL
        AND (p_cursor IS NULL OR u.created_at < p_cursor)
    ORDER BY u.created_at DESC
    LIMIT p_limit + 1; -- Get one extra to check if there's more
    
    -- Check if there are more results
    SELECT COUNT(*) > p_limit INTO v_has_more FROM temp_results;
    
    -- Return results (excluding the extra row)
    RETURN QUERY
    SELECT 
        t.id,
        t.email,
        t.username,
        t.created_at,
        v_has_more
    FROM temp_results t
    LIMIT p_limit;
    
    DROP TABLE temp_results;
END;
$$ LANGUAGE plpgsql;
```

---

## 🔄 State Management

### What This Does
Global state management keeps your app's data synchronized across all components. Zustand provides a simple yet powerful solution that's easier than Redux but more robust than Context API alone.

### Zustand Store Implementation
```typescript
// store/index.ts
// Central state management with Zustand

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: string;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  timestamp: Date;
  read: boolean;
}

interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  
  // UI state
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  
  // Loading states
  isLoading: Record<string, boolean>;
  
  // Error states
  errors: Record<string, string>;
}

interface AppActions {
  // User actions
  setUser: (user: User | null) => void;
  logout: () => void;
  
  // UI actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  // Notification actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Loading actions
  setLoading: (key: string, loading: boolean) => void;
  
  // Error actions
  setError: (key: string, error: string | null) => void;
  clearErrors: () => void;
  
  // Utility actions
  reset: () => void;
}

type Store = AppState & AppActions;

// =====================================================
// INITIAL STATE
// =====================================================

const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  sidebarOpen: true,
  theme: 'system',
  notifications: [],
  unreadCount: 0,
  isLoading: {},
  errors: {},
};

// =====================================================
// STORE CREATION
// =====================================================

export const useStore = create<Store>()(
  subscribeWithSelector(
    devtools(
      persist(
        immer((set, get) => ({
          ...initialState,

          // User actions
          setUser: (user) =>
            set((state) => {
              state.user = user;
              state.isAuthenticated = !!user;
            }),

          logout: () =>
            set((state) => {
              state.user = null;
              state.isAuthenticated = false;
              state.notifications = [];
            }),

          // UI actions
          toggleSidebar: () =>
            set((state) => {
              state.sidebarOpen = !state.sidebarOpen;
            }),

          setSidebarOpen: (open) =>
            set((state) => {
              state.sidebarOpen = open;
            }),

          setTheme: (theme) =>
            set((state) => {
              state.theme = theme;
            }),

          // Notification actions
          addNotification: (notification) =>
            set((state) => {
              const newNotification: Notification = {
                ...notification,
                id: crypto.randomUUID(),
                timestamp: new Date(),
                read: false,
              };
              state.notifications.unshift(newNotification);
              state.unreadCount += 1;
              
              // Auto-remove after 10 seconds for non-error notifications
              if (notification.type !== 'error') {
                setTimeout(() => {
                  get().removeNotification(newNotification.id);
                }, 10000);
              }
            }),

          markNotificationRead: (id) =>
            set((state) => {
              const notification = state.notifications.find((n) => n.id === id);
              if (notification && !notification.read) {
                notification.read = true;
                state.unreadCount = Math.max(0, state.unreadCount - 1);
              }
            }),

          markAllNotificationsRead: () =>
            set((state) => {
              state.notifications.forEach((n) => {
                n.read = true;
              });
              state.unreadCount = 0;
            }),

          removeNotification: (id) =>
            set((state) => {
              const index = state.notifications.findIndex((n) => n.id === id);
              if (index !== -1) {
                const notification = state.notifications[index];
                if (!notification.read) {
                  state.unreadCount = Math.max(0, state.unreadCount - 1);
                }
                state.notifications.splice(index, 1);
              }
            }),

          clearNotifications: () =>
            set((state) => {
              state.notifications = [];
              state.unreadCount = 0;
            }),

          // Loading actions
          setLoading: (key, loading) =>
            set((state) => {
              if (loading) {
                state.isLoading[key] = true;
              } else {
                delete state.isLoading[key];
              }
            }),

          // Error actions
          setError: (key, error) =>
            set((state) => {
              if (error) {
                state.errors[key] = error;
              } else {
                delete state.errors[key];
              }
            }),

          clearErrors: () =>
            set((state) => {
              state.errors = {};
            }),

          // Utility actions
          reset: () => set(initialState),
        })),
        {
          name: 'app-store',
          // Only persist certain fields
          partialize: (state) => ({
            user: state.user,
            theme: state.theme,
            sidebarOpen: state.sidebarOpen,
          }),
        }