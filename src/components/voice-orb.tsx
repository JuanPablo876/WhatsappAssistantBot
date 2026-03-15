'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type VisualizerVariant = 'orb' | 'ripple' | 'waveform' | 'bars';

interface VoiceOrbProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  audioLevel?: number; // 0-1
  size?: number;
  primaryColor?: string;
  secondaryColor?: string;
  variant?: VisualizerVariant;
}

/**
 * Circular waveform visualization that reacts to audio.
 * Shows a pulsating orb with radiating waveform spikes.
 */
export function VoiceOrb({
  isListening = false,
  isSpeaking = false,
  audioLevel = 0,
  size = 200,
  primaryColor = '#8b5cf6',
  secondaryColor = '#6366f1',
  variant = 'waveform',
}: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);
  const smoothLevelRef = useRef(0);
  const historyRef = useRef<number[]>(new Array(64).fill(0));

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = size / 2;
    const centerY = size / 2;

    // Smooth audio level transition
    smoothLevelRef.current += (audioLevel - smoothLevelRef.current) * 0.15;
    const smoothLevel = smoothLevelRef.current;

    // Update history for trail effect
    historyRef.current.shift();
    historyRef.current.push(smoothLevel);

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Time-based animation
    timeRef.current += 0.02;
    const time = timeRef.current;
    const isActive = isListening || isSpeaking;

    // Base radius
    const baseRadius = size * 0.25;
    const maxSpike = size * 0.15;

    // Draw outer glow rings when active
    if (isActive && smoothLevel > 0.1) {
      const numRings = 3;
      for (let r = 0; r < numRings; r++) {
        const ringProgress = (time * 0.5 + r * 0.33) % 1;
        const ringRadius = baseRadius + maxSpike + ringProgress * size * 0.2;
        const ringAlpha = (1 - ringProgress) * 0.3 * smoothLevel;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = primaryColor;
        ctx.globalAlpha = ringAlpha;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Draw circular waveform
    const numPoints = 64;
    const history = historyRef.current;

    ctx.beginPath();
    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2 - Math.PI / 2;
      
      // Create varied spikes based on position and audio
      const waveIndex = i % history.length;
      const historyValue = history[waveIndex];
      
      // Multiple wave frequencies for organic look
      const wave1 = Math.sin(angle * 3 + time * 2) * 0.3;
      const wave2 = Math.sin(angle * 5 + time * 3) * 0.2;
      const wave3 = Math.cos(angle * 7 + time * 1.5) * 0.15;
      const waveSum = wave1 + wave2 + wave3;
      
      // Calculate spike height
      let spikeHeight: number;
      if (isActive) {
        const audioSpike = historyValue * maxSpike;
        const waveSpike = waveSum * maxSpike * (0.3 + smoothLevel * 0.7);
        spikeHeight = audioSpike + waveSpike;
      } else {
        // Idle breathing animation
        const breathe = Math.sin(time * 1.5) * 0.5 + 0.5;
        spikeHeight = breathe * maxSpike * 0.2 + waveSum * maxSpike * 0.1;
      }
      
      const radius = baseRadius + Math.max(0, spikeHeight);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();

    // Create radial gradient fill
    const gradient = ctx.createRadialGradient(
      centerX, centerY, baseRadius * 0.5,
      centerX, centerY, baseRadius + maxSpike
    );
    gradient.addColorStop(0, secondaryColor);
    gradient.addColorStop(0.5, primaryColor);
    gradient.addColorStop(1, `${primaryColor}88`);

    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.8;
    ctx.fill();

    // Add stroke for definition
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.stroke();

    // Draw inner core circle
    const coreRadius = baseRadius * 0.6;
    const corePulse = isActive ? 1 + smoothLevel * 0.1 : 1 + Math.sin(time * 2) * 0.03;
    
    const coreGradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, coreRadius * corePulse
    );
    coreGradient.addColorStop(0, '#ffffff');
    coreGradient.addColorStop(0.3, secondaryColor);
    coreGradient.addColorStop(1, primaryColor);

    ctx.beginPath();
    ctx.arc(centerX, centerY, coreRadius * corePulse, 0, Math.PI * 2);
    ctx.fillStyle = coreGradient;
    ctx.globalAlpha = 0.9;
    ctx.fill();

    // Add glow effect
    if (isActive) {
      ctx.shadowBlur = 20 + smoothLevel * 30;
      ctx.shadowColor = primaryColor;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;

    animationRef.current = requestAnimationFrame(animate);
  }, [audioLevel, isListening, isSpeaking, size, primaryColor, secondaryColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [size, animate]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
      {/* Status indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {isListening && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Listening
          </div>
        )}
        {isSpeaking && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            Speaking
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to get audio levels from microphone
 */
export function useAudioLevel() {
  const [level, setLevel] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      setIsListening(true);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const updateLevel = () => {
        if (!analyserRef.current || !isListening) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate RMS of frequency data
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const normalizedLevel = Math.min(rms / 128, 1);
        
        setLevel(normalizedLevel);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
    } catch (error) {
      console.error('Failed to access microphone:', error);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    cancelAnimationFrame(animationRef.current);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    setIsListening(false);
    setLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return { level, isListening, startListening, stopListening };
}

/**
 * Hook to analyze audio level from an Audio element
 */
export function usePlaybackAudioLevel(audioElement: HTMLAudioElement | null) {
  const [level, setLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!audioElement) return;

    const setupAnalyser = () => {
      if (audioContextRef.current) return;

      try {
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        
        sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      } catch (error) {
        console.error('Failed to setup audio analyser:', error);
      }
    };

    const updateLevel = () => {
      if (!analyserRef.current) return;
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const normalizedLevel = Math.min(rms / 128, 1);
      
      setLevel(normalizedLevel);
      
      if (!audioElement.paused) {
        animationRef.current = requestAnimationFrame(updateLevel);
      } else {
        setLevel(0);
      }
    };

    const handlePlay = () => {
      setupAnalyser();
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      updateLevel();
    };

    const handlePause = () => {
      setLevel(0);
      cancelAnimationFrame(animationRef.current);
    };

    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handlePause);

    return () => {
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('ended', handlePause);
      cancelAnimationFrame(animationRef.current);
    };
  }, [audioElement]);

  return level;
}
