import { prisma } from '@/lib/db';
import { logger } from '../logger';
import { sendMessage } from '../send-message';
import type { ToolResult } from '../types';
import type { AdminAgentContext, AdminToolHandler } from './types';
import crypto from 'crypto';

// ─── Content Sanitization ───────────────────────────────

/** Strip HTML tags, scripts, and excessive whitespace from fetched content */
function sanitizeContent(raw: string, maxLength = 50000): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Validate that a URL is HTTPS and not targeting internal/private networks */
function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    // Block localhost, private IPs, and internal hostnames
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Truncate a string for audit logging */
function truncateForLog(str: string, max = 500): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
}

// ─── Retrieval Tools ────────────────────────────────────

export const braveWebSearch: AdminToolHandler = async (args) => {
  const query = String(args.query || '').trim();
  if (!query) {
    return { success: false, error: 'Search query is required' };
  }

  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  // Debug: Log all env vars that contain 'BRAVE' or similar keys
  const envKeys = Object.keys(process.env).filter(k => k.includes('BRAVE') || k.includes('API_KEY'));
  logger.info({ 
    hasApiKey: !!apiKey, 
    keyLength: apiKey?.length,
    braveEnvKeys: envKeys,
    electronApp: process.env.ELECTRON_APP,
    nodeEnv: process.env.NODE_ENV
  }, 'Brave search called - debug env');
  
  if (!apiKey) {
    return { success: false, error: 'Brave Search API key is not configured (BRAVE_SEARCH_API_KEY)' };
  }

  const count = Math.min(Math.max(Number(args.count) || 5, 1), 10);

  try {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(count));

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    });

    if (!response.ok) {
      return { success: false, error: `Brave Search API error: ${response.status}` };
    }

    const data = await response.json();
    const results = (data.web?.results || []).map((r: { title: string; url: string; description: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
    }));

    return {
      success: true,
      data: { query, count: results.length, results },
    };
  } catch (error) {
    logger.error({ error, query }, 'Brave search failed');
    return { success: false, error: 'Search request failed' };
  }
};

export const fetchUrl: AdminToolHandler = async (args) => {
  const url = String(args.url || '').trim();
  if (!url) {
    return { success: false, error: 'URL is required' };
  }

  if (!isAllowedUrl(url)) {
    return { success: false, error: 'Only HTTPS URLs to public hosts are allowed. No localhost, private IPs, or internal networks.' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'WhatsAppAssistantBot-AdminAgent/1.0' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text') && !contentType.includes('json') && !contentType.includes('xml')) {
      return { success: false, error: `Unsupported content type: ${contentType}` };
    }

    // Size cap: 500KB
    const raw = await response.text();
    if (raw.length > 500_000) {
      return {
        success: true,
        data: { url, content: sanitizeContent(raw.slice(0, 500_000)), truncated: true },
      };
    }

    return {
      success: true,
      data: { url, content: sanitizeContent(raw) },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, error: 'Request timed out (15s)' };
    }
    logger.error({ error, url }, 'URL fetch failed');
    return { success: false, error: 'Failed to fetch URL' };
  }
};

export const searchSkills: AdminToolHandler = async (args) => {
  const query = String(args.query || '').trim();
  if (!query) {
    return { success: false, error: 'Search query is required' };
  }

  const category = args.category ? String(args.category) : undefined;
  const enabledOnly = args.enabled_only !== false;

  try {
    const skills = await prisma.agentSkill.findMany({
      where: {
        AND: [
          enabledOnly ? { isEnabled: true } : {},
          { reviewStatus: { not: 'ARCHIVED' } },
          category ? { category } : {},
          {
            OR: [
              { title: { contains: query } },
              { summary: { contains: query } },
              { category: { contains: query } },
              { tags: { contains: query } },
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        category: true,
        summary: true,
        tags: true,
        reviewStatus: true,
        isEnabled: true,
        priority: true,
        usageCount: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: [{ priority: 'desc' }, { usageCount: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });

    return {
      success: true,
      data: { query, count: skills.length, skills },
    };
  } catch (error) {
    logger.error({ error, query }, 'Skill search failed');
    return { success: false, error: 'Failed to search skills' };
  }
};

export const readSkill: AdminToolHandler = async (args) => {
  const skillId = String(args.skill_id || '');
  if (!skillId) {
    return { success: false, error: 'skill_id is required' };
  }

  try {
    const skill = await prisma.agentSkill.findUnique({
      where: { id: skillId },
      include: { sources: true },
    });

    if (!skill) {
      return { success: false, error: 'Skill not found' };
    }

    // Increment usage counter
    await prisma.agentSkill.update({
      where: { id: skillId },
      data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    });

    return {
      success: true,
      data: {
        id: skill.id,
        title: skill.title,
        category: skill.category,
        tags: JSON.parse(skill.tags),
        summary: skill.summary,
        workflowGuidance: skill.workflowGuidance,
        implementationNotes: skill.implementationNotes,
        codeSnippets: JSON.parse(skill.codeSnippets),
        reviewStatus: skill.reviewStatus,
        deliveryMode: skill.deliveryMode,
        isEnabled: skill.isEnabled,
        priority: skill.priority,
        usageCount: skill.usageCount + 1,
        sources: skill.sources.map((s) => ({
          url: s.url,
          title: s.title,
          sourceType: s.sourceType,
          snippet: s.snippet,
          fetchedAt: s.fetchedAt,
        })),
      },
    };
  } catch (error) {
    logger.error({ error, skillId }, 'Read skill failed');
    return { success: false, error: 'Failed to read skill' };
  }
};

export const recommendSkill: AdminToolHandler = async (args) => {
  const query = String(args.query || '').trim();
  if (!query) {
    return { success: false, error: 'Query is required' };
  }

  try {
    const skills = await prisma.agentSkill.findMany({
      where: {
        isEnabled: true,
        reviewStatus: { not: 'ARCHIVED' },
        OR: [
          { title: { contains: query } },
          { summary: { contains: query } },
          { tags: { contains: query } },
          { category: { contains: query } },
        ],
      },
      select: {
        id: true,
        title: true,
        category: true,
        summary: true,
        reviewStatus: true,
        usageCount: true,
        priority: true,
      },
      orderBy: [{ priority: 'desc' }, { usageCount: 'desc' }],
      take: 10,
    });

    if (skills.length === 0) {
      return {
        success: true,
        data: {
          query,
          found: false,
          message: 'No existing skills match this topic. Consider creating a new one with propose_skill.',
        },
      };
    }

    return {
      success: true,
      data: {
        query,
        found: true,
        count: skills.length,
        skills,
        message: skills.length > 0
          ? 'Existing skills found. Review them before proposing a new one to avoid duplicates.'
          : undefined,
      },
    };
  } catch (error) {
    logger.error({ error, query }, 'Recommend skill failed');
    return { success: false, error: 'Failed to search for recommendations' };
  }
};

// ─── Skill Writing Tools ────────────────────────────────

export const proposeSkill: AdminToolHandler = async (args, context) => {
  const title = String(args.title || '').trim();
  const category = String(args.category || 'general').trim();
  const summary = String(args.summary || '').trim();
  const workflowGuidance = String(args.workflow_guidance || '').trim();
  const implementationNotes = String(args.implementation_notes || '').trim();
  const tags = Array.isArray(args.tags) ? args.tags.map(String) : [];
  const sourceUrls = Array.isArray(args.source_urls) ? args.source_urls.filter((u): u is string => typeof u === 'string' && u.startsWith('https://')) : [];
  const codeSnippets = Array.isArray(args.code_snippets) ? args.code_snippets.map(String) : [];
  const priority = Math.min(Math.max(Number(args.priority) || 0, 0), 2);

  if (!title || !summary || !workflowGuidance) {
    return { success: false, error: 'title, summary, and workflow_guidance are required' };
  }

  // Sanitize all text fields
  const safeSummary = sanitizeContent(summary, 5000);
  const safeGuidance = sanitizeContent(workflowGuidance, 20000);
  const safeNotes = sanitizeContent(implementationNotes, 10000);
  const safeSnippets = codeSnippets.map((s) => sanitizeContent(s, 5000));

  try {
    const skill = await prisma.agentSkill.create({
      data: {
        title: title.slice(0, 200),
        category: category.slice(0, 50),
        tags: JSON.stringify(tags.slice(0, 20)),
        summary: safeSummary,
        workflowGuidance: safeGuidance,
        implementationNotes: safeNotes,
        codeSnippets: JSON.stringify(safeSnippets.slice(0, 10)),
        reviewStatus: 'PROPOSED',
        deliveryMode: 'KNOWLEDGE',
        isEnabled: true,
        priority,
        createdByUserId: context.userId,
        sources: sourceUrls.length > 0
          ? {
              create: sourceUrls.slice(0, 10).map((url) => ({
                url,
                title: '',
                sourceType: 'web',
                snippet: '',
                contentHash: crypto.createHash('sha256').update(url).digest('hex').slice(0, 16),
              })),
            }
          : undefined,
      },
      include: { sources: true },
    });

    return {
      success: true,
      data: {
        id: skill.id,
        title: skill.title,
        category: skill.category,
        reviewStatus: skill.reviewStatus,
        isEnabled: skill.isEnabled,
        sourceCount: skill.sources.length,
        message: 'Skill created and immediately usable as knowledge. It will be reviewed by an admin.',
      },
    };
  } catch (error) {
    logger.error({ error, title }, 'Propose skill failed');
    return { success: false, error: 'Failed to create skill' };
  }
};

export const updateSkill: AdminToolHandler = async (args, context) => {
  const skillId = String(args.skill_id || '');
  if (!skillId) {
    return { success: false, error: 'skill_id is required' };
  }

  try {
    const existing = await prisma.agentSkill.findUnique({ where: { id: skillId } });
    if (!existing) {
      return { success: false, error: 'Skill not found' };
    }
    if (existing.reviewStatus === 'ARCHIVED') {
      return { success: false, error: 'Cannot update an archived skill. Restore it first.' };
    }

    const updateData: Record<string, unknown> = {
      updatedByUserId: context.userId,
    };

    if (args.title) updateData.title = String(args.title).slice(0, 200);
    if (args.category) updateData.category = String(args.category).slice(0, 50);
    if (args.summary) updateData.summary = sanitizeContent(String(args.summary), 5000);
    if (args.workflow_guidance) updateData.workflowGuidance = sanitizeContent(String(args.workflow_guidance), 20000);
    if (args.implementation_notes) updateData.implementationNotes = sanitizeContent(String(args.implementation_notes), 10000);
    if (Array.isArray(args.tags)) updateData.tags = JSON.stringify(args.tags.map(String).slice(0, 20));
    if (Array.isArray(args.code_snippets)) updateData.codeSnippets = JSON.stringify(args.code_snippets.map((s: unknown) => sanitizeContent(String(s), 5000)).slice(0, 10));
    if (typeof args.priority === 'number') updateData.priority = Math.min(Math.max(args.priority, 0), 2);

    const updated = await prisma.agentSkill.update({
      where: { id: skillId },
      data: updateData,
    });

    return {
      success: true,
      data: {
        id: updated.id,
        title: updated.title,
        message: 'Skill updated successfully',
      },
    };
  } catch (error) {
    logger.error({ error, skillId }, 'Update skill failed');
    return { success: false, error: 'Failed to update skill' };
  }
};

export const archiveSkill: AdminToolHandler = async (args, context) => {
  const skillId = String(args.skill_id || '');
  if (!skillId) {
    return { success: false, error: 'skill_id is required' };
  }

  try {
    const existing = await prisma.agentSkill.findUnique({ where: { id: skillId } });
    if (!existing) {
      return { success: false, error: 'Skill not found' };
    }
    if (existing.reviewStatus === 'ARCHIVED') {
      return { success: true, data: { message: 'Skill is already archived' } };
    }

    await prisma.agentSkill.update({
      where: { id: skillId },
      data: {
        reviewStatus: 'ARCHIVED',
        isEnabled: false,
        updatedByUserId: context.userId,
      },
    });

    return {
      success: true,
      data: {
        id: skillId,
        reason: String(args.reason || 'No reason provided'),
        message: 'Skill archived successfully',
      },
    };
  } catch (error) {
    logger.error({ error, skillId }, 'Archive skill failed');
    return { success: false, error: 'Failed to archive skill' };
  }
};

// ─── WhatsApp Tools ─────────────────────────────────────

export const listWhatsAppContacts: AdminToolHandler = async (args) => {
  const search = String(args.search || '').trim().toLowerCase();
  const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50);

  try {
    // Get contacts from conversations
    const conversations = await prisma.conversation.findMany({
      include: {
        contact: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        tenant: {
          select: { id: true, name: true },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100, // Get more than limit for filtering
    });

    let contacts = conversations.map((conv) => ({
      phoneNumber: conv.contact.phone,
      name: conv.contact.name || 'Unknown',
      tenantId: conv.tenantId,
      tenantName: conv.tenant.name,
      lastMessageAt: conv.messages[0]?.createdAt || conv.updatedAt,
      messageCount: conv._count.messages,
    }));

    // Filter by search if provided
    if (search) {
      contacts = contacts.filter(
        (c) =>
          c.phoneNumber.toLowerCase().includes(search) ||
          c.name.toLowerCase().includes(search)
      );
    }

    // Limit results
    contacts = contacts.slice(0, limit);

    return {
      success: true,
      data: {
        count: contacts.length,
        contacts,
      },
    };
  } catch (error) {
    logger.error({ error }, 'List WhatsApp contacts failed');
    return { success: false, error: 'Failed to list contacts' };
  }
};

export const sendWhatsAppMessage: AdminToolHandler = async (args, context) => {
  const phoneNumber = String(args.phone_number || '').replace(/\D/g, '');
  const message = String(args.message || '').trim();
  const tenantId = String(args.tenant_id || '').trim();

  if (!phoneNumber) {
    return { success: false, error: 'phone_number is required' };
  }
  if (!message) {
    return { success: false, error: 'message is required' };
  }
  if (message.length > 4096) {
    return { success: false, error: 'Message too long (max 4096 characters)' };
  }

  try {
    // Find a valid WhatsApp config (use provided tenantId or find first active)
    let config;
    if (tenantId) {
      config = await prisma.whatsappConfig.findFirst({
        where: { tenantId, isActive: true },
      });
    } else {
      config = await prisma.whatsappConfig.findFirst({
        where: { isActive: true },
        include: { tenant: { select: { name: true } } },
      });
    }

    if (!config) {
      return { success: false, error: 'No active WhatsApp configuration found' };
    }

    // Send the message
    await sendMessage({
      to: phoneNumber,
      text: message,
      tenantId: config.tenantId,
    });

    // Log this admin action
    logger.info(
      { 
        userId: context.userId, 
        userName: context.userName,
        to: phoneNumber,
        tenantId: config.tenantId,
        messageLength: message.length,
      },
      'Admin sent WhatsApp message via secret agent'
    );

    return {
      success: true,
      data: {
        sent: true,
        to: phoneNumber,
        tenantId: config.tenantId,
        messagePreview: message.slice(0, 100) + (message.length > 100 ? '...' : ''),
      },
    };
  } catch (error) {
    logger.error({ error, phoneNumber }, 'Send WhatsApp message failed');
    return { success: false, error: 'Failed to send WhatsApp message' };
  }
};

export const getConversationHistory: AdminToolHandler = async (args) => {
  const phoneNumber = String(args.phone_number || '').replace(/\D/g, '');
  const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);

  if (!phoneNumber) {
    return { success: false, error: 'phone_number is required' };
  }

  try {
    // Find the contact
    const contact = await prisma.contact.findFirst({
      where: { phone: { contains: phoneNumber } },
    });

    if (!contact) {
      return { success: false, error: 'Contact not found' };
    }

    // Get the conversation
    const conversation = await prisma.conversation.findFirst({
      where: { contactId: contact.id },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
        tenant: {
          select: { name: true },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    if (!conversation) {
      return { success: false, error: 'No conversation found with this contact' };
    }

    // Reverse to chronological order
    const messages = conversation.messages.reverse().map((m) => ({
      role: m.role,
      content: m.content.slice(0, 500) + (m.content.length > 500 ? '...' : ''),
      timestamp: m.createdAt.toISOString(),
    }));

    return {
      success: true,
      data: {
        contactName: contact.name || 'Unknown',
        phoneNumber: contact.phone,
        tenantName: conversation.tenant.name,
        messageCount: conversation._count.messages,
        messages,
      },
    };
  } catch (error) {
    logger.error({ error, phoneNumber }, 'Get conversation history failed');
    return { success: false, error: 'Failed to get conversation history' };
  }
};

// ─── Skill Search Tools ──────────────────────────────

/** Search for API integrations and skills via web search */
export const searchOpenClawSkills: AdminToolHandler = async (args) => {
  const query = String(args.query || '').trim();
  if (!query) {
    return { success: false, error: 'Search query is required' };
  }

  const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 20);

  try {
    const braveKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!braveKey) {
      return {
        success: false,
        error: 'Brave Search API is not configured. Set BRAVE_SEARCH_API_KEY in .env to enable skill search.',
      };
    }

    // Search GitHub for relevant integrations, APIs, and skills
    const searchUrl = new URL('https://api.search.brave.com/res/v1/web/search');
    searchUrl.searchParams.set('q', `${query} API integration github`);
    searchUrl.searchParams.set('count', String(limit));

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': braveKey,
      },
    });

    if (!response.ok) {
      return { success: false, error: `Brave search failed: ${response.status}` };
    }

    const data = await response.json();
    const results = (data.web?.results || []).slice(0, limit).map((r: { title: string; url: string; description: string }) => ({
      title: r.title,
      url: r.url,
      description: r.description,
      isGitHub: r.url.includes('github.com'),
    }));

    return {
      success: true,
      data: {
        query,
        count: results.length,
        results,
        suggestions: [
          'Use web_search to find official API documentation',
          'Use fetch_url to read documentation pages',
          'Use save_skill to save what you learn as a skill',
        ],
      },
    };
  } catch (error) {
    logger.error({ error, query }, 'Skill search failed');
    return { success: false, error: 'Failed to search for skills' };
  }
};

/** Get full details from a URL (redirect to fetch_url) */
export const getOpenClawSkillDetails: AdminToolHandler = async (args) => {
  const url = String(args.skill_path || args.url || '').trim();
  if (!url) {
    return { success: false, error: 'URL is required. Use fetch_url with the documentation URL instead.' };
  }
  return {
    success: false,
    error: 'This tool is deprecated. Use fetch_url to fetch documentation from any URL, then propose_skill to save it as a skill.',
    suggestion: `Try: fetch_url with url="${url}"`,
  };
};

/** Import a skill from URL (redirect to propose_skill) */
export const importOpenClawSkill: AdminToolHandler = async () => {
  return {
    success: false,
    error: 'This tool is deprecated. Use the following workflow instead: 1) brave_web_search to find API docs, 2) fetch_url to read them, 3) propose_skill to save as a skill.',
  };
};

// ─── Handler Map ────────────────────────────────────────

export const adminToolHandlers: Record<string, AdminToolHandler> = {
  brave_web_search: braveWebSearch,
  fetch_url: fetchUrl,
  search_skills: searchSkills,
  read_skill: readSkill,
  recommend_skill: recommendSkill,
  propose_skill: proposeSkill,
  update_skill: updateSkill,
  archive_skill: archiveSkill,
  list_whatsapp_contacts: listWhatsAppContacts,
  send_whatsapp_message: sendWhatsAppMessage,
  get_conversation_history: getConversationHistory,
  search_openclaw_skills: searchOpenClawSkills,
  get_openclaw_skill_details: getOpenClawSkillDetails,
  import_openclaw_skill: importOpenClawSkill,
};
