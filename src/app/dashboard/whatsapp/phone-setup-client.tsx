'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type SetupType = 'RENT_NUMBER' | 'BAILEYS' | 'BYOP_TWILIO' | 'BYOP_META';
type RentalStatus = 'PENDING' | 'PROCESSING' | 'FULFILLED' | 'REJECTED' | 'CANCELLED';

interface Props {
  currentConfig: {
    setupType: string;
    channel: string;
    isActive: boolean;
    phoneNumberId: string;
    accessToken: string;
    businessId: string;
    twilioAccountSid: string;
    twilioAuthToken: string;
    twilioPhoneNumber: string;
  } | null;
  rentalRequest: {
    id: string;
    status: RentalStatus;
    countryCode: string;
    assignedNumber: string | null;
    requestedAt: string;
    fulfilledAt?: string;
  } | null;
  tenantId: string;
}

const COUNTRY_OPTIONS = [
  { code: 'MX', name: 'Mexico (+52)', flag: '🇲🇽' },
  { code: 'US', name: 'United States (+1)', flag: '🇺🇸' },
  { code: 'ES', name: 'Spain (+34)', flag: '🇪🇸' },
  { code: 'CO', name: 'Colombia (+57)', flag: '🇨🇴' },
  { code: 'AR', name: 'Argentina (+54)', flag: '🇦🇷' },
  { code: 'CL', name: 'Chile (+56)', flag: '🇨🇱' },
  { code: 'PE', name: 'Peru (+51)', flag: '🇵🇪' },
];

export function PhoneSetupClient({ currentConfig, rentalRequest, tenantId }: Props) {
  const [selectedOption, setSelectedOption] = useState<SetupType | null>(
    (currentConfig?.setupType as SetupType) || null
  );
  const [saving, setSaving] = useState(false);
  
  // Baileys state
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [usePairingCode, setUsePairingCode] = useState(false);
  const [qrStatus, setQrStatus] = useState<'disconnected' | 'connecting' | 'qr' | 'pairing' | 'connected'>('disconnected');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Rental request state
  const [rentalForm, setRentalForm] = useState({
    countryCode: 'MX',
    preferredArea: '',
    purpose: '',
  });

  // BYOP Twilio state
  const [twilioForm, setTwilioForm] = useState({
    accountSid: currentConfig?.twilioAccountSid || '',
    authToken: '',
    phoneNumber: currentConfig?.twilioPhoneNumber || '',
  });

  // BYOP Meta state
  const [metaForm, setMetaForm] = useState({
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

  // Baileys polling
  const startQrPolling = useCallback(() => {
    stopPolling();
    
    const poll = async () => {
      try {
        const res = await fetch('/api/whatsapp/qr');
        if (!res.ok) return;
        
        const data = await res.json();
        
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
          stopPolling();
        } else if (data.status === 'connecting') {
          setQrStatus((prev) => (prev === 'qr' || prev === 'pairing' ? prev : 'connecting'));
        }
      } catch (e) {
        console.error('QR polling error:', e);
      }
    };
    
    poll();
    pollingRef.current = setInterval(poll, 2000);
  }, [stopPolling]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    if (selectedOption === 'BAILEYS' && currentConfig?.channel === 'BAILEYS' && currentConfig?.isActive) {
      startQrPolling();
    } else {
      stopPolling();
    }
  }, [selectedOption, currentConfig?.channel, currentConfig?.isActive, startQrPolling, stopPolling]);

  // Handlers
  async function submitRentalRequest() {
    setSaving(true);
    try {
      const res = await fetch('/api/whatsapp/rental-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          ...rentalForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        window.location.reload();
      } else {
        alert(data.error || 'Failed to submit request');
      }
    } catch {
      alert('Failed to submit. Please try again.');
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
        setupType: 'BAILEYS',
        freshStart: true,
      };
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

  async function saveTwilioConfig() {
    setSaving(true);
    try {
      const res = await fetch('/api/whatsapp/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setupType: 'BYOP_TWILIO',
          channel: 'CLOUD_API',
          twilioAccountSid: twilioForm.accountSid,
          twilioAuthToken: twilioForm.authToken,
          twilioPhoneNumber: twilioForm.phoneNumber,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Twilio configured! Your bot is now active.');
        window.location.reload();
      }
    } catch {
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function saveMetaConfig() {
    setSaving(true);
    try {
      const res = await fetch('/api/whatsapp/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setupType: 'BYOP_META',
          channel: 'CLOUD_API',
          phoneNumberId: metaForm.phoneNumberId,
          accessToken: metaForm.accessToken,
          businessId: metaForm.businessId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Meta Business configured! Your bot is now active.');
        window.location.reload();
      }
    } catch {
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // If there's a pending/processing rental request, show status
  if (rentalRequest && ['PENDING', 'PROCESSING'].includes(rentalRequest.status)) {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 flex items-center justify-center">
          <span className="text-3xl">⏳</span>
        </div>
        <h2 className="text-xl font-semibold mb-2">Number Request in Progress</h2>
        <p className="text-[var(--muted)] mb-4">
          {rentalRequest.status === 'PENDING' 
            ? 'Your request is being reviewed by our team.'
            : 'We are purchasing your phone number from Twilio.'}
        </p>
        <div className="inline-block px-4 py-2 rounded-full bg-yellow-100 text-yellow-800 text-sm font-medium">
          Status: {rentalRequest.status === 'PENDING' ? 'Awaiting Review' : 'Processing'}
        </div>
        <p className="text-sm text-[var(--muted)] mt-4">
          Requested: {new Date(rentalRequest.requestedAt).toLocaleDateString()}
          <br />
          Expected fulfillment: 1-3 business days
        </p>
      </div>
    );
  }

  // If rental is fulfilled, show the assigned number
  if (rentalRequest?.status === 'FULFILLED' && rentalRequest.assignedNumber) {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
          <span className="text-3xl">✅</span>
        </div>
        <h2 className="text-xl font-semibold mb-2">Your Number is Ready!</h2>
        <div className="text-3xl font-mono font-bold text-[var(--primary)] mb-4">
          {rentalRequest.assignedNumber}
        </div>
        <p className="text-[var(--muted)]">
          Your AI assistant is now active on this number. Customers can call or message to interact with your bot.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Option Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Option 1: Rent from Us */}
        <button
          onClick={() => setSelectedOption('RENT_NUMBER')}
          className={`p-5 rounded-xl border-2 text-left transition-all ${
            selectedOption === 'RENT_NUMBER'
              ? 'border-[var(--primary)] bg-[var(--primary-light)] shadow-lg'
              : 'border-[var(--border)] hover:border-[var(--primary)] hover:shadow-md'
          }`}
        >
          <div className="text-3xl mb-3">📞</div>
          <h3 className="font-semibold mb-1">Rent a Number</h3>
          <p className="text-xs text-[var(--muted)] mb-3">
            We provide a dedicated phone number for your business
          </p>
          <div className="flex flex-wrap gap-1">
            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">Voice + WhatsApp</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">Managed by us</span>
          </div>
        </button>

        {/* Option 2: WhatsApp Web (Baileys) */}
        <button
          onClick={() => setSelectedOption('BAILEYS')}
          className={`p-5 rounded-xl border-2 text-left transition-all ${
            selectedOption === 'BAILEYS'
              ? 'border-[var(--primary)] bg-[var(--primary-light)] shadow-lg'
              : 'border-[var(--border)] hover:border-[var(--primary)] hover:shadow-md'
          }`}
        >
          <div className="text-3xl mb-3">📱</div>
          <h3 className="font-semibold mb-1">WhatsApp Web</h3>
          <p className="text-xs text-[var(--muted)] mb-3">
            Use your existing phone by scanning a QR code
          </p>
          <div className="flex flex-wrap gap-1">
            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">Free</span>
            <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs">WhatsApp only</span>
          </div>
        </button>

        {/* Option 3: Bring Your Own */}
        <button
          onClick={() => setSelectedOption('BYOP_TWILIO')}
          className={`p-5 rounded-xl border-2 text-left transition-all ${
            selectedOption === 'BYOP_TWILIO' || selectedOption === 'BYOP_META'
              ? 'border-[var(--primary)] bg-[var(--primary-light)] shadow-lg'
              : 'border-[var(--border)] hover:border-[var(--primary)] hover:shadow-md'
          }`}
        >
          <div className="text-3xl mb-3">🔧</div>
          <h3 className="font-semibold mb-1">Bring Your Own</h3>
          <p className="text-xs text-[var(--muted)] mb-3">
            Connect your own Twilio or Meta Business account
          </p>
          <div className="flex flex-wrap gap-1">
            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs">Advanced</span>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">Full control</span>
          </div>
        </button>
      </div>

      {/* Configuration Panels */}
      {selectedOption === 'RENT_NUMBER' && (
        <div className="card p-6 space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <span className="text-xl">ℹ️</span>
            <div>
              <h4 className="font-medium text-blue-900">How it works</h4>
              <p className="text-sm text-blue-700 mt-1">
                You submit a request and we purchase a dedicated phone number from Twilio for your business. 
                This number supports <strong>voice calls</strong> and <strong>WhatsApp messages</strong>. 
                The setup typically takes <strong>1-3 business days</strong>.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Country</label>
            <select
              value={rentalForm.countryCode}
              onChange={(e) => setRentalForm({ ...rentalForm, countryCode: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Preferred Area Code (optional)</label>
            <input
              type="text"
              value={rentalForm.preferredArea}
              onChange={(e) => setRentalForm({ ...rentalForm, preferredArea: e.target.value })}
              placeholder="e.g., 33 for Guadalajara, 55 for Mexico City"
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Purpose (optional)</label>
            <textarea
              value={rentalForm.purpose}
              onChange={(e) => setRentalForm({ ...rentalForm, purpose: e.target.value })}
              placeholder="Brief description of how you'll use this number..."
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none resize-none"
            />
          </div>

          <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
            <p className="text-sm text-yellow-800">
              <strong>Pricing:</strong> Numbers start at ~$4/month + usage fees. 
              We&apos;ll confirm the exact pricing before activating.
            </p>
          </div>

          <button
            onClick={submitRentalRequest}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Submitting...' : 'Request a Number'}
          </button>
        </div>
      )}

      {selectedOption === 'BAILEYS' && (
        <div className="card p-6 space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
            <span className="text-xl">📱</span>
            <div>
              <h4 className="font-medium text-green-900">WhatsApp Web Connection</h4>
              <p className="text-sm text-green-700 mt-1">
                Connect your existing WhatsApp number by scanning a QR code. This is <strong>free</strong> and works instantly, 
                but only supports WhatsApp messages (no voice calls). Best for testing or small-scale use.
              </p>
            </div>
          </div>

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

          {usePairingCode && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone Number (with country code)</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g., 521234567890"
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
              />
              <p className="text-xs text-[var(--muted)] mt-1">Include country code without + (e.g., 52 for Mexico, 1 for US)</p>
            </div>
          )}

          {/* QR Code Display */}
          {qrStatus === 'qr' && qrCode && (
            <div className="flex flex-col items-center p-6 rounded-lg bg-white border">
              <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
              <p className="mt-4 text-sm text-gray-600 text-center">
                Scan this QR code with WhatsApp on your phone
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
            </div>
          )}

          {qrStatus === 'connecting' && !qrCode && !pairingCode && (
            <div className="flex items-center justify-center p-8 rounded-lg bg-[var(--background)] border">
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

          <button
            onClick={startBaileys}
            disabled={saving || qrStatus === 'connecting' || (usePairingCode && !phoneNumber)}
            className="px-6 py-2.5 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Starting...' : qrStatus === 'connected' ? 'Reconnect' : usePairingCode ? 'Get Pairing Code' : 'Start Connection'}
          </button>
        </div>
      )}

      {(selectedOption === 'BYOP_TWILIO' || selectedOption === 'BYOP_META') && (
        <div className="card p-6 space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-purple-50 border border-purple-200">
            <span className="text-xl">🔧</span>
            <div>
              <h4 className="font-medium text-purple-900">Bring Your Own Account</h4>
              <p className="text-sm text-purple-700 mt-1">
                Connect your own Twilio or Meta Business account for full control over your phone number. 
                You manage billing directly with the provider.
              </p>
            </div>
          </div>

          {/* Provider toggle */}
          <div className="flex gap-2 p-1 bg-[var(--background)] rounded-lg">
            <button
              onClick={() => setSelectedOption('BYOP_TWILIO')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                selectedOption === 'BYOP_TWILIO'
                  ? 'bg-white shadow-sm text-[var(--foreground)]' 
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Twilio (Voice + WhatsApp)
            </button>
            <button
              onClick={() => setSelectedOption('BYOP_META')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                selectedOption === 'BYOP_META'
                  ? 'bg-white shadow-sm text-[var(--foreground)]' 
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Meta Business (WhatsApp only)
            </button>
          </div>

          {selectedOption === 'BYOP_TWILIO' && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--muted)]">
                Get your credentials from{' '}
                <a href="https://console.twilio.com" target="_blank" rel="noopener" className="text-[var(--accent)] hover:underline">
                  console.twilio.com →
                </a>
              </p>

              <div>
                <label className="block text-sm font-medium mb-1.5">Account SID</label>
                <input
                  type="text"
                  value={twilioForm.accountSid}
                  onChange={(e) => setTwilioForm({ ...twilioForm, accountSid: e.target.value })}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Auth Token</label>
                <input
                  type="password"
                  value={twilioForm.authToken}
                  onChange={(e) => setTwilioForm({ ...twilioForm, authToken: e.target.value })}
                  placeholder="Your Twilio auth token"
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={twilioForm.phoneNumber}
                  onChange={(e) => setTwilioForm({ ...twilioForm, phoneNumber: e.target.value })}
                  placeholder="+15551234567"
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>

              <button
                onClick={saveTwilioConfig}
                disabled={saving || !twilioForm.accountSid || !twilioForm.authToken || !twilioForm.phoneNumber}
                className="px-6 py-2.5 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Connect Twilio'}
              </button>
            </div>
          )}

          {selectedOption === 'BYOP_META' && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--muted)]">
                Follow{' '}
                <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener" className="text-[var(--accent)] hover:underline">
                  Meta&apos;s setup guide →
                </a>
              </p>

              <div>
                <label className="block text-sm font-medium mb-1.5">Phone Number ID</label>
                <input
                  type="text"
                  value={metaForm.phoneNumberId}
                  onChange={(e) => setMetaForm({ ...metaForm, phoneNumberId: e.target.value })}
                  placeholder="e.g., 100123456789012"
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Permanent Access Token</label>
                <input
                  type="password"
                  value={metaForm.accessToken}
                  onChange={(e) => setMetaForm({ ...metaForm, accessToken: e.target.value })}
                  placeholder="EAAxxxxxxxx..."
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Business ID</label>
                <input
                  type="text"
                  value={metaForm.businessId}
                  onChange={(e) => setMetaForm({ ...metaForm, businessId: e.target.value })}
                  placeholder="e.g., 101234567890"
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>

              <button
                onClick={saveMetaConfig}
                disabled={saving || !metaForm.phoneNumberId || !metaForm.accessToken}
                className="px-6 py-2.5 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Connect Meta Business'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
