'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { VoiceTest } from '@/components/voice-test';

// ElevenLabs voice presets (actual voice IDs from ElevenLabs)
const ELEVENLABS_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', desc: 'Warm, professional female' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', desc: 'Deep, confident male' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', desc: 'Energetic, youthful female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', desc: 'Soft, empathetic female' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', desc: 'Warm, conversational male' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', desc: 'Deep, authoritative male' },
];

// OpenAI TTS voice presets
const OPENAI_VOICES = [
  { id: 'alloy', name: 'Alloy', desc: 'Neutral and balanced' },
  { id: 'echo', name: 'Echo', desc: 'Warm and conversational' },
  { id: 'fable', name: 'Fable', desc: 'Expressive, storytelling' },
  { id: 'onyx', name: 'Onyx', desc: 'Deep and authoritative' },
  { id: 'nova', name: 'Nova', desc: 'Friendly and energetic' },
  { id: 'shimmer', name: 'Shimmer', desc: 'Soft and calm' },
];

type TTSProvider = 'openai' | 'elevenlabs';

interface Props {
  config: {
    voiceEnabled: boolean;
    callsEnabled: boolean;
    provider: TTSProvider;
    voiceId: string;
    stability: number;
    similarityBoost: number;
    openaiVoice: string;
    openaiModel: string;
    openaiSpeed: number;
  } | null;
  hasElevenLabsKey?: boolean;
}

export function VoiceSetupClient({ config, hasElevenLabsKey }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    voiceEnabled: config?.voiceEnabled ?? false,
    callsEnabled: config?.callsEnabled ?? false,
    provider: config?.provider ?? 'openai' as TTSProvider,
    // ElevenLabs settings
    voiceId: config?.voiceId || '21m00Tcm4TlvDq8ikWAM', // Rachel
    stability: config?.stability ?? 0.5,
    similarityBoost: config?.similarityBoost ?? 0.75,
    // OpenAI settings
    openaiVoice: config?.openaiVoice || 'nova',
    openaiModel: config?.openaiModel || 'tts-1',
    openaiSpeed: config?.openaiSpeed ?? 1.0,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/voice/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        alert('Voice settings saved!');
        router.refresh();
      }
    } catch {
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const voices = form.provider === 'openai' ? OPENAI_VOICES : ELEVENLABS_VOICES;
  const selectedVoiceId = form.provider === 'openai' ? form.openaiVoice : form.voiceId;

  return (
    <div className="space-y-6">
      {/* Toggle cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className={`card p-5 cursor-pointer transition-all ${
            form.voiceEnabled ? 'border-[var(--primary)]' : ''
          }`}
          onClick={() => setForm({ ...form, voiceEnabled: !form.voiceEnabled })}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">🗣️ Voice Messages</h3>
              <p className="text-xs text-[var(--muted)] mt-1">
                AI sends audio replies in WhatsApp chats
              </p>
            </div>
            <div
              className={`w-12 h-6 rounded-full transition-colors ${
                form.voiceEnabled ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white mt-0.5 transition-transform ${
                  form.voiceEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </div>
          </div>
        </div>

        <div
          className={`card p-5 cursor-pointer transition-all ${
            form.callsEnabled ? 'border-[var(--primary)]' : ''
          }`}
          onClick={() => setForm({ ...form, callsEnabled: !form.callsEnabled })}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">📞 Phone Calls</h3>
              <p className="text-xs text-[var(--muted)] mt-1">
                AI handles incoming and outgoing calls
              </p>
            </div>
            <div
              className={`w-12 h-6 rounded-full transition-colors ${
                form.callsEnabled ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white mt-0.5 transition-transform ${
                  form.callsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Provider selection & Voice settings */}
      {(form.voiceEnabled || form.callsEnabled) && (
        <>
          {/* Provider Selection */}
          <div className="card p-6">
            <h3 className="font-semibold mb-3">Voice Provider</h3>
            <p className="text-sm text-[var(--muted)] mb-4">
              Choose which service to use for text-to-speech conversion.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setForm({ ...form, provider: 'openai' })}
                className={`p-4 rounded-lg border text-left transition-all ${
                  form.provider === 'openai'
                    ? 'border-[var(--primary)] bg-[var(--primary-light)]'
                    : 'border-[var(--border)] hover:border-[var(--border-light)]'
                }`}
              >
                <div className="font-medium">OpenAI TTS</div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  Uses your existing OpenAI API key. Good quality, cost-effective.
                </div>
                <div className="text-xs text-green-500 mt-2">✓ No extra API key needed</div>
              </button>
              <button
                onClick={() => setForm({ ...form, provider: 'elevenlabs' })}
                className={`p-4 rounded-lg border text-left transition-all ${
                  form.provider === 'elevenlabs'
                    ? 'border-[var(--primary)] bg-[var(--primary-light)]'
                    : 'border-[var(--border)] hover:border-[var(--border-light)]'
                }`}
              >
                <div className="font-medium">ElevenLabs</div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  Industry-leading voice quality with 100+ voices and voice cloning.
                </div>
                <div className="text-xs text-yellow-500 mt-2">⚡ Requires ElevenLabs API key</div>
              </button>
            </div>
          </div>

          {/* Voice selection */}
          <div className="card p-6">
            <h3 className="font-semibold mb-3">Choose a Voice</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {voices.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => {
                    if (form.provider === 'openai') {
                      setForm({ ...form, openaiVoice: voice.id });
                    } else {
                      setForm({ ...form, voiceId: voice.id });
                    }
                  }}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedVoiceId === voice.id
                      ? 'border-[var(--primary)] bg-[var(--primary-light)]'
                      : 'border-[var(--border)] hover:border-[var(--border-light)]'
                  }`}
                >
                  <div className="font-medium text-sm">{voice.name}</div>
                  <div className="text-xs text-[var(--muted)]">{voice.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Provider-specific settings */}
          {form.provider === 'openai' ? (
            <div className="card p-6">
              <h3 className="font-semibold mb-4">OpenAI Voice Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Quality Model</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setForm({ ...form, openaiModel: 'tts-1' })}
                      className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                        form.openaiModel === 'tts-1'
                          ? 'border-[var(--primary)] bg-[var(--primary-light)]'
                          : 'border-[var(--border)]'
                      }`}
                    >
                      <div className="font-medium text-sm">Standard</div>
                      <div className="text-xs text-[var(--muted)]">Fast, lower cost</div>
                    </button>
                    <button
                      onClick={() => setForm({ ...form, openaiModel: 'tts-1-hd' })}
                      className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                        form.openaiModel === 'tts-1-hd'
                          ? 'border-[var(--primary)] bg-[var(--primary-light)]'
                          : 'border-[var(--border)]'
                      }`}
                    >
                      <div className="font-medium text-sm">HD Quality</div>
                      <div className="text-xs text-[var(--muted)]">Best quality, 2x cost</div>
                    </button>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium">Speech Speed</label>
                    <span className="text-xs text-[var(--muted)]">{form.openaiSpeed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={form.openaiSpeed}
                    onChange={(e) => setForm({ ...form, openaiSpeed: parseFloat(e.target.value) })}
                    className="w-full accent-[var(--primary)]"
                  />
                  <div className="flex justify-between text-xs text-[var(--muted)] mt-1">
                    <span>Slower</span>
                    <span>Normal (1x)</span>
                    <span>Faster</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-6">
              <h3 className="font-semibold mb-4">ElevenLabs Voice Settings</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium">Stability</label>
                    <span className="text-xs text-[var(--muted)]">{form.stability.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={form.stability}
                    onChange={(e) => setForm({ ...form, stability: parseFloat(e.target.value) })}
                    className="w-full accent-[var(--primary)]"
                  />
                  <div className="flex justify-between text-xs text-[var(--muted)] mt-1">
                    <span>More variable / expressive</span>
                    <span>More stable / consistent</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium">Similarity Boost</label>
                    <span className="text-xs text-[var(--muted)]">{form.similarityBoost.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={form.similarityBoost}
                    onChange={(e) =>
                      setForm({ ...form, similarityBoost: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[var(--primary)]"
                  />
                  <div className="flex justify-between text-xs text-[var(--muted)] mt-1">
                    <span>Lower (more diverse)</span>
                    <span>Higher (closer to original)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Voice Test Section */}
          <div className="card p-6">
            <h3 className="font-semibold mb-4">🔊 Test Your Voice</h3>
            <p className="text-sm text-[var(--muted)] mb-6">
              Test the selected voice and settings before enabling voice features.
            </p>
            <VoiceTest
              provider={form.provider}
              voiceId={form.voiceId}
              openaiVoice={form.openaiVoice}
              openaiModel={form.openaiModel}
              openaiSpeed={form.openaiSpeed}
              hasElevenLabsKey={hasElevenLabsKey}
              stability={form.stability}
              similarityBoost={form.similarityBoost}
            />
          </div>
        </>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-6 border-t border-[var(--border)] mt-8">
        <button
          onClick={save}
          disabled={saving}
          className="relative px-8 py-3.5 rounded-xl bg-[var(--foreground)] text-[var(--background)] font-semibold hover:opacity-90 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 min-w-[200px] overflow-hidden group"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Save Details
            </span>
          )}
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
        </button>
      </div>
    </div>
  );
}
