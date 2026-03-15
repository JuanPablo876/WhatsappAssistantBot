'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SERVICE_COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#f97316', label: 'Orange' },
];

// Reminder lead time options (minutes before appointment)
const REMINDER_LEAD_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 1440, label: '1 day' },
  { value: 2880, label: '2 days' },
];

// Available reminder channels
const REMINDER_CHANNELS = [
  { value: 'WHATSAPP', label: 'WhatsApp', icon: '💬' },
  { value: 'EMAIL', label: 'Email', icon: '📧' },
];

interface ServiceType {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number | null;
  color: string;
  isActive: boolean;
}

interface TimeOffEntry {
  id: string;
  title: string;
  reason: string;
  allDay: boolean;
  startDate: string;
  endDate: string;
}

interface Props {
  googleConnected: boolean;
  ownerPhone: string;
  serviceTypes: ServiceType[];
  timeOffs: TimeOffEntry[];
  profile: {
    businessName: string;
    businessType: string;
    description: string;
    services: string;
    systemPrompt: string;
    tone: string;
    language: string;
    timezone: string;
    workingDays: string;
    openTime: string;
    closeTime: string;
    slotDuration: number;
    welcomeMessage: string;
    // Notification settings
    reminderLeadMinutes: number[];
    reminderChannels: string[];
    quietHoursStart: string;
    quietHoursEnd: string;
    emailProvider: string;
    emailApiKey: string;
    emailFromAddress: string;
  } | null;
}

export function SettingsClient({ profile, googleConnected: initialGoogleConnected, ownerPhone: initialOwnerPhone, serviceTypes: initialServiceTypes, timeOffs: initialTimeOffs }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: profile?.businessName || '',
    businessType: profile?.businessType || '',
    description: profile?.description || '',
    services: profile?.services || '',
    systemPrompt: profile?.systemPrompt || '',
    tone: profile?.tone || 'professional',
    language: profile?.language || 'en',
    timezone: profile?.timezone || 'America/New_York',
    workingDays: profile?.workingDays || 'Mon,Tue,Wed,Thu,Fri',
    openTime: profile?.openTime || '09:00',
    closeTime: profile?.closeTime || '17:00',
    slotDuration: profile?.slotDuration || 30,
    welcomeMessage: profile?.welcomeMessage || '',
    ownerPhone: initialOwnerPhone || '',
    // Notification settings
    reminderLeadMinutes: profile?.reminderLeadMinutes || [],
    reminderChannels: profile?.reminderChannels || [],
    quietHoursStart: profile?.quietHoursStart || '',
    quietHoursEnd: profile?.quietHoursEnd || '',
    emailProvider: profile?.emailProvider || '',
    emailApiKey: profile?.emailApiKey || '',
    emailFromAddress: profile?.emailFromAddress || '',
  });
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'business' | 'schedule' | 'services' | 'timeoff' | 'calendar' | 'notifications' | 'ai'>('business');
  const [googleConnected, setGoogleConnected] = useState(initialGoogleConnected);
  const [disconnecting, setDisconnecting] = useState(false);

  // Service types state
  const [services, setServices] = useState<ServiceType[]>(initialServiceTypes);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState({ name: '', description: '', duration: '30', price: '', color: '#3b82f6' });
  const [serviceSaving, setServiceSaving] = useState(false);

  // Time off state
  const [timeOffs, setTimeOffs] = useState<TimeOffEntry[]>(initialTimeOffs);
  const [showTimeOffForm, setShowTimeOffForm] = useState(false);
  const [editingTimeOff, setEditingTimeOff] = useState<TimeOffEntry | null>(null);
  const [timeOffForm, setTimeOffForm] = useState({ title: '', reason: '', allDay: true, startDate: '', endDate: '', startTime: '', endTime: '' });
  const [timeOffSaving, setTimeOffSaving] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    const googleStatus = searchParams.get('google');
    if (googleStatus === 'connected') {
      setGoogleConnected(true);
      setActiveTab('calendar');
    } else if (googleStatus === 'denied' || googleStatus === 'error') {
      setActiveTab('calendar');
    }
  }, [searchParams]);

  async function disconnectGoogle() {
    if (!confirm('Disconnect Google Calendar? The bot won\'t be able to manage appointments.')) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/auth/google/disconnect', { method: 'POST' });
      if (res.ok) {
        setGoogleConnected(false);
      }
    } catch {
      alert('Failed to disconnect. Try again.');
    } finally {
      setDisconnecting(false);
    }
  }

  const selectedDays = form.workingDays.split(',').filter(Boolean);

  function toggleDay(day: string) {
    const days = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    setForm({ ...form, workingDays: days.join(',') });
  }

  async function regeneratePrompt() {
    setRegenerating(true);
    try {
      const res = await fetch('/api/onboarding/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: form.businessName,
          businessType: form.businessType,
          description: form.description,
          services: form.services,
          tone: form.tone,
          language: form.language,
        }),
      });
      const data = await res.json();
      if (data.prompt) {
        setForm({ ...form, systemPrompt: data.prompt });
      }
    } catch {
      alert('Failed to regenerate. Please try again.');
    } finally {
      setRegenerating(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        alert('Settings saved!');
        router.refresh();
      }
    } catch {
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg bg-[var(--card)] flex-wrap">
        {(['business', 'schedule', 'services', 'timeoff', 'calendar', 'notifications', 'ai'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors min-w-[100px] ${
              activeTab === tab
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab === 'business' ? '🏢 Business' : tab === 'schedule' ? '📅 Schedule' : tab === 'services' ? '🛠️ Services' : tab === 'timeoff' ? '🏖️ Time Off' : tab === 'calendar' ? '📆 Calendar' : tab === 'notifications' ? '🔔 Reminders' : '🤖 AI'}
          </button>
        ))}
      </div>

      {/* Business Info Tab */}
      {activeTab === 'business' && (
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Business Name</label>
            <input
              type="text"
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Business Type</label>
            <select
              value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
            >
              <option value="salon">Salon / Barbershop</option>
              <option value="clinic">Clinic / Medical</option>
              <option value="dental">Dental Office</option>
              <option value="fitness">Fitness / Gym</option>
              <option value="consulting">Consulting</option>
              <option value="restaurant">Restaurant</option>
              <option value="spa">Spa / Wellness</option>
              <option value="legal">Legal Services</option>
              <option value="education">Education / Tutoring</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Owner Notification Phone
              <span className="text-[var(--muted)] font-normal ml-1">(with country code)</span>
            </label>
            <input
              type="text"
              value={form.ownerPhone}
              onChange={(e) => setForm({ ...form, ownerPhone: e.target.value.replace(/\D/g, '') })}
              placeholder="5213318888888"
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
            />
            <p className="text-xs text-[var(--muted)] mt-1">Bot will notify this number about new appointments, messages, etc.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Services</label>
            <textarea
              value={form.services}
              onChange={(e) => setForm({ ...form, services: e.target.value })}
              rows={2}
              placeholder="e.g., Haircut, Coloring, Styling, Beard Trim"
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Tone</label>
              <select
                value={form.tone}
                onChange={(e) => setForm({ ...form, tone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly & Casual</option>
                <option value="formal">Formal</option>
                <option value="warm">Warm & Empathetic</option>
                <option value="energetic">Energetic & Fun</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Language</label>
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="pt">Portuguese</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Welcome Message</label>
            <input
              type="text"
              value={form.welcomeMessage}
              onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
              placeholder="Hi! Thanks for reaching out. How can I help you today?"
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Appointment Types</h3>
                <p className="text-sm text-[var(--muted)]">
                  Define services/appointment types with different durations and prices. The bot will use these when booking.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingService(null);
                  setServiceForm({ name: '', description: '', duration: '30', price: '', color: '#3b82f6' });
                  setShowServiceForm(true);
                }}
                className="px-4 py-2 rounded-lg gradient-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                + Add Service
              </button>
            </div>

            {/* Service form (add/edit) */}
            {showServiceForm && (
              <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--background)] mb-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Service Name *</label>
                    <input
                      type="text"
                      value={serviceForm.name}
                      onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                      placeholder="e.g., Haircut, Consultation"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Duration (minutes) *</label>
                    <select
                      value={serviceForm.duration}
                      onChange={(e) => setServiceForm({ ...serviceForm, duration: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none text-sm"
                    >
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">1 hour</option>
                      <option value="90">1.5 hours</option>
                      <option value="120">2 hours</option>
                      <option value="180">3 hours</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input
                    type="text"
                    value={serviceForm.description}
                    onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                    placeholder="Brief description (optional)"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Price (optional)</label>
                    <input
                      type="number"
                      value={serviceForm.price}
                      onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Color</label>
                    <div className="flex gap-2 flex-wrap">
                      {SERVICE_COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setServiceForm({ ...serviceForm, color: c.value })}
                          className={`w-7 h-7 rounded-full border-2 transition-all ${
                            serviceForm.color === c.value ? 'border-white scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowServiceForm(false)}
                    className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!serviceForm.name || !serviceForm.duration) return;
                      setServiceSaving(true);
                      try {
                        if (editingService) {
                          const res = await fetch(`/api/service-types/${editingService.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(serviceForm),
                          });
                          const data = await res.json();
                          if (data.success) {
                            setServices(services.map(s => s.id === editingService.id ? {
                              ...s,
                              name: serviceForm.name,
                              description: serviceForm.description,
                              duration: parseInt(serviceForm.duration),
                              price: serviceForm.price ? parseFloat(serviceForm.price) : null,
                              color: serviceForm.color,
                            } : s));
                          }
                        } else {
                          const res = await fetch('/api/service-types', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(serviceForm),
                          });
                          const data = await res.json();
                          if (data.success && data.serviceType) {
                            setServices([...services, {
                              id: data.serviceType.id,
                              name: data.serviceType.name,
                              description: data.serviceType.description || '',
                              duration: data.serviceType.duration,
                              price: data.serviceType.price,
                              color: data.serviceType.color || '',
                              isActive: data.serviceType.isActive,
                            }]);
                          }
                        }
                        setShowServiceForm(false);
                        setEditingService(null);
                      } catch {
                        alert('Failed to save service type');
                      } finally {
                        setServiceSaving(false);
                      }
                    }}
                    disabled={serviceSaving || !serviceForm.name}
                    className="px-4 py-2 rounded-lg gradient-primary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {serviceSaving ? 'Saving...' : editingService ? 'Update' : 'Add Service'}
                  </button>
                </div>
              </div>
            )}

            {/* Service type list */}
            {services.length === 0 && !showServiceForm ? (
              <div className="text-center py-10 text-[var(--muted)]">
                <div className="text-4xl mb-3">🛠️</div>
                <p className="text-sm">No service types yet. Add your first one!</p>
                <p className="text-xs mt-1">
                  Service types let the bot offer specific appointment durations per service.
                  <br />Without them, the default slot duration ({form.slotDuration} min) from the Schedule tab is used.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {services.map((svc) => (
                  <div
                    key={svc.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                      svc.isActive
                        ? 'border-[var(--border)] hover:bg-[var(--background)]'
                        : 'border-[var(--border)] opacity-50'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: svc.color || '#888' }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{svc.name}</div>
                      {svc.description && (
                        <div className="text-xs text-[var(--muted)] truncate">{svc.description}</div>
                      )}
                    </div>
                    <div className="text-xs text-[var(--muted)] shrink-0">
                      {svc.duration} min
                    </div>
                    {svc.price !== null && (
                      <div className="text-xs font-medium shrink-0">
                        ${svc.price.toFixed(2)}
                      </div>
                    )}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditingService(svc);
                          setServiceForm({
                            name: svc.name,
                            description: svc.description,
                            duration: svc.duration.toString(),
                            price: svc.price !== null ? svc.price.toString() : '',
                            color: svc.color || '#3b82f6',
                          });
                          setShowServiceForm(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-[var(--card)] transition-colors text-[var(--muted)]"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete "${svc.name}"?`)) return;
                          try {
                            const res = await fetch(`/api/service-types/${svc.id}`, { method: 'DELETE' });
                            if (res.ok) {
                              setServices(services.filter(s => s.id !== svc.id));
                            }
                          } catch {
                            alert('Failed to delete');
                          }
                        }}
                        className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors text-red-400"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 rounded-lg bg-[var(--card)] text-sm text-[var(--muted)]">
            <p className="font-medium text-[var(--foreground)] mb-1">💡 How it works</p>
            <p>
              When a customer books via WhatsApp, the bot will ask which service they want. Each service type has its own duration,
              so a &quot;Quick Trim&quot; (15 min) and a &quot;Full Color&quot; (2 hours) can be booked in the same calendar without conflicts.
              If no service types are defined, the default slot duration from the Schedule tab is used for all appointments.
            </p>
          </div>
        </div>
      )}

      {/* Time Off Tab */}
      {activeTab === 'timeoff' && (
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Time Off &amp; Blocked Days</h3>
                <p className="text-sm text-[var(--muted)]">
                  Set vacations, holidays, or rest periods. The bot won&apos;t schedule appointments during these times.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingTimeOff(null);
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  const tomorrowStr = tomorrow.toISOString().split('T')[0];
                  setTimeOffForm({ title: '', reason: '', allDay: true, startDate: tomorrowStr, endDate: tomorrowStr, startTime: '09:00', endTime: '17:00' });
                  setShowTimeOffForm(true);
                }}
                className="px-4 py-2 rounded-lg gradient-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                + Add Time Off
              </button>
            </div>

            {/* Time off form (add/edit) */}
            {showTimeOffForm && (
              <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--background)] mb-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Title *</label>
                    <input
                      type="text"
                      value={timeOffForm.title}
                      onChange={(e) => setTimeOffForm({ ...timeOffForm, title: e.target.value })}
                      placeholder="e.g., Summer Vacation, Holiday, Lunch Break"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTimeOffForm({ ...timeOffForm, allDay: true })}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          timeOffForm.allDay
                            ? 'bg-[var(--primary)] text-white'
                            : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted)]'
                        }`}
                      >
                        Full Day(s)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimeOffForm({ ...timeOffForm, allDay: false })}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          !timeOffForm.allDay
                            ? 'bg-[var(--primary)] text-white'
                            : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted)]'
                        }`}
                      >
                        Specific Hours
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">{timeOffForm.allDay ? 'Start Date *' : 'Date *'}</label>
                    <input
                      type="date"
                      value={timeOffForm.startDate}
                      onChange={(e) => setTimeOffForm({ ...timeOffForm, startDate: e.target.value, ...(timeOffForm.allDay ? {} : { endDate: e.target.value }) })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none text-sm"
                    />
                  </div>
                  {timeOffForm.allDay ? (
                    <div>
                      <label className="block text-sm font-medium mb-1">End Date *</label>
                      <input
                        type="date"
                        value={timeOffForm.endDate}
                        min={timeOffForm.startDate}
                        onChange={(e) => setTimeOffForm({ ...timeOffForm, endDate: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none text-sm"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium mb-1">From *</label>
                        <input
                          type="time"
                          value={timeOffForm.startTime}
                          onChange={(e) => setTimeOffForm({ ...timeOffForm, startTime: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">To *</label>
                        <input
                          type="time"
                          value={timeOffForm.endTime}
                          onChange={(e) => setTimeOffForm({ ...timeOffForm, endTime: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Reason / Notes (optional)</label>
                  <input
                    type="text"
                    value={timeOffForm.reason}
                    onChange={(e) => setTimeOffForm({ ...timeOffForm, reason: e.target.value })}
                    placeholder="e.g., Family trip, Public holiday, Doctor appointment"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none text-sm"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setShowTimeOffForm(false); setEditingTimeOff(null); }}
                    className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!timeOffForm.title || !timeOffForm.startDate) return;
                      setTimeOffSaving(true);
                      try {
                        let startDate: string;
                        let endDate: string;
                        if (timeOffForm.allDay) {
                          // For all-day: start at 00:00, end at 23:59:59 of last day
                          startDate = new Date(timeOffForm.startDate + 'T00:00:00').toISOString();
                          endDate = new Date(timeOffForm.endDate + 'T23:59:59').toISOString();
                        } else {
                          // For specific hours on a single date
                          startDate = new Date(timeOffForm.startDate + 'T' + timeOffForm.startTime + ':00').toISOString();
                          endDate = new Date(timeOffForm.startDate + 'T' + timeOffForm.endTime + ':00').toISOString();
                        }

                        const payload = {
                          title: timeOffForm.title,
                          reason: timeOffForm.reason,
                          allDay: timeOffForm.allDay,
                          startDate,
                          endDate,
                        };

                        if (editingTimeOff) {
                          const res = await fetch(`/api/time-off/${editingTimeOff.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                          });
                          const data = await res.json();
                          if (data.success) {
                            setTimeOffs(timeOffs.map(t => t.id === editingTimeOff.id ? {
                              ...t, ...payload, startDate, endDate,
                            } : t));
                          }
                        } else {
                          const res = await fetch('/api/time-off', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                          });
                          const data = await res.json();
                          if (data.success && data.timeOff) {
                            setTimeOffs([...timeOffs, {
                              id: data.timeOff.id,
                              title: data.timeOff.title,
                              reason: data.timeOff.reason || '',
                              allDay: data.timeOff.allDay,
                              startDate: data.timeOff.startDate,
                              endDate: data.timeOff.endDate,
                            }]);
                          }
                        }
                        setShowTimeOffForm(false);
                        setEditingTimeOff(null);
                      } catch {
                        alert('Failed to save time off entry');
                      } finally {
                        setTimeOffSaving(false);
                      }
                    }}
                    disabled={timeOffSaving || !timeOffForm.title || !timeOffForm.startDate}
                    className="px-4 py-2 rounded-lg gradient-primary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {timeOffSaving ? 'Saving...' : editingTimeOff ? 'Update' : 'Add Time Off'}
                  </button>
                </div>
              </div>
            )}

            {/* Time off list */}
            {timeOffs.length === 0 && !showTimeOffForm ? (
              <div className="text-center py-10 text-[var(--muted)]">
                <div className="text-4xl mb-3">🏖️</div>
                <p className="text-sm">No time off scheduled. Add vacations, holidays, or blocked periods.</p>
                <p className="text-xs mt-1">
                  The AI bot will automatically avoid creating appointments during these times.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {timeOffs
                  .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                  .map((entry) => {
                    const start = new Date(entry.startDate);
                    const end = new Date(entry.endDate);
                    const isPast = end < new Date();
                    const isActive = start <= new Date() && end >= new Date();

                    let dateDisplay: string;
                    if (entry.allDay) {
                      const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      dateDisplay = start.toDateString() === end.toDateString() ? startStr : `${startStr} — ${endStr}`;
                    } else {
                      const dateStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      const startTimeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                      const endTimeStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                      dateDisplay = `${dateStr}, ${startTimeStr} - ${endTimeStr}`;
                    }

                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                          isPast
                            ? 'border-[var(--border)] opacity-40'
                            : isActive
                              ? 'border-amber-500/50 bg-amber-500/5'
                              : 'border-[var(--border)] hover:bg-[var(--background)]'
                        }`}
                      >
                        <div className="text-lg shrink-0">
                          {entry.allDay ? '📅' : '⏰'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm flex items-center gap-2">
                            {entry.title}
                            {isActive && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">Active Now</span>
                            )}
                            {isPast && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-[var(--muted)]">Past</span>
                            )}
                          </div>
                          <div className="text-xs text-[var(--muted)]">{dateDisplay}</div>
                          {entry.reason && (
                            <div className="text-xs text-[var(--muted)] truncate mt-0.5">{entry.reason}</div>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingTimeOff(entry);
                              const startD = new Date(entry.startDate);
                              const endD = new Date(entry.endDate);
                              setTimeOffForm({
                                title: entry.title,
                                reason: entry.reason,
                                allDay: entry.allDay,
                                startDate: startD.toISOString().split('T')[0],
                                endDate: endD.toISOString().split('T')[0],
                                startTime: entry.allDay ? '09:00' : `${String(startD.getHours()).padStart(2, '0')}:${String(startD.getMinutes()).padStart(2, '0')}`,
                                endTime: entry.allDay ? '17:00' : `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`,
                              });
                              setShowTimeOffForm(true);
                            }}
                            className="p-1.5 rounded-md hover:bg-[var(--card)] transition-colors text-[var(--muted)]"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete "${entry.title}"?`)) return;
                              try {
                                const res = await fetch(`/api/time-off/${entry.id}`, { method: 'DELETE' });
                                if (res.ok) {
                                  setTimeOffs(timeOffs.filter(t => t.id !== entry.id));
                                }
                              } catch {
                                alert('Failed to delete');
                              }
                            }}
                            className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors text-red-400"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="p-4 rounded-lg bg-[var(--card)] text-sm text-[var(--muted)]">
            <p className="font-medium text-[var(--foreground)] mb-1">💡 How it works</p>
            <p>
              Time off entries block the AI assistant from scheduling appointments. <strong>Full day</strong> entries block entire days 
              (great for vacations, holidays). <strong>Specific hours</strong> entries block part of a day (great for lunch breaks, 
              personal appointments). The bot will tell customers those times are unavailable and suggest alternative dates.
            </p>
          </div>
        </div>
      )}

      {/* Google Calendar Tab */}
      {activeTab === 'calendar' && (
        <div className="card p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-lg mb-1">Google Calendar Integration</h3>
            <p className="text-sm text-[var(--muted)]">
              Connect your Google Calendar so the AI assistant can check availability and book appointments automatically.
            </p>
          </div>

          {searchParams.get('google') === 'denied' && (
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 text-sm">
              ⚠️ Google Calendar access was denied. The assistant needs calendar permissions to manage appointments.
            </div>
          )}
          {searchParams.get('google') === 'error' && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              ❌ Something went wrong connecting Google Calendar. Please try again.
            </div>
          )}
          {searchParams.get('google') === 'connected' && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 text-sm">
              ✅ Google Calendar connected successfully! The assistant can now manage your appointments.
            </div>
          )}

          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--background)]">
            {googleConnected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <span className="text-green-500 text-lg">✓</span>
                  </div>
                  <div>
                    <p className="font-medium">Google Calendar Connected</p>
                    <p className="text-sm text-[var(--muted)]">
                      Your assistant can check availability and book appointments.
                    </p>
                  </div>
                </div>
                <button
                  onClick={disconnectGoogle}
                  disabled={disconnecting}
                  className="px-4 py-2 rounded-lg border border-red-300 text-red-500 text-sm hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--card)] flex items-center justify-center text-3xl">
                  📆
                </div>
                <h4 className="font-semibold mb-2">Connect Google Calendar</h4>
                <p className="text-sm text-[var(--muted)] mb-4 max-w-md mx-auto">
                  Allow the AI assistant to access your Google Calendar to check real-time availability and create/manage appointments.
                </p>
                <a
                  href="/api/auth/google"
                  className="inline-block px-6 py-2.5 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-opacity"
                >
                  Connect with Google
                </a>
              </div>
            )}
          </div>

          <div className="p-4 rounded-lg bg-[var(--card)] text-sm text-[var(--muted)] space-y-2">
            <p className="font-medium text-[var(--foreground)]">ℹ️ Setup Requirements</p>
            <ul className="list-disc list-inside space-y-1">
              <li>A Google Cloud project with Calendar API enabled</li>
              <li>OAuth 2.0 credentials (Client ID & Secret) in your <code className="text-xs bg-[var(--background)] px-1.5 py-0.5 rounded">.env</code> file</li>
              <li>Redirect URI set to: <code className="text-xs bg-[var(--background)] px-1.5 py-0.5 rounded">http://localhost:3005/api/auth/google/callback</code></li>
            </ul>
          </div>
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Timezone</label>
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/Bogota">Colombia (COT)</option>
              <option value="America/Mexico_City">Mexico City (CST)</option>
              <option value="America/Sao_Paulo">São Paulo (BRT)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Madrid">Madrid (CET)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Working Days</label>
            <div className="flex gap-2">
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`w-12 h-10 rounded-lg text-sm font-medium transition-colors ${
                    selectedDays.includes(day)
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--background)] text-[var(--muted)] border border-[var(--border)]'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Open Time</label>
              <input
                type="time"
                value={form.openTime}
                onChange={(e) => setForm({ ...form, openTime: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Close Time</label>
              <input
                type="time"
                value={form.closeTime}
                onChange={(e) => setForm({ ...form, closeTime: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Appointment Slot Duration</label>
            <select
              value={form.slotDuration}
              onChange={(e) => setForm({ ...form, slotDuration: parseInt(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>
        </div>
      )}

      {/* Notifications/Reminders Tab */}
      {activeTab === 'notifications' && (
        <div className="card p-6 space-y-6">
          <div>
            <h3 className="font-semibold mb-1">Appointment Reminders</h3>
            <p className="text-xs text-[var(--muted)] mb-4">
              Configure automatic reminders sent to customers before their appointments.
            </p>
          </div>

          {/* Reminder Lead Times */}
          <div>
            <label className="block text-sm font-medium mb-2">Reminder Timing</label>
            <p className="text-xs text-[var(--muted)] mb-3">
              Select when reminders should be sent before appointments. Multiple selections create multiple reminders.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {REMINDER_LEAD_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    form.reminderLeadMinutes.includes(option.value)
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                      : 'border-[var(--border)] hover:border-[var(--muted)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.reminderLeadMinutes.includes(option.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm({ ...form, reminderLeadMinutes: [...form.reminderLeadMinutes, option.value].sort((a, b) => a - b) });
                      } else {
                        setForm({ ...form, reminderLeadMinutes: form.reminderLeadMinutes.filter((m) => m !== option.value) });
                      }
                    }}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                    form.reminderLeadMinutes.includes(option.value)
                      ? 'border-[var(--primary)] bg-[var(--primary)]'
                      : 'border-[var(--border)]'
                  }`}>
                    {form.reminderLeadMinutes.includes(option.value) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Reminder Channels */}
          <div>
            <label className="block text-sm font-medium mb-2">Reminder Channels</label>
            <p className="text-xs text-[var(--muted)] mb-3">
              Choose how reminders are delivered. Email requires SendGrid configuration below.
            </p>
            <div className="flex gap-3">
              {REMINDER_CHANNELS.map((channel) => (
                <label
                  key={channel.value}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                    form.reminderChannels.includes(channel.value)
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                      : 'border-[var(--border)] hover:border-[var(--muted)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.reminderChannels.includes(channel.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm({ ...form, reminderChannels: [...form.reminderChannels, channel.value] });
                      } else {
                        setForm({ ...form, reminderChannels: form.reminderChannels.filter((c) => c !== channel.value) });
                      }
                    }}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                    form.reminderChannels.includes(channel.value)
                      ? 'border-[var(--primary)] bg-[var(--primary)]'
                      : 'border-[var(--border)]'
                  }`}>
                    {form.reminderChannels.includes(channel.value) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-lg">{channel.icon}</span>
                  <span className="text-sm font-medium">{channel.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Quiet Hours */}
          <div>
            <label className="block text-sm font-medium mb-2">Quiet Hours</label>
            <p className="text-xs text-[var(--muted)] mb-3">
              Reminders scheduled during quiet hours will be delayed until the end time.
            </p>
            <div className="flex items-center gap-3">
              <div>
                <label className="text-xs text-[var(--muted)]">Start</label>
                <input
                  type="time"
                  value={form.quietHoursStart}
                  onChange={(e) => setForm({ ...form, quietHoursStart: e.target.value })}
                  className="block mt-1 px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>
              <span className="mt-5">to</span>
              <div>
                <label className="text-xs text-[var(--muted)]">End</label>
                <input
                  type="time"
                  value={form.quietHoursEnd}
                  onChange={(e) => setForm({ ...form, quietHoursEnd: e.target.value })}
                  className="block mt-1 px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>
              {form.quietHoursStart && form.quietHoursEnd && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, quietHoursStart: '', quietHoursEnd: '' })}
                  className="mt-5 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Email Configuration (SendGrid) */}
          {form.reminderChannels.includes('EMAIL') && (
            <div className="border-t border-[var(--border)] pt-6 mt-6">
              <h4 className="font-medium mb-1">Email Configuration (SendGrid)</h4>
              <p className="text-xs text-[var(--muted)] mb-4">
                Configure SendGrid to enable email reminders. Get your API key from{' '}
                <a href="https://sendgrid.com" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">
                  sendgrid.com
                </a>
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email Provider</label>
                  <select
                    value={form.emailProvider}
                    onChange={(e) => setForm({ ...form, emailProvider: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                  >
                    <option value="">Select provider</option>
                    <option value="sendgrid">SendGrid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">From Address</label>
                  <input
                    type="email"
                    value={form.emailFromAddress}
                    onChange={(e) => setForm({ ...form, emailFromAddress: e.target.value })}
                    placeholder="reminders@yourbusiness.com"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">API Key</label>
                  <input
                    type="password"
                    value={form.emailApiKey}
                    onChange={(e) => setForm({ ...form, emailApiKey: e.target.value })}
                    placeholder="SG.xxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none font-mono"
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Your API key is encrypted and stored securely.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          {(form.reminderLeadMinutes.length > 0 && form.reminderChannels.length > 0) && (
            <div className="bg-[var(--background)] p-4 rounded-lg border border-[var(--border)]">
              <p className="text-sm">
                <span className="font-medium">Active configuration:</span> Customers will receive{' '}
                <span className="font-medium">{form.reminderLeadMinutes.length} reminder(s)</span> via{' '}
                <span className="font-medium">{form.reminderChannels.map(c => c.toLowerCase()).join(' and ')}</span>.
              </p>
            </div>
          )}
        </div>
      )}

      {/* AI Prompt Tab */}
      {activeTab === 'ai' && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-semibold">AI System Prompt</h3>
              <p className="text-xs text-[var(--muted)]">
                This tells your AI assistant how to behave. Edit it directly or regenerate from your business info.
              </p>
            </div>
            <button
              onClick={regeneratePrompt}
              disabled={regenerating}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors disabled:opacity-50"
            >
              {regenerating ? '⏳ Generating...' : '🔄 Regenerate'}
            </button>
          </div>
          <textarea
            value={form.systemPrompt}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            rows={16}
            className="w-full px-4 py-3 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none resize-none font-mono text-sm leading-relaxed"
          />
          <p className="text-xs text-[var(--muted)]">
            Tip: Be specific about what your assistant should and shouldn&apos;t do. Include your services, policies, and common questions.
          </p>
        </div>
      )}

      <div className="mt-6">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
}
