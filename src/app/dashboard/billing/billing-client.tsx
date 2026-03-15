'use client';

const PLANS = [
  {
    id: 'FREE',
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'Try it out with basic features',
    features: [
      '50 messages / month',
      '1 WhatsApp number',
      'AI appointment booking',
      'Google Calendar sync',
      'Basic AI prompt',
      'Community support',
    ],
    limits: [
      'No voice messages',
      'No phone calls',
      'No priority support',
    ],
  },
  {
    id: 'BASIC',
    name: 'Basic',
    price: '$29',
    period: '/month',
    desc: 'For small businesses getting started',
    popular: true,
    features: [
      '2,000 messages / month',
      '1 WhatsApp number',
      'AI appointment booking',
      'Google Calendar sync',
      'Custom AI prompt + tone',
      'Conversation history',
      'Appointment management',
      'Email support',
    ],
    limits: [
      'No voice messages',
      'No phone calls',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: '$79',
    period: '/month',
    desc: 'Full power with voice & calls',
    features: [
      'Unlimited messages',
      '3 WhatsApp numbers',
      'AI appointment booking',
      'Google Calendar sync',
      'Custom AI prompt + tone',
      'Conversation history',
      'Appointment management',
      '🗣️ Voice messages (ElevenLabs)',
      '📞 AI phone calls',
      '🎭 Custom voice selection',
      'Priority support',
      'API access',
    ],
    limits: [],
  },
];

interface Props {
  currentPlan: string;
}

export function BillingClient({ currentPlan }: Props) {
  return (
    <div>
      {/* Current plan banner */}
      <div className="card p-4 mb-6 flex items-center justify-between">
        <div>
          <span className="text-sm text-[var(--muted)]">Current plan:</span>
          <span className="ml-2 font-semibold">{currentPlan}</span>
        </div>
        {currentPlan === 'FREE' && (
          <span className="text-xs text-[var(--muted)]">
            Upgrade to unlock more messages and features
          </span>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={`card p-6 relative ${
                plan.popular ? 'border-[var(--primary)]' : ''
              } ${isCurrent ? 'ring-2 ring-[var(--primary)]' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[var(--primary)] text-white text-xs font-medium">
                  Most Popular
                </div>
              )}
              <div className="text-center mb-4">
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-[var(--muted)]">{plan.period}</span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-1">{plan.desc}</p>
              </div>

              <div className="space-y-2 mb-6">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-[var(--primary)] mt-0.5">✓</span>
                    <span>{f}</span>
                  </div>
                ))}
                {plan.limits.map((l, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                    <span className="mt-0.5">✗</span>
                    <span>{l}</span>
                  </div>
                ))}
              </div>

              <button
                disabled={isCurrent}
                className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all ${
                  isCurrent
                    ? 'bg-[var(--border)] text-[var(--muted)] cursor-default'
                    : plan.popular
                    ? 'gradient-primary text-white hover:opacity-90'
                    : 'border border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
                }`}
              >
                {isCurrent ? 'Current Plan' : `Upgrade to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[var(--muted)] text-center mt-6">
        Payment integration coming soon. Contact us to upgrade manually.
      </p>
    </div>
  );
}
