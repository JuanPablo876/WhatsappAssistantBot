'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

const STORAGE_KEY = 'onboarding_progress';

const STEPS = ['Describe Your Business', 'Schedule & Hours', 'Review AI Prompt', 'You\'re Ready!'];

const BUSINESS_TYPES = [
  'Medical / Health Clinic',
  'Dental Office',
  'Beauty Salon / Spa',
  'Barbershop',
  'Consulting / Professional Services',
  'Law Office',
  'Fitness / Personal Training',
  'Real Estate',
  'Education / Tutoring',
  'Restaurant / Food Service',
  'Auto Service / Repair',
  'Other',
];

const TONES = [
  { value: 'friendly', label: '😊 Friendly', desc: 'Warm, casual, uses emojis' },
  { value: 'professional', label: '👔 Professional', desc: 'Formal, polished' },
  { value: 'casual', label: '✌️ Casual', desc: 'Relaxed, conversational' },
  { value: 'empathetic', label: '💚 Empathetic', desc: 'Caring, supportive (great for healthcare)' },
  { value: 'custom', label: '✏️ Custom', desc: 'Define your own tone' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Form state
  const [form, setForm] = useState({
    businessName: '',
    assistantName: '',
    businessType: '',
    description: '',
    services: '',
    tone: 'friendly',
    customTone: '',
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    slotDuration: 30,
    openTime: '09:00',
    closeTime: '17:00',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    welcomeMessage: '',
  });

  // Clear any stale localStorage data on mount
  // Since we're on this page, tenant.onboardingComplete is false - start fresh
  useEffect(() => {
    localStorage.removeItem(STORAGE_KEY);
    setInitialized(true);
  }, []);

  function updateForm(updates: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  function toggleDay(day: string) {
    setForm((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day],
    }));
  }

  async function generatePrompt() {
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: form.businessName,
          assistantName: form.assistantName,
          businessType: form.businessType,
          description: form.description,
          services: form.services,
          tone: form.tone === 'custom' ? form.customTone : form.tone,
          language: form.language,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedPrompt(data.prompt);
      } else {
        alert('Failed to generate prompt. Please try again.');
      }
    } catch (err) {
      alert('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function completeOnboarding() {
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          services: form.services,
          workingDays: form.workingDays.join(','),
          systemPrompt: generatedPrompt,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Clear saved progress - onboarding is complete!
        localStorage.removeItem(STORAGE_KEY);
        setStep(3);
      } else {
        alert('Failed to save. Please try again.');
      }
    } catch (err) {
      alert('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleNext() {
    if (step === 1) {
      // After schedule step, generate the AI prompt
      await generatePrompt();
      setStep(2);
    } else if (step === 2) {
      // Save everything
      await completeOnboarding();
    } else {
      setStep((prev) => prev + 1);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Back button - only show on first step */}
        {step === 0 && (
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
        
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  i <= step ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
                }`}
              />
              <p className={`text-xs mt-1.5 ${i === step ? 'text-white' : 'text-[var(--muted-light)]'}`}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Step 0: Describe business */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Tell us about your business</h2>
              <p className="text-[var(--muted)]">
                This helps the AI understand your business and talk to your clients naturally.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Business Name</label>
                <input
                  type="text"
                  value={form.businessName}
                  onChange={(e) => updateForm({ businessName: e.target.value })}
                  placeholder="e.g., Bright Smile Dental"
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Assistant Name</label>
                <input
                  type="text"
                  value={form.assistantName}
                  onChange={(e) => updateForm({ assistantName: e.target.value })}
                  placeholder="e.g., Sofia, Max, or leave blank"
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Business Type</label>
              <select
                value={form.businessType}
                onChange={(e) => updateForm({ businessType: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none transition-colors"
              >
                <option value="">Select type...</option>
                {BUSINESS_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Describe what your business does
              </label>
              <p className="text-xs text-[var(--muted)] mb-2">
                Write a few sentences about your business, what services you offer, your style, etc.
                The more detail, the better the AI will understand your business.
              </p>
              <textarea
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                placeholder="e.g., We're a family-friendly dental clinic in downtown Miami. We offer cleanings, whitening, braces, and emergency dental care. We're known for being gentle and patient with nervous clients..."
                rows={5}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Services (comma-separated)</label>
              <input
                type="text"
                value={form.services}
                onChange={(e) => updateForm({ services: e.target.value })}
                placeholder="e.g., Cleaning, Whitening, Braces, Emergency Care"
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Assistant Tone</label>
              <div className="grid grid-cols-2 gap-3">
                {TONES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => updateForm({ tone: t.value })}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      form.tone === t.value
                        ? 'border-[var(--primary)] bg-[var(--primary-light)]'
                        : 'border-[var(--border)] hover:border-[var(--border-light)]'
                    }`}
                  >
                    <div className="font-medium text-sm">{t.label}</div>
                    <div className="text-xs text-[var(--muted)]">{t.desc}</div>
                  </button>
                ))}
              </div>
              {form.tone === 'custom' && (
                <input
                  type="text"
                  value={form.customTone}
                  onChange={(e) => updateForm({ customTone: e.target.value })}
                  placeholder="e.g., Witty and playful, but still helpful"
                  className="w-full mt-3 px-4 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none transition-colors"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Response Language</label>
              <select
                value={form.language}
                onChange={(e) => updateForm({ language: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none transition-colors"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="pt">Português</option>
                <option value="fr">Français</option>
                <option value="auto">Auto-detect (respond in client&apos;s language)</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 1: Schedule */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Set Your Schedule</h2>
              <p className="text-[var(--muted)]">
                Configure your business hours so the AI knows when to book appointments.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Timezone</label>
              <input
                type="text"
                value={form.timezone}
                onChange={(e) => updateForm({ timezone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none transition-colors"
              />
              <p className="text-xs text-[var(--muted)] mt-1">Auto-detected from your browser</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Opens at</label>
                <input
                  type="time"
                  value={form.openTime}
                  onChange={(e) => updateForm({ openTime: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Closes at</label>
                <input
                  type="time"
                  value={form.closeTime}
                  onChange={(e) => updateForm({ closeTime: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Working Days</label>
              <div className="flex gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`w-12 h-12 rounded-lg font-medium text-sm transition-all ${
                      form.workingDays.includes(day)
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted)]'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Appointment Duration</label>
              <select
                value={form.slotDuration}
                onChange={(e) => updateForm({ slotDuration: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Welcome Message (optional)</label>
              <textarea
                value={form.welcomeMessage}
                onChange={(e) => updateForm({ welcomeMessage: e.target.value })}
                placeholder="e.g., Hi! Welcome to Bright Smile Dental. How can I help you today?"
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none resize-none"
              />
              <p className="text-xs text-[var(--muted)] mt-1">
                Sent automatically when a new client messages for the first time
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Review generated prompt */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Your AI Assistant&apos;s Brain</h2>
              <p className="text-[var(--muted)]">
                We generated a custom prompt based on your business description. 
                This is what tells the AI how to behave. You can edit it anytime.
              </p>
            </div>

            {loading ? (
              <div className="card p-8 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-[var(--muted)]">Generating your custom AI personality...</p>
              </div>
            ) : (
              <>
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-[var(--primary)]">System Prompt</span>
                    <button
                      onClick={generatePrompt}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      🔄 Regenerate
                    </button>
                  </div>
                  <textarea
                    value={generatedPrompt}
                    onChange={(e) => setGeneratedPrompt(e.target.value)}
                    rows={15}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none text-sm font-mono resize-none"
                  />
                </div>

                <div className="card p-4 border-[var(--primary)] bg-[var(--primary-light)]">
                  <p className="text-sm">
                    <strong>Tip:</strong> You can always refine this prompt later from your dashboard settings. 
                    The more specific it is, the better your AI assistant will perform.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: All done */}
        {step === 3 && (
          <div className="text-center space-y-6 py-12">
            <div className="text-6xl">🎉</div>
            <h2 className="text-3xl font-bold">You&apos;re All Set!</h2>
            <p className="text-[var(--muted)] max-w-md mx-auto">
              Your AI assistant is configured and ready. Now let&apos;s connect your WhatsApp 
              number so clients can start chatting.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-8 py-3 rounded-xl gradient-primary text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Go to Dashboard →
            </button>
          </div>
        )}

        {/* Navigation buttons */}
        {step < 3 && (
          <div className="flex justify-between mt-8">
            <button
              onClick={() => setStep((prev) => Math.max(0, prev - 1))}
              className={`px-6 py-2.5 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-white transition-colors ${
                step === 0 ? 'invisible' : ''
              }`}
            >
              ← Back
            </button>
            <button
              onClick={handleNext}
              disabled={loading || (step === 0 && (!form.businessName || !form.description))}
              className="px-6 py-2.5 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Working...'
                : step === 2
                  ? 'Save & Finish ✓'
                  : 'Continue →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
