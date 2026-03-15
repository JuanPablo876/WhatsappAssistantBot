import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  proto,
} from '@whiskeysockets/baileys';
import { logger } from '../logger';
import type { IncomingMessage } from '../types';
import * as fs from 'fs';
import { createVoiceServiceFromConfig } from '../../voice';
import { prisma } from '../../db';

type ConnectionStatus = 'disconnected' | 'connecting' | 'qr' | 'pairing' | 'connected';

interface TenantSession {
  socket: WASocket | null;
  handler: ((msg: IncomingMessage) => Promise<void>) | null;
  status: ConnectionStatus;
  qrCode: { qr: string; timestamp: number } | null;
  pairingCode: { code: string; timestamp: number } | null;
  pendingPairingPhone: string | null;
  retryCount: number;
  reconnectTimer: NodeJS.Timeout | null;
  manualDisconnect: boolean;
  startPromise: Promise<void> | null;
}

/**
 * Multi-tenant Baileys manager.
 * Maintains one WebSocket connection per tenant.
 */
class BaileysManager {
  private sessions = new Map<string, TenantSession>();
  private maxRetries = 5;

  private createEmptySession(): TenantSession {
    return {
      socket: null,
      handler: null,
      status: 'disconnected',
      qrCode: null,
      pairingCode: null,
      pendingPairingPhone: null,
      retryCount: 0,
      reconnectTimer: null,
      manualDisconnect: false,
      startPromise: null,
    };
  }

  private getSession(tenantId: string): TenantSession {
    const existing = this.sessions.get(tenantId);
    if (existing) return existing;
    const session = this.createEmptySession();
    this.sessions.set(tenantId, session);
    return session;
  }

  private getAuthDir(tenantId: string): string {
    return `./auth_baileys/${tenantId}`;
  }

  private hasStoredAuthState(tenantId: string): boolean {
    const authDir = this.getAuthDir(tenantId);
    if (!fs.existsSync(authDir)) return false;
    try {
      const files = fs.readdirSync(authDir);
      return files.length > 0;
    } catch {
      return false;
    }
  }

  private clearReconnectTimer(session: TenantSession): void {
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = null;
    }
  }

  private isExpired(timestamp: number, maxAgeMs: number): boolean {
    return Date.now() - timestamp > maxAgeMs;
  }

  /**
   * Get current QR code for a tenant (if any).
   */
  getQRCode(tenantId: string): { qr: string; timestamp: number } | null {
    const session = this.getSession(tenantId);
    const data = session.qrCode;
    if (!data) return null;
    if (this.isExpired(data.timestamp, 60000)) {
      session.qrCode = null;
      return null;
    }
    return data;
  }

  /**
   * Get connection status for a tenant.
   */
  getStatus(tenantId: string): ConnectionStatus {
    return this.getSession(tenantId).status;
  }

  /**
   * Get pairing code for a tenant (if any).
   */
  getPairingCode(tenantId: string): { code: string; timestamp: number } | null {
    const session = this.getSession(tenantId);
    const data = session.pairingCode;
    if (!data) return null;
    if (this.isExpired(data.timestamp, 60000)) {
      session.pairingCode = null;
      return null;
    }
    return data;
  }

  getConnectionState(tenantId: string): {
    status: ConnectionStatus;
    hasSocket: boolean;
    retryCount: number;
    hasAuthState: boolean;
  } {
    const session = this.getSession(tenantId);
    return {
      status: session.status,
      hasSocket: Boolean(session.socket),
      retryCount: session.retryCount,
      hasAuthState: this.hasStoredAuthState(tenantId),
    };
  }

  /**
   * Set pending phone number for pairing code request.
   */
  setPendingPairingPhone(tenantId: string, phoneNumber: string): void {
    const session = this.getSession(tenantId);
    session.pendingPairingPhone = phoneNumber.replace(/\D/g, '');
  }

  clearPendingPairingPhone(tenantId: string): void {
    const session = this.getSession(tenantId);
    session.pendingPairingPhone = null;
  }

  /**
   * Clear auth state for a tenant (for fresh start).
   */
  private clearAuthState(tenantId: string): void {
    const authDir = this.getAuthDir(tenantId);
    try {
      if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
        logger.info({ tenantId }, 'Cleared auth state for fresh start');
      }
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to clear auth state');
    }
  }

  /**
   * Start a Baileys connection for a specific tenant.
   */
  async startConnection(
    tenantId: string,
    onMessage: (msg: IncomingMessage) => Promise<void>,
    freshStart: boolean = false
  ): Promise<void> {
    const session = this.getSession(tenantId);
    session.handler = onMessage;

    if (session.startPromise) {
      await session.startPromise;
      return;
    }

    const startTask = this.connectTenant(tenantId, freshStart);
    session.startPromise = startTask;

    try {
      await startTask;
    } finally {
      session.startPromise = null;
    }
  }

  async ensureConnection(
    tenantId: string,
    onMessage: (msg: IncomingMessage) => Promise<void>
  ): Promise<void> {
    const session = this.getSession(tenantId);
    session.handler = onMessage;

    if (session.socket || session.startPromise) {
      return;
    }

    if (!this.hasStoredAuthState(tenantId)) {
      session.status = 'disconnected';
      return;
    }

    await this.startConnection(tenantId, onMessage, false);
  }

  private async connectTenant(tenantId: string, freshStart: boolean): Promise<void> {
    const session = this.getSession(tenantId);

    if (session.socket) {
      logger.warn({ tenantId }, 'Baileys connection already exists');
      return;
    }

    this.clearReconnectTimer(session);
    session.manualDisconnect = false;

    if (freshStart) {
      this.clearAuthState(tenantId);
      session.retryCount = 0;
      session.qrCode = null;
      session.pairingCode = null;
    }

    const authDir = this.getAuthDir(tenantId);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    session.status = 'connecting';

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const pendingPhone = session.pendingPairingPhone;

    // Fetch the latest WA Web version to avoid 405 errors from version mismatch
    let version: [number, number, number] | undefined;
    try {
      const versionInfo = await fetchLatestBaileysVersion();
      version = versionInfo.version;
      logger.info({ tenantId, version: version.join('.'), isLatest: versionInfo.isLatest }, 'Fetched WA version');
    } catch (err) {
      logger.warn({ tenantId, err }, 'Failed to fetch latest WA version, using default');
    }

    // Use ubuntu/Chrome fingerprint (Baileys default) which is well-tested
    const socket = makeWASocket({
      ...(version && { version }),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger.child({ module: 'baileys-keys', tenantId }) as any),
      },
      printQRInTerminal: false,
      logger: logger.child({ module: 'baileys', tenantId }) as any,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      qrTimeout: pendingPhone ? undefined : 60000,
    });

    session.socket = socket;

    if (pendingPhone && !state.creds.registered) {
      this.requestPairingCodeWithRetry(tenantId, socket, pendingPhone).catch((error) => {
        logger.error({ error, tenantId }, 'Failed to generate pairing code');
      });
    }

    socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      const liveSession = this.getSession(tenantId);

      if (qr) {
        liveSession.qrCode = { qr, timestamp: Date.now() };
        liveSession.pairingCode = null;
        liveSession.status = 'qr';
        liveSession.retryCount = 0;
        logger.info({ tenantId }, 'QR code generated for tenant');
      }

      if (connection === 'open') {
        liveSession.status = 'connected';
        liveSession.qrCode = null;
        liveSession.pairingCode = null;
        liveSession.pendingPairingPhone = null;
        liveSession.retryCount = 0;
        this.clearReconnectTimer(liveSession);
        logger.info({ tenantId }, 'Baileys connected for tenant');
      }

      if (connection === 'close') {
        const disconnectError = lastDisconnect?.error as any;
        const reason = disconnectError?.output?.statusCode;
        const loggedOut = reason === DisconnectReason.loggedOut;
        const shouldReconnect = !loggedOut && !liveSession.manualDisconnect;

        liveSession.socket = null;

        logger.warn(
          {
            tenantId,
            reason,
            shouldReconnect,
            retryCount: liveSession.retryCount,
            status: liveSession.status,
          },
          'Baileys connection closed'
        );

        if (loggedOut) {
          liveSession.status = 'disconnected';
          liveSession.qrCode = null;
          liveSession.pairingCode = null;
          liveSession.pendingPairingPhone = null;
          liveSession.retryCount = 0;
          this.clearReconnectTimer(liveSession);
          this.clearAuthState(tenantId);
          return;
        }

        if (!shouldReconnect) {
          liveSession.status = 'disconnected';
          this.clearReconnectTimer(liveSession);
          return;
        }

        if (liveSession.retryCount >= this.maxRetries) {
          liveSession.status = 'disconnected';
          logger.error({ tenantId, retries: liveSession.retryCount }, 'Max reconnect retries reached');
          return;
        }

        const attempt = liveSession.retryCount + 1;
        const delay = Math.min(5000 * Math.pow(2, liveSession.retryCount), 80000);
        liveSession.retryCount = attempt;
        liveSession.status = liveSession.pairingCode ? 'pairing' : liveSession.qrCode ? 'qr' : 'connecting';

        this.clearReconnectTimer(liveSession);
        liveSession.reconnectTimer = setTimeout(() => {
          const reconnectSession = this.getSession(tenantId);
          reconnectSession.reconnectTimer = null;

          if (reconnectSession.manualDisconnect || reconnectSession.socket || reconnectSession.startPromise) {
            return;
          }

          const handler = reconnectSession.handler;
          if (!handler) {
            reconnectSession.status = 'disconnected';
            return;
          }

          const shouldFreshStart = reason === 405 && !reconnectSession.pendingPairingPhone;

          this.startConnection(tenantId, handler, shouldFreshStart).catch((error) => {
            logger.error({ error, tenantId }, 'Reconnect attempt failed');
          });
        }, delay);

        logger.info({ tenantId, attempt, delay }, 'Scheduled Baileys reconnect');
      }
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      const liveSession = this.getSession(tenantId);
      const handler = liveSession.handler;
      if (!handler) return;

      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        if (!msg.key.remoteJid) continue;
        if (msg.key.remoteJid.endsWith('@g.us')) continue; // Skip group messages

        const phone = msg.key.remoteJid.replace('@s.whatsapp.net', '');

        // Check for text message
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
        
        // Check for audio/voice message
        const audioMessage = msg.message?.audioMessage;

        if (!text && !audioMessage) continue;

        let messageText = text || '';
        let messageType: 'text' | 'audio' = 'text';

        // Handle audio message - download and transcribe
        if (audioMessage && !text) {
          try {
            logger.info({ phone, tenantId }, 'Received voice message, downloading...');
            
            // Download the audio
            const audioBuffer = await downloadMediaMessage(
              msg as proto.IWebMessageInfo,
              'buffer',
              {},
              {
                logger: logger.child({ module: 'baileys-media' }) as any,
                reuploadRequest: liveSession.socket!.updateMediaMessage,
              }
            ) as Buffer;

            if (!audioBuffer || audioBuffer.length === 0) {
              logger.warn({ phone, tenantId }, 'Empty audio buffer received');
              continue;
            }

            logger.info({ phone, tenantId, size: audioBuffer.length }, 'Audio downloaded, transcribing...');

            // Get tenant's voice config for STT
            const voiceConfig = await prisma.voiceConfig.findUnique({
              where: { tenantId },
            });

            // Create voice service with tenant config (or defaults)
            const voiceService = createVoiceServiceFromConfig({
              provider: voiceConfig?.provider || 'elevenlabs',
              apiKey: voiceConfig?.apiKey,
              voiceId: voiceConfig?.voiceId,
              stability: voiceConfig?.stability ?? 0.5,
              similarityBoost: voiceConfig?.similarityBoost ?? 0.75,
            });

            // Transcribe the audio
            messageText = await voiceService.transcribe(audioBuffer, {
              filename: 'voice.ogg', // WhatsApp voice notes are typically ogg
            });

            messageType = 'audio';
            logger.info({ phone, tenantId, textLength: messageText.length }, 'Voice message transcribed successfully');

            if (!messageText.trim()) {
              logger.warn({ phone, tenantId }, 'Transcription returned empty text');
              continue;
            }
          } catch (error) {
            logger.error({ error, phone, tenantId }, 'Failed to process voice message');
            continue;
          }
        }

        if (!messageText) continue;

        const incoming: IncomingMessage = {
          id: msg.key.id || '',
          from: phone,
          text: messageText,
          timestamp: new Date((msg.messageTimestamp as number) * 1000),
          type: messageType,
          tenantId,
          raw: msg,
        };

        try {
          await handler(incoming);
        } catch (error) {
          logger.error({ error, phone, tenantId }, 'Error handling Baileys message');
        }
      }
    });
  }

  private async requestPairingCodeWithRetry(
    tenantId: string,
    socket: WASocket,
    phoneNumber: string
  ): Promise<void> {
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const session = this.getSession(tenantId);
      if (session.socket !== socket) return;

      try {
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        const code = await socket.requestPairingCode(phoneNumber);
        session.pairingCode = { code, timestamp: Date.now() };
        session.qrCode = null;
        session.status = 'pairing';
        session.pendingPairingPhone = null;
        logger.info({ tenantId, attempt }, 'Pairing code generated');
        return;
      } catch (error) {
        logger.warn({ tenantId, attempt, error }, 'Pairing code generation failed');
      }
    }

    const session = this.getSession(tenantId);
    if (session.status === 'connecting') {
      session.status = this.getQRCode(tenantId) ? 'qr' : 'disconnected';
    }
  }

  /**
   * Send a message via a tenant's Baileys connection.
   */
  async sendMessage(tenantId: string, to: string, text: string): Promise<void> {
    const socket = this.getSession(tenantId).socket;
    if (!socket) {
      throw new Error(`No Baileys connection for tenant ${tenantId}`);
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    await socket.sendMessage(jid, { text });
    logger.debug({ to, tenantId }, 'Message sent via Baileys');
  }

  /**
   * Send an audio message (voice note) via a tenant's Baileys connection.
   * @param tenantId - Tenant ID
   * @param to - Recipient phone number
   * @param audioBuffer - Audio data (OGG Opus format for best compatibility)
   * @param ptt - If true, sends as voice note (push-to-talk). Default true.
   */
  async sendAudioMessage(
    tenantId: string,
    to: string,
    audioBuffer: Buffer,
    ptt: boolean = true
  ): Promise<void> {
    const socket = this.getSession(tenantId).socket;
    if (!socket) {
      throw new Error(`No Baileys connection for tenant ${tenantId}`);
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    await socket.sendMessage(jid, {
      audio: audioBuffer,
      mimetype: 'audio/ogg; codecs=opus', // OGG Opus required for Android compatibility
      ptt, // ptt = true makes it appear as a voice note with waveform
    });
    logger.debug({ to, tenantId, size: audioBuffer.length, ptt }, 'Audio message sent via Baileys');
  }

  /**
   * Disconnect a tenant's Baileys connection.
   */
  async disconnect(tenantId: string): Promise<void> {
    const session = this.getSession(tenantId);
    session.manualDisconnect = true;
    this.clearReconnectTimer(session);

    const socket = session.socket;
    if (socket) {
      socket.end(undefined);
      session.socket = null;
    }

    session.status = 'disconnected';
    logger.info({ tenantId }, 'Baileys disconnected for tenant');
  }

  /**
   * Check if a tenant has an active connection.
   */
  isConnected(tenantId: string): boolean {
    const session = this.getSession(tenantId);
    return session.status === 'connected' && Boolean(session.socket);
  }

  /**
   * Get all connected tenant IDs.
   */
  getConnectedTenants(): string[] {
    return Array.from(this.sessions.entries())
      .filter(([, session]) => session.status === 'connected' && Boolean(session.socket))
      .map(([tenantId]) => tenantId);
  }
}

// Global singleton
export const baileysManager = new BaileysManager();
