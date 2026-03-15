'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Props {
  currentConfig: {
    channel: string;
    isActive: boolean;
    phoneNumberId: string;
    accessToken: string;
    businessId: string;
  } | null;
}

export function WhatsAppSetupClient({ currentConfig }: Props) {
  const [channel, setChannel] = useState<'CLOUD_API' | 'BAILEYS'>(
    (currentConfig?.channel as any) || 'CLOUD_API'
  );
  const [saving, setSaving] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [usePairingCode, setUsePairingCode] = useState(false);
  const [qrStatus, setQrStatus] = useState<'disconnected' | 'connecting' | 'qr' | 'pairing' | 'connected'>('disconnected');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [cloudForm, setCloudForm] = useState({
    phoneNumberId: currentConfig?.phoneNumberId || '',
    accessToken: '',
    businessId: currentConfig?.businessId || '',
  });

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  async function saveCloudConfig() {
    setSaving(true);
    try {
      const res = await fetch('/api/whatsapp/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'CLOUD_API',
          phoneNumberId: cloudForm.phoneNumberId,
          accessToken: cloudForm.accessToken,
          businessId: cloudForm.businessId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('WhatsApp Cloud API configured! Your bot is now active.');
      }
    } catch {
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function startBaileys() {
    setSaving(true);
    setQrCode(null);
    setPairingCode(null);
    setQrStatus('connecting');
    
    try {
      const body: Record<string, string | boolean> = { 
        channel: 'BAILEYS',
        freshStart: true,
      };
      // If using pairing code, include phone number
      if (usePairingCode && phoneNumber) {
        body.phoneNumber = phoneNumber;
      }
      
      const res = await fetch('/api/whatsapp/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        // Start polling for QR code or pairing code
        startQrPolling();
      } else {
        setQrStatus('disconnected');
      }
    } catch {
      alert('Failed to start. Please try again.');
      setQrStatus('disconnected');
    } finally {
      setSaving(false);
    }
  }

  const startQrPolling = useCallback(() => {
    stopPolling();
    
    // Poll every 2 seconds for QR code updates
    const poll = async () => {
      try {
        const res = await fetch('/api/whatsapp/qr');
        
        // Handle non-200 responses
        if (!res.ok) {
          console.error('QR poll error: HTTP', res.status);
          return; // Keep polling, don't change state
        }
        
        const data = await res.json();
        
        // Only update status if we have meaningful data
        if (data.status === 'qr' && data.qrCode) {
          setQrStatus('qr');
          setQrCode(data.qrCode);
          setPairingCode(null);
        } else if (data.status === 'pairing' && data.pairingCode) {
          setQrStatus('pairing');
          setPairingCode(data.pairingCode);
          setQrCode(null);
        } else if (data.status === 'connected') {
          setQrStatus('connected');
          setQrCode(null);
          setPairingCode(null);
          // Stop polling once connected
          stopPolling();
        } else if (data.status === 'connecting') {
          setQrStatus((prev) => (prev === 'qr' || prev === 'pairing' ? prev : 'connecting'));
        } else if (data.status === 'disconnected') {
          setQrStatus((prev) => (prev === 'qr' || prev === 'pairing' ? prev : 'disconnected'));
        }
      } catch (e) {
        console.error('QR polling error:', e);
        // Don't change state on error - keep existing QR visible
      }
    };
    
    // Initial poll
    poll();
    
    // Continue polling
    pollingRef.current = setInterval(poll, 2000);
  }, [stopPolling]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  useEffect(() => {
    if (channel === 'BAILEYS') {
      if (currentConfig?.channel === 'BAILEYS' && currentConfig?.isActive) {
        startQrPolling();
      }
      return;
    }

    stopPolling();
  }, [channel, currentConfig?.channel, currentConfig?.isActive, startQrPolling, stopPolling]);

  return (
    <div>
      {/* Channel selector */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setChannel('CLOUD_API')}
          className={`flex-1 p-4 rounded-lg border text-left transition-all ${
            channel === 'CLOUD_API'
              ? 'border-[var(--primary)] bg-[var(--primary-light)]'
              : 'border-[var(--border)] hover:border-[var(--border-light)]'
          }`}
        >
          <div className="font-medium text-sm">☁️ Cloud API (Recommended)</div>
          <div className="text-xs text-[var(--muted)] mt-1">Official Meta API — production ready</div>
        </button>
        <button
          onClick={() => setChannel('BAILEYS')}
          className={`flex-1 p-4 rounded-lg border text-left transition-all ${
            channel === 'BAILEYS'
              ? 'border-[var(--primary)] bg-[var(--primary-light)]'
              : 'border-[var(--border)] hover:border-[var(--border-light)]'
          }`}
        >
          <div className="font-medium text-sm">📱 WhatsApp Web (Baileys)</div>
          <div className="text-xs text-[var(--muted)] mt-1">Free — scan QR to connect</div>
        </button>
      </div>

      {/* Cloud API form */}
      {channel === 'CLOUD_API' && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold mb-1">Cloud API Configuration</h3>
          <p className="text-sm text-[var(--muted)] mb-4">
            You&apos;ll need a Meta Business account.{' '}
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
              target="_blank"
              rel="noopener"
              className="text-[var(--accent)] hover:underline"
            >
              Follow this guide →
            </a>
          </p>

          <div>
            <label className="block text-sm font-medium mb-1.5">Phone Number ID</label>
            <input
              type="text"
              value={cloudForm.phoneNumberId}
              onChange={(e) => setCloudForm({ ...cloudForm, phoneNumberId: e.target.value })}
              placeholder="e.g., 100123456789012"
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Permanent Access Token</label>
            <input
              type="password"
              value={cloudForm.accessToken}
              onChange={(e) => setCloudForm({ ...cloudForm, accessToken: e.target.value })}
              placeholder="EAAxxxxxxxx..."
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Business ID</label>
            <input
              type="text"
              value={cloudForm.businessId}
              onChange={(e) => setCloudForm({ ...cloudForm, businessId: e.target.value })}
              placeholder="e.g., 101234567890"
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
            />
          </div>

          <button
            onClick={saveCloudConfig}
            disabled={saving || !cloudForm.phoneNumberId || !cloudForm.accessToken}
            className="px-6 py-2.5 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Connect Cloud API'}
          </button>

          {currentConfig?.channel === 'CLOUD_API' && currentConfig?.isActive && (
            <div className="flex items-center gap-2 mt-2 text-sm text-[var(--primary)]">
              <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
              Connected and active
            </div>
          )}
        </div>
      )}

      {/* Baileys form */}
      {channel === 'BAILEYS' && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold mb-1">WhatsApp Web Connection</h3>
          
          {/* Connection method toggle */}
          <div className="flex gap-2 p-1 bg-[var(--background)] rounded-lg">
            <button
              onClick={() => { setUsePairingCode(false); setPhoneNumber(''); }}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                !usePairingCode 
                  ? 'bg-white shadow-sm text-[var(--foreground)]' 
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              📷 QR Code
            </button>
            <button
              onClick={() => setUsePairingCode(true)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                usePairingCode 
                  ? 'bg-white shadow-sm text-[var(--foreground)]' 
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              🔢 Pairing Code
            </button>
          </div>

          {/* Instructions based on method */}
          {!usePairingCode ? (
            <p className="text-sm text-[var(--muted)]">
              Click the button below and scan the QR code with your phone&apos;s WhatsApp 
              (Settings → Linked Devices → Link a Device).
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--muted)]">
                Enter your phone number to get a pairing code. Then enter the code in WhatsApp 
                (Settings → Linked Devices → Link with phone number).
              </p>
              <div>
                <label className="block text-sm font-medium mb-1.5">Phone Number (with country code)</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g., 1234567890"
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                />
                <p className="text-xs text-[var(--muted)] mt-1">Include country code without + (e.g., 1 for US, 44 for UK)</p>
              </div>
            </div>
          )}

          {/* QR Code Display */}
          {qrStatus === 'qr' && qrCode && (
            <div className="flex flex-col items-center p-6 rounded-lg bg-white">
              <img 
                src={qrCode} 
                alt="WhatsApp QR Code" 
                className="w-64 h-64"
              />
              <p className="mt-4 text-sm text-gray-600 text-center">
                Scan this QR code with WhatsApp on your phone
              </p>
              <p className="text-xs text-gray-400 mt-1">
                QR code expires in 60 seconds
              </p>
            </div>
          )}

          {/* Pairing Code Display */}
          {qrStatus === 'pairing' && pairingCode && (
            <div className="flex flex-col items-center p-6 rounded-lg bg-white border-2 border-[var(--primary)]">
              <p className="text-sm text-gray-600 mb-3">Enter this code in WhatsApp:</p>
              <div className="text-4xl font-mono font-bold tracking-widest text-[var(--primary)]">
                {pairingCode}
              </div>
              <p className="mt-4 text-sm text-gray-600 text-center">
                Go to WhatsApp → Settings → Linked Devices → Link with phone number
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Code expires in 60 seconds
              </p>
            </div>
          )}

          {/* Connection status */}
          {qrStatus === 'connecting' && !qrCode && !pairingCode && (
            <div className="flex items-center justify-center p-8 rounded-lg bg-[var(--background)] border border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-[var(--muted)]">Connecting to WhatsApp...</span>
              </div>
            </div>
          )}

          {qrStatus === 'connected' && (
            <div className="flex items-center justify-center p-8 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-3 text-green-700">
                <span className="text-2xl">✅</span>
                <span className="font-medium">WhatsApp Connected!</span>
              </div>
            </div>
          )}

          {qrStatus === 'disconnected' && (
            <div className="p-4 rounded-lg bg-[var(--background)] border border-[var(--border)]">
              <p className="text-xs text-[var(--muted)] mb-3">ℹ️ How it works:</p>
              <ol className="text-xs text-[var(--muted)] space-y-1.5 list-decimal list-inside">
                <li>Click &quot;Start Connection&quot; below</li>
                <li>A QR code will appear here</li>
                <li>Open WhatsApp on your phone → Settings → Linked Devices</li>
                <li>Tap &quot;Link a Device&quot; and scan the QR code</li>
                <li>Done! Your number is now connected</li>
              </ol>
            </div>
          )}

          <button
            onClick={startBaileys}
            disabled={saving || qrStatus === 'connecting' || (usePairingCode && !phoneNumber)}
            className="px-6 py-2.5 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Starting...' : qrStatus === 'connected' ? 'Reconnect' : usePairingCode ? 'Get Pairing Code' : 'Start Connection'}
          </button>

          {currentConfig?.channel === 'BAILEYS' && currentConfig?.isActive && qrStatus !== 'connected' && (
            <div className="flex items-center gap-2 mt-2 text-sm text-[var(--primary)]">
              <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
              Previously connected (reconnect to resume)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
