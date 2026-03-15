/**
 * Bot Worker Process
 *
 * This standalone process manages Baileys (WhatsApp Web) connections
 * for tenants who use the Baileys channel. It runs separately from
 * the Next.js server.
 *
 * Usage: npm run bot:worker  (or: npx tsx src/lib/bot/worker.ts)
 *
 * Cloud API tenants don't need this worker — their messages come
 * via the /api/webhooks/whatsapp route in Next.js.
 */

import { PrismaClient } from '@prisma/client';
import { baileysManager } from './channels/baileys';
import { processIncomingMessage } from './message-handler';
import { logger } from './logger';

// Use a fresh Prisma client for the worker process
const prisma = new PrismaClient();

async function main() {
  logger.info('🤖 Bot Worker starting...');

  await prisma.$connect();
  logger.info('✅ Database connected');

  // Find all tenants with active Baileys configs
  const configs = await prisma.whatsappConfig.findMany({
    where: {
      channel: 'BAILEYS',
      isActive: true,
    },
    include: {
      tenant: true,
    },
  });

  logger.info({ count: configs.length }, 'Found Baileys tenants to connect');

  // Start a Baileys connection for each tenant
  for (const config of configs) {
    const tenantId = config.tenantId;
    logger.info({ tenantId }, 'Starting Baileys connection');

    try {
      await baileysManager.startConnection(tenantId, processIncomingMessage);
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to start Baileys connection');
    }
  }

  if (configs.length === 0) {
    logger.info('No Baileys tenants configured. Waiting for new connections...');
  }

  // Keep the process alive
  logger.info('🟢 Bot Worker running. Press Ctrl+C to stop.');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down...`);

    const tenants = baileysManager.getConnectedTenants();
    for (const tenantId of tenants) {
      await baileysManager.disconnect(tenantId);
    }

    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error in Bot Worker');
  process.exit(1);
});
