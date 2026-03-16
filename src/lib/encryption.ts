import crypto from 'crypto';

/**
 * Encryption utilities for storing sensitive data in the database.
 * 
 * Uses AES-256-GCM for authenticated encryption.
 * 
 * IMPORTANT: Set ENCRYPTION_KEY in your .env (32-byte hex string, 64 characters)
 * Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    // In development, use a default key (NOT for production!)
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ ENCRYPTION_KEY not set. Using development key (NOT SECURE!)');
      return Buffer.from('0'.repeat(64), 'hex');
    }
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a string for secure database storage.
 * Returns a base64 string containing: IV (16 bytes) + encrypted data + auth tag (16 bytes)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const tag = cipher.getAuthTag();
  
  // Combine IV + encrypted + tag
  const combined = Buffer.concat([iv, encrypted, tag]);
  
  return combined.toString('base64');
}

/**
 * Decrypt a string that was encrypted with encrypt().
 * Throws an error if decryption fails (data tampered or wrong key).
 */
export function decrypt(encryptedBase64: string): string {
  if (!encryptedBase64) return '';
  
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, 'base64');
  
  // Extract IV, encrypted data, and auth tag
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}

/**
 * Check if a string appears to be encrypted (base64 format with correct length).
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  
  try {
    const decoded = Buffer.from(value, 'base64');
    // Minimum length: IV (16) + at least 1 byte data + tag (16) = 33 bytes
    return decoded.length >= 33;
  } catch {
    return false;
  }
}

/**
 * Safely decrypt a value that might not be encrypted.
 * Useful during migration from plain text to encrypted storage.
 */
export function safeDecrypt(value: string | null | undefined): string {
  if (!value) return '';
  
  // If it looks like it's already plain text (e.g., starts with "sk_", "AC", etc.)
  // or doesn't look like base64, return as-is
  if (!isEncrypted(value)) {
    return value;
  }
  
  try {
    return decrypt(value);
  } catch (error) {
    // If decryption fails, it might be plain text stored before encryption was added
    console.warn('Decryption failed, returning original value (may be unencrypted)');
    return value;
  }
}

/**
 * Hash a value for comparison (e.g., to check if a token matches without storing plain text).
 * Uses SHA-256.
 */
export function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a secure random token (e.g., for verify tokens, webhook secrets).
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}
