import { prisma } from '@/lib/db';
import { AgentService } from './agent-service';
import { AdminAgentService } from './admin/agent-service';
import { logger } from './logger';
import type { IncomingMessage } from './types';
import { sendMessage } from './send-message';

// Re-export sendMessage for backwards compatibility
export { sendMessage } from './send-message';

const agent = new AgentService();
const adminAgent = new AdminAgentService();

// Types for admin phone lookup
type AdminUserInfo = {
  userId: string;
  userName: string;
  agentMode: 'SECRET_AGENT' | 'TENANT_BOT';
};

// Cache for admin phone lookups (phone -> user info or null)
const adminPhoneCache = new Map<string, AdminUserInfo | null>();

/**
 * Check if a phone number belongs to an admin user.
 * Returns user info including agent mode if admin, null otherwise.
 */
async function getAdminUserByPhone(phone: string): Promise<AdminUserInfo | null> {
  // Normalize phone (remove non-digits)
  const normalizedPhone = phone.replace(/\D/g, '');
  
  // Check cache first
  if (adminPhoneCache.has(normalizedPhone)) {
    return adminPhoneCache.get(normalizedPhone) || null;
  }
  
  // Look up in database
  const user = await prisma.user.findFirst({
    where: {
      phone: { contains: normalizedPhone },
      role: 'ADMIN',
      isActive: true,
    },
    select: { id: true, name: true, whatsappAgentMode: true },
  });
  
  const result = user ? { 
    userId: user.id, 
    userName: user.name,
    agentMode: user.whatsappAgentMode as 'SECRET_AGENT' | 'TENANT_BOT',
  } : null;
  adminPhoneCache.set(normalizedPhone, result);
  
  // Clear cache entry after 5 minutes
  setTimeout(() => adminPhoneCache.delete(normalizedPhone), 5 * 60 * 1000);
  
  return result;
}

/**
 * Process an incoming message: run the AI agent and send the response back.
 * Supports voice messages: transcribes input, optionally generates voice response.
 * Routes admin phone numbers to Secret Agent OR tenant bot based on their preference.
 */
export async function processIncomingMessage(message: IncomingMessage): Promise<void> {
  // Check if this is an admin user messaging via WhatsApp
  const adminUser = await getAdminUserByPhone(message.from);
  
  let response: string | null;
  let useSecretAgent = false;
  
  if (adminUser) {
    if (adminUser.agentMode === 'SECRET_AGENT') {
      // Route to Secret Agent
      useSecretAgent = true;
      logger.info({ 
        from: message.from, 
        userId: adminUser.userId, 
        userName: adminUser.userName,
        mode: 'SECRET_AGENT',
      }, 'Routing to Secret Agent (admin user)');
      
      try {
        const result = await adminAgent.handleMessage(
          adminUser.userId,
          adminUser.userName,
          message.text,
          undefined // New session each time via WhatsApp (or could persist by phone)
        );
        response = result.response;
      } catch (error) {
        logger.error({ error, from: message.from }, 'Secret Agent error');
        response = '❌ Secret Agent error. Please try again or use the admin panel.';
      }
    } else {
      // TENANT_BOT mode: admin wants to test as a customer
      logger.info({ 
        from: message.from, 
        userId: adminUser.userId, 
        userName: adminUser.userName,
        mode: 'TENANT_BOT',
      }, 'Admin using tenant bot mode (testing as customer)');
      response = await agent.handleMessage(message);
    }
  } else {
    // Regular customer - use normal agent
    response = await agent.handleMessage(message);
  }

  if (response) {
    // Check if we should send a voice response
    const voiceConfig = await prisma.voiceConfig.findUnique({
      where: { tenantId: message.tenantId },
    });

    // Send voice response if:
    // - Voice is enabled for the tenant
    // - The incoming message was a voice note (type: 'audio')
    // - Not using Secret Agent (admins in SECRET_AGENT mode get text for clarity)
    const shouldSendVoice = !useSecretAgent && voiceConfig?.enabled && message.type === 'audio';
    
    logger.debug({
      tenantId: message.tenantId,
      messageType: message.type,
      voiceEnabled: voiceConfig?.enabled,
      voiceProvider: voiceConfig?.provider,
      shouldSendVoice,
      isAdmin: !!adminUser,
      agentMode: adminUser?.agentMode,
    }, 'Voice response decision');

    await sendMessage({
      to: message.from,
      text: response,
      tenantId: message.tenantId,
    }, shouldSendVoice ? voiceConfig : null);
  }
}
