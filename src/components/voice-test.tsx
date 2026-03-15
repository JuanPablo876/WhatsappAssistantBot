'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceOrb, useAudioLevel, usePlaybackAudioLevel } from '@/components/voice-orb';

interface VoiceTestProps {
  provider: 'openai' | 'elevenlabs';
  voiceId?: string;
  openaiVoice?: string;
  openaiModel?: string;
  openaiSpeed?: number;
  hasElevenLabsKey?: boolean;
  stability?: number;
  similarityBoost?: number;
}

export function VoiceTest({
  provider,
  voiceId,
  openaiVoice = 'nova',
  openaiModel = 'tts-1',
  openaiSpeed = 1.0,
  hasElevenLabsKey,
  stability = 0.5,
  similarityBoost = 0.75,
}: VoiceTestProps) {
  const [testText, setTestText] = useState('Hello! I am your AI assistant. How can I help you today?');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackLevel = usePlaybackAudioLevel(audioRef.current);
  
  // For microphone-based testing (speak to AI)
  const { level: micLevel, isListening, startListening, stopListening } = useAudioLevel();

  // Combined audio level for the orb
  const currentLevel = isListening ? micLevel : (isSpeaking ? playbackLevel : 0);

  const generateAndPlay = useCallback(async () => {
    if (!testText.trim()) return;
    
    setError(null);
    setIsGenerating(true);

    try {
      let audioBlob: Blob;

      if (provider === 'openai') {
        // Use OpenAI TTS
        const response = await fetch('/api/voice/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: testText,
            provider: 'openai',
            voice: openaiVoice,
            model: openaiModel,
            speed: openaiSpeed,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to generate speech');
        }

        audioBlob = await response.blob();
      } else {
        // Use ElevenLabs TTS via server-side proxy (avoids CORS in Electron)
        if (!voiceId) {
          throw new Error('Voice ID is required for ElevenLabs');
        }

        const response = await fetch('/api/voice/elevenlabs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: testText,
            voiceId,
            stability,
            similarityBoost,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to generate speech with ElevenLabs');
        }

        audioBlob = await response.blob();
      }

      // Create audio element and play
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setError('Failed to play audio');
      };
      
      await audio.play();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  }, [testText, provider, openaiVoice, openaiModel, openaiSpeed, hasElevenLabsKey, voiceId, stability, similarityBoost]);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Visualizer Section */}
      <div className="relative w-full max-w-md mb-8 p-10 rounded-3xl bg-gradient-to-b from-[var(--background)] to-[var(--secondary)] border border-[var(--border)] shadow-sm overflow-hidden flex flex-col items-center justify-center">
        {/* Ambient glow behind the visualizer */}
        {currentLevel > 0 && (
          <div 
            className="absolute inset-0 bg-purple-500/20 blur-[60px] rounded-full transition-opacity duration-300"
            style={{ opacity: currentLevel * 0.8 }}
          />
        )}
        
        <VoiceOrb
          isListening={isListening}
          isSpeaking={isSpeaking || isGenerating}
          audioLevel={currentLevel}
          size={160}
          primaryColor="#8b5cf6"
          secondaryColor="#6366f1"
        />
        
        {/* Hidden but semantic status text */}
        <div className="mt-8 flex justify-center h-6">
          <div className={`transition-all duration-300 ease-in-out ${isListening || isSpeaking || isGenerating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
             {isListening && <span className="text-red-400 font-medium text-sm flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"/> Listening to Microphone</span>}
             {isGenerating && <span className="text-[var(--primary)] font-medium text-sm flex items-center gap-2"><div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"/> Synthesizing Audio</span>}
             {isSpeaking && !isGenerating && <span className="text-indigo-400 font-medium text-sm flex items-center gap-2">🔊 Playing Audio</span>}
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Test Message</label>
            
            {/* Provider Info Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-[0.65rem] font-medium text-[var(--foreground)]">
              <span>{provider === 'openai' ? '🤖 OpenAI' : '🎙️ ElevenLabs'}</span>
              <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
              <span className="text-[var(--muted)]">{provider === 'openai' ? openaiVoice : voiceId || 'Not set'}</span>
            </div>
          </div>
          
          <div className="relative">
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Enter text to speak..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-transparent border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all resize-none text-[var(--foreground)] shadow-sm"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p>{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={generateAndPlay}
            disabled={isGenerating || isSpeaking || !testText.trim()}
            className="flex-1 relative flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--foreground)] text-[var(--background)] font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none overflow-hidden group"
          >
            {isGenerating ? (
              'Generating...'
            ) : isSpeaking ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                Speaking
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Test Synthesis
              </span>
            )}
            
            {/* Subtle beam effect on button hover */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
          </button>

          {isSpeaking && (
            <button
              onClick={stopPlayback}
              title="Stop playback"
              className="px-4 py-3.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 active:scale-[0.98] transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
            </button>
          )}
        </div>

        {/* Microphone Test */}
        <div className="pt-4 mt-2">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Microphone Test</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
          </div>
          
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isSpeaking}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 ${
              isListening 
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20' 
                : 'bg-[var(--secondary)] border border-[var(--border)] hover:border-[var(--muted)] text-[var(--foreground)]'
            }`}
          >
            {isListening ? (
              <>
                <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
                Stop Listening
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                Test Microphone
              </>
            )}
          </button>
        </div>
      </div>

      {/* Audio element for analysis */}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
