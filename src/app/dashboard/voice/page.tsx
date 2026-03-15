import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { VoiceSetupClient } from './voice-client';

export default async function VoicePage() {
  const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
  if (!tenant) redirect('/create-tenant');
  if (!tenant.onboardingComplete) redirect('/dashboard/onboarding');

  const voiceConfig = await prisma.voiceConfig.findUnique({
    where: { tenantId: tenant.id },
  });

  const isPro = tenant.plan === 'PRO' || tenant.plan === 'ENTERPRISE';

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Voice & Calls</h1>
        <p className="text-[var(--muted)]">
          Enable AI-powered voice messages and phone calls for your assistant.
        </p>
      </div>

      {!isPro && (
        <div className="card p-6 mb-6 border-[var(--accent)]">
          <div className="flex items-start gap-4">
            <div className="text-3xl">🎙️</div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Upgrade to Pro for Voice & Calls</h3>
              <p className="text-sm text-[var(--muted)] mb-3">
                Voice messages and AI phone calls are available on the Pro plan ($79/month).
                Your AI assistant will be able to send voice replies via WhatsApp and handle
                incoming/outgoing phone calls using natural-sounding AI voices.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-[var(--background)]">
                  <div className="text-sm font-medium">🗣️ Voice Messages</div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    Send audio replies in WhatsApp
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--background)]">
                  <div className="text-sm font-medium">📞 AI Phone Calls</div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    Handle calls with AI voice agents
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--background)]">
                  <div className="text-sm font-medium">🎭 Custom Voices</div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    Choose from 30+ natural voices
                  </div>
                </div>
              </div>
              <a
                href="/dashboard/billing"
                className="inline-block px-6 py-2.5 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-opacity"
              >
                Upgrade to Pro →
              </a>
            </div>
          </div>
        </div>
      )}

      {isPro && (
        <VoiceSetupClient
          config={voiceConfig ? {
            voiceEnabled: voiceConfig.enabled,
            callsEnabled: voiceConfig.callsEnabled,
            provider: voiceConfig.provider as 'openai' | 'elevenlabs',
            voiceId: voiceConfig.voiceId || '',
            stability: voiceConfig.stability,
            similarityBoost: voiceConfig.similarityBoost,
            openaiVoice: voiceConfig.openaiVoice,
            openaiModel: voiceConfig.openaiModel,
            openaiSpeed: voiceConfig.openaiSpeed,
          } : null}
          hasElevenLabsKey={!!voiceConfig?.apiKey || !!process.env.ELEVENLABS_API_KEY}
        />
      )}
    </div>
  );
}
