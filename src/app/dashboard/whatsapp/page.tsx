import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { WhatsAppSetupClient } from './whatsapp-client';

export default async function WhatsAppPage() {
  const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
  if (!tenant) redirect('/create-tenant');
  if (!tenant.onboardingComplete) redirect('/dashboard/onboarding');

  const config = await prisma.whatsappConfig.findUnique({
    where: { tenantId: tenant.id },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">WhatsApp Connection</h1>
        <p className="text-[var(--muted)]">
          Connect your WhatsApp number so your AI assistant can chat with your clients.
        </p>
      </div>

      {/* Explanation of options */}
      <div className="card p-6 mb-6 border-[var(--accent)]">
        <h3 className="font-semibold mb-3">📖 How does this work?</h3>
        <p className="text-sm text-[var(--muted)] mb-4">
          Your AI assistant needs a WhatsApp number to send and receive messages.
          There are two ways to connect it:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-[var(--background)]">
            <h4 className="font-medium text-sm mb-2">📱 Option A: WhatsApp Web (Baileys)</h4>
            <p className="text-xs text-[var(--muted)] mb-2">
              <strong>Best for:</strong> Testing, small businesses, getting started fast
            </p>
            <ul className="text-xs text-[var(--muted)] space-y-1">
              <li>✅ <strong>Free</strong> — no business account needed</li>
              <li>✅ Works with your personal WhatsApp number</li>
              <li>✅ Scan a QR code and you&apos;re connected in seconds</li>
              <li>⚠️ Requires the server to stay running</li>
              <li>⚠️ Meta may restrict automated use (unofficial)</li>
              <li>⚠️ Not recommended for high message volume</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg bg-[var(--background)]">
            <h4 className="font-medium text-sm mb-2">☁️ Option B: WhatsApp Cloud API (Meta Official)</h4>
            <p className="text-xs text-[var(--muted)] mb-2">
              <strong>Best for:</strong> Production, businesses, reliability at scale
            </p>
            <ul className="text-xs text-[var(--muted)] space-y-1">
              <li>✅ <strong>Official</strong> — fully supported by Meta</li>
              <li>✅ Reliable, scalable, no risk of being blocked</li>
              <li>✅ Supports templates, buttons, rich messages</li>
              <li>⚠️ Requires a Meta Business account (free to create)</li>
              <li>⚠️ First 1,000 conversations/month are free, then pay-per-conversation</li>
              <li>⚠️ Setup takes ~15 minutes</li>
            </ul>
          </div>
        </div>
      </div>

      <WhatsAppSetupClient
        currentConfig={config ? {
          channel: config.channel,
          isActive: config.isActive,
          phoneNumberId: config.phoneNumberId || '',
          accessToken: config.accessToken ? '••••••••' : '',
          businessId: config.businessId || '',
        } : null}
      />
    </div>
  );
}
