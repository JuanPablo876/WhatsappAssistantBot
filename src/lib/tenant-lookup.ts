import { prisma } from '@/lib/db';
import { safeDecrypt } from '@/lib/encryption';

/**
 * Tenant lookup result with the credentials needed to handle messages/calls.
 */
export interface TenantCredentials {
  tenantId: string;
  setupType: 'RENT_NUMBER' | 'BAILEYS' | 'BYOP_TWILIO' | 'BYOP_META';
  
  // For RENT_NUMBER: we use OUR platform credentials from .env
  // For BYOP: we use the client's credentials (decrypted)
  twilioAccountSid?: string;
  twilioAuthToken?: string;  // Decrypted
  twilioPhoneNumber?: string;
  
  metaPhoneNumberId?: string;
  metaAccessToken?: string;  // Decrypted
  metaBusinessId?: string;
}

/**
 * Look up which tenant owns a phone number based on inbound webhook data.
 * 
 * For RENT_NUMBER: We look up in PlatformPhoneNumber table
 * For BYOP: We look up in WhatsappConfig by the phone number
 * 
 * @param phoneNumber - The phone number that received the message/call (E.164 format)
 * @returns TenantCredentials if found, null otherwise
 */
export async function getTenantByPhoneNumber(phoneNumber: string): Promise<TenantCredentials | null> {
  // Normalize phone number to E.164 (strip any non-digit except leading +)
  const normalized = normalizePhoneNumber(phoneNumber);
  
  // First, check if this is one of OUR platform numbers (rented to a tenant)
  const platformNumber = await prisma.platformPhoneNumber.findUnique({
    where: { phoneNumber: normalized },
  });
  
  if (platformNumber && platformNumber.tenantId && platformNumber.status === 'ASSIGNED') {
    // This is a rented number - use OUR platform credentials from .env
    return {
      tenantId: platformNumber.tenantId,
      setupType: 'RENT_NUMBER',
      // No credentials returned - caller should use process.env.TWILIO_*
    };
  }
  
  // Not a platform number - check if it's a BYOP number
  const configs = await prisma.whatsappConfig.findMany({
    where: {
      OR: [
        { twilioPhoneNumber: normalized },
        { twilioPhoneNumber: phoneNumber }, // Try original format too
      ],
      setupType: { in: ['BYOP_TWILIO', 'BYOP_META'] },
      isActive: true,
    },
  });
  
  if (configs.length > 0) {
    const config = configs[0];
    
    if (config.setupType === 'BYOP_TWILIO') {
      return {
        tenantId: config.tenantId,
        setupType: 'BYOP_TWILIO',
        twilioAccountSid: config.twilioAccountSid || undefined,
        twilioAuthToken: config.twilioAuthToken ? safeDecrypt(config.twilioAuthToken) : undefined,
        twilioPhoneNumber: config.twilioPhoneNumber || undefined,
      };
    }
    
    if (config.setupType === 'BYOP_META') {
      return {
        tenantId: config.tenantId,
        setupType: 'BYOP_META',
        metaPhoneNumberId: config.phoneNumberId || undefined,
        metaAccessToken: config.accessToken ? safeDecrypt(config.accessToken) : undefined,
        metaBusinessId: config.businessId || undefined,
      };
    }
  }
  
  return null;
}

/**
 * Get tenant credentials by tenant ID (used when we know the tenant, need their credentials).
 */
export async function getTenantCredentials(tenantId: string): Promise<TenantCredentials | null> {
  const config = await prisma.whatsappConfig.findUnique({
    where: { tenantId },
  });
  
  if (!config || !config.isActive) {
    return null;
  }
  
  if (config.setupType === 'RENT_NUMBER') {
    // Get the assigned platform number
    const platformNumber = await prisma.platformPhoneNumber.findFirst({
      where: { tenantId, status: 'ASSIGNED' },
    });
    
    return {
      tenantId,
      setupType: 'RENT_NUMBER',
      twilioPhoneNumber: platformNumber?.phoneNumber || undefined,
      // No credentials - use .env
    };
  }
  
  if (config.setupType === 'BYOP_TWILIO') {
    return {
      tenantId,
      setupType: 'BYOP_TWILIO',
      twilioAccountSid: config.twilioAccountSid || undefined,
      twilioAuthToken: config.twilioAuthToken ? safeDecrypt(config.twilioAuthToken) : undefined,
      twilioPhoneNumber: config.twilioPhoneNumber || undefined,
    };
  }
  
  if (config.setupType === 'BYOP_META') {
    return {
      tenantId,
      setupType: 'BYOP_META',
      metaPhoneNumberId: config.phoneNumberId || undefined,
      metaAccessToken: config.accessToken ? safeDecrypt(config.accessToken) : undefined,
      metaBusinessId: config.businessId || undefined,
    };
  }
  
  // Baileys doesn't need external credentials
  return {
    tenantId,
    setupType: 'BAILEYS',
  };
}

/**
 * Normalize a phone number to E.164 format.
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}

/**
 * Check if a phone number belongs to the platform (rented number).
 */
export async function isPlatformNumber(phoneNumber: string): Promise<boolean> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const platformNumber = await prisma.platformPhoneNumber.findUnique({
    where: { phoneNumber: normalized },
  });
  return !!platformNumber;
}

/**
 * Get platform Twilio credentials from environment.
 * Used when handling calls/messages for rented numbers.
 */
export function getPlatformTwilioCredentials() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    webhookUrl: process.env.TWILIO_WEBHOOK_URL,
  };
}
