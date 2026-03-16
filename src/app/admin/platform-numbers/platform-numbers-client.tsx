'use client';

import { useState } from 'react';

type NumberStatus = 'AVAILABLE' | 'ASSIGNED' | 'SUSPENDED' | 'RELEASING';

interface PlatformNumber {
  id: string;
  phoneNumber: string;
  twilioSid: string;
  countryCode: string;
  areaCode: string | null;
  friendlyName: string | null;
  tenantId: string | null;
  tenantName: string | null;
  assignedAt: string | null;
  voiceEnabled: boolean;
  smsEnabled: boolean;
  monthlyPrice: number;
  twilioCost: number;
  status: NumberStatus;
  createdAt: string;
}

interface Tenant {
  id: string;
  name: string;
}

interface Props {
  numbers: PlatformNumber[];
  tenants: Tenant[];
}

const STATUS_COLORS: Record<NumberStatus, string> = {
  AVAILABLE: 'bg-green-100 text-green-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  SUSPENDED: 'bg-yellow-100 text-yellow-800',
  RELEASING: 'bg-red-100 text-red-800',
};

const COUNTRY_FLAGS: Record<string, string> = {
  MX: '🇲🇽',
  US: '🇺🇸',
  ES: '🇪🇸',
  CO: '🇨🇴',
  AR: '🇦🇷',
  CL: '🇨🇱',
  PE: '🇵🇪',
  CA: '🇨🇦',
  GB: '🇬🇧',
};

export function PlatformNumbersClient({ numbers, tenants }: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<PlatformNumber | null>(null);
  const [filter, setFilter] = useState<NumberStatus | 'ALL'>('ALL');
  const [saving, setSaving] = useState(false);

  // Test call state
  const [showTestCallModal, setShowTestCallModal] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testCallStatus, setTestCallStatus] = useState<'idle' | 'calling' | 'success' | 'error'>('idle');
  const [testCallMessage, setTestCallMessage] = useState('');

  // Add form state
  const [newNumber, setNewNumber] = useState({
    phoneNumber: '',
    twilioSid: '',
    countryCode: 'MX',
    areaCode: '',
    friendlyName: '',
    monthlyPrice: '',
    twilioCost: '',
  });

  // Assignment state
  const [assignToTenant, setAssignToTenant] = useState('');

  const filteredNumbers = filter === 'ALL' 
    ? numbers 
    : numbers.filter(n => n.status === filter);

  const stats = {
    total: numbers.length,
    available: numbers.filter(n => n.status === 'AVAILABLE').length,
    assigned: numbers.filter(n => n.status === 'ASSIGNED').length,
    revenue: numbers.filter(n => n.status === 'ASSIGNED').reduce((sum, n) => sum + n.monthlyPrice, 0),
  };

  async function addNumber() {
    if (!newNumber.phoneNumber || !newNumber.twilioSid) {
      alert('Phone number and Twilio SID are required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/platform-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: newNumber.phoneNumber,
          twilioSid: newNumber.twilioSid,
          countryCode: newNumber.countryCode,
          areaCode: newNumber.areaCode || null,
          friendlyName: newNumber.friendlyName || null,
          monthlyPrice: newNumber.monthlyPrice ? parseFloat(newNumber.monthlyPrice) : 0,
          twilioCost: newNumber.twilioCost ? parseFloat(newNumber.twilioCost) : 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        window.location.reload();
      } else {
        alert(data.error || 'Failed to add number');
      }
    } catch {
      alert('Failed to add number');
    } finally {
      setSaving(false);
    }
  }

  async function assignNumber(numberId: string, tenantId: string | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/platform-numbers/${numberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (data.success) {
        window.location.reload();
      } else {
        alert(data.error || 'Failed to update');
      }
    } catch {
      alert('Failed to update');
    } finally {
      setSaving(false);
    }
  }

  async function deleteNumber(numberId: string) {
    if (!confirm('Are you sure you want to delete this number? This cannot be undone.')) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/platform-numbers/${numberId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        window.location.reload();
      } else {
        alert(data.error || 'Failed to delete');
      }
    } catch {
      alert('Failed to delete');
    } finally {
      setSaving(false);
    }
  }

  async function makeTestCall(numberId: string) {
    if (!testPhoneNumber) {
      setTestCallMessage('Please enter a phone number to call');
      setTestCallStatus('error');
      return;
    }

    setTestCallStatus('calling');
    setTestCallMessage('Placing test call...');

    try {
      const res = await fetch(`/api/admin/platform-numbers/${numberId}/test-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testPhoneNumber }),
      });
      const data = await res.json();

      if (data.success) {
        setTestCallStatus('success');
        setTestCallMessage(`Call initiated! Check your phone. Call SID: ${data.callSid}`);
      } else {
        setTestCallStatus('error');
        setTestCallMessage(data.error || 'Failed to place call');
      }
    } catch {
      setTestCallStatus('error');
      setTestCallMessage('Failed to place test call. Check your connection.');
    }
  }

  function openTestCallModal(number: PlatformNumber) {
    setSelectedNumber(number);
    setTestPhoneNumber('');
    setTestCallStatus('idle');
    setTestCallMessage('');
    setShowTestCallModal(true);
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-lg border border-[var(--border)] bg-white">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-[var(--muted)]">Total Numbers</div>
        </div>
        <div className="p-4 rounded-lg border border-[var(--border)] bg-white">
          <div className="text-2xl font-bold text-green-600">{stats.available}</div>
          <div className="text-sm text-[var(--muted)]">Available</div>
        </div>
        <div className="p-4 rounded-lg border border-[var(--border)] bg-white">
          <div className="text-2xl font-bold text-blue-600">{stats.assigned}</div>
          <div className="text-sm text-[var(--muted)]">Assigned</div>
        </div>
        <div className="p-4 rounded-lg border border-[var(--border)] bg-white">
          <div className="text-2xl font-bold">${stats.revenue.toFixed(2)}</div>
          <div className="text-sm text-[var(--muted)]">Monthly Revenue</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          {(['ALL', 'AVAILABLE', 'ASSIGNED', 'SUSPENDED'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === status 
                  ? 'bg-[var(--primary)] text-white' 
                  : 'bg-[var(--background)] hover:bg-[var(--border)]'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90"
        >
          + Add Number
        </button>
      </div>

      {/* Numbers Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-[var(--background)]">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium">Phone Number</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Country</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Assigned To</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Price</th>
              <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredNumbers.map(number => (
              <tr key={number.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">
                  <div className="font-mono font-medium">{number.phoneNumber}</div>
                  <div className="text-xs text-[var(--muted)]">{number.twilioSid}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-lg">{COUNTRY_FLAGS[number.countryCode] || '🌐'}</span>
                  <span className="ml-1 text-sm">{number.countryCode}</span>
                  {number.areaCode && (
                    <span className="text-xs text-[var(--muted)]"> ({number.areaCode})</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[number.status]}`}>
                    {number.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {number.tenantName ? (
                    <div>
                      <div className="font-medium">{number.tenantName}</div>
                      <div className="text-xs text-[var(--muted)]">
                        Since {new Date(number.assignedAt!).toLocaleDateString()}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">${number.monthlyPrice.toFixed(2)}</div>
                  <div className="text-xs text-[var(--muted)]">Cost: ${number.twilioCost.toFixed(2)}</div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openTestCallModal(number)}
                    className="text-sm text-green-600 hover:underline mr-3"
                    title="Test this number with a phone call"
                  >
                    📞 Test
                  </button>
                  <button
                    onClick={() => {
                      setSelectedNumber(number);
                      setAssignToTenant(number.tenantId || '');
                    }}
                    className="text-sm text-[var(--accent)] hover:underline"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
            {filteredNumbers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  No numbers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Number Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-semibold">Add Platform Number</h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-[var(--muted)] mb-4">
              Add a phone number that was already purchased from Twilio Console.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={newNumber.phoneNumber}
                  onChange={(e) => setNewNumber({ ...newNumber, phoneNumber: e.target.value })}
                  placeholder="+523312345678"
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Twilio SID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newNumber.twilioSid}
                  onChange={(e) => setNewNumber({ ...newNumber, twilioSid: e.target.value })}
                  placeholder="PN..."
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Country</label>
                  <select
                    value={newNumber.countryCode}
                    onChange={(e) => setNewNumber({ ...newNumber, countryCode: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                  >
                    <option value="MX">🇲🇽 Mexico</option>
                    <option value="US">🇺🇸 United States</option>
                    <option value="CA">🇨🇦 Canada</option>
                    <option value="ES">🇪🇸 Spain</option>
                    <option value="CO">🇨🇴 Colombia</option>
                    <option value="AR">🇦🇷 Argentina</option>
                    <option value="CL">🇨🇱 Chile</option>
                    <option value="PE">🇵🇪 Peru</option>
                    <option value="GB">🇬🇧 UK</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Area Code</label>
                  <input
                    type="text"
                    value={newNumber.areaCode}
                    onChange={(e) => setNewNumber({ ...newNumber, areaCode: e.target.value })}
                    placeholder="33"
                    className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Friendly Name</label>
                <input
                  type="text"
                  value={newNumber.friendlyName}
                  onChange={(e) => setNewNumber({ ...newNumber, friendlyName: e.target.value })}
                  placeholder="Guadalajara Main Line"
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Monthly Price (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newNumber.monthlyPrice}
                    onChange={(e) => setNewNumber({ ...newNumber, monthlyPrice: e.target.value })}
                    placeholder="5.00"
                    className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">What we charge client</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Twilio Cost (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newNumber.twilioCost}
                    onChange={(e) => setNewNumber({ ...newNumber, twilioCost: e.target.value })}
                    placeholder="1.15"
                    className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">What Twilio charges us</p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={addNumber}
                  disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Adding...' : 'Add Number'}
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] font-medium hover:bg-[var(--background)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Number Modal */}
      {selectedNumber && !showTestCallModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-semibold">Manage Number</h2>
              <button 
                onClick={() => setSelectedNumber(null)}
                className="text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[var(--background)]">
                <div className="font-mono text-lg font-medium">{selectedNumber.phoneNumber}</div>
                <div className="text-sm text-[var(--muted)]">{selectedNumber.twilioSid}</div>
                <div className="flex gap-4 mt-2 text-sm">
                  <span>{COUNTRY_FLAGS[selectedNumber.countryCode]} {selectedNumber.countryCode}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedNumber.status]}`}>
                    {selectedNumber.status}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Assign to Tenant</label>
                <select
                  value={assignToTenant}
                  onChange={(e) => setAssignToTenant(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                >
                  <option value="">— Not assigned —</option>
                  {tenants.map(tenant => (
                    <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                  ))}
                </select>
              </div>

              {selectedNumber.tenantId && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                  Currently assigned to <strong>{selectedNumber.tenantName}</strong> since{' '}
                  {new Date(selectedNumber.assignedAt!).toLocaleDateString()}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => assignNumber(selectedNumber.id, assignToTenant || null)}
                  disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Assignment'}
                </button>
                <button
                  onClick={() => openTestCallModal(selectedNumber)}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700"
                  title="Test this number with a phone call"
                >
                  📞 Test
                </button>
                <button
                  onClick={() => deleteNumber(selectedNumber.id)}
                  disabled={saving || selectedNumber.status === 'ASSIGNED'}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
                  title={selectedNumber.status === 'ASSIGNED' ? 'Unassign first' : 'Delete number'}
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedNumber(null)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] font-medium hover:bg-[var(--background)]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Call Modal */}
      {showTestCallModal && selectedNumber && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-semibold">Test Phone Call</h2>
              <button 
                onClick={() => {
                  setShowTestCallModal(false);
                  setSelectedNumber(null);
                }}
                className="text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[var(--background)]">
                <div className="text-sm text-[var(--muted)] mb-1">Calling from:</div>
                <div className="font-mono text-lg font-medium">{selectedNumber.phoneNumber}</div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Call this number to test <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  placeholder="+523312345678"
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none font-mono"
                  disabled={testCallStatus === 'calling'}
                />
                <p className="text-xs text-[var(--muted)] mt-1">
                  Enter your phone number to receive a test call
                </p>
              </div>

              {testCallMessage && (
                <div className={`p-3 rounded-lg text-sm ${
                  testCallStatus === 'success' 
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : testCallStatus === 'error'
                    ? 'bg-red-50 border border-red-200 text-red-800'
                    : 'bg-blue-50 border border-blue-200 text-blue-800'
                }`}>
                  {testCallStatus === 'calling' && '📞 '}
                  {testCallStatus === 'success' && '✓ '}
                  {testCallStatus === 'error' && '✕ '}
                  {testCallMessage}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => makeTestCall(selectedNumber.id)}
                  disabled={testCallStatus === 'calling'}
                  className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {testCallStatus === 'calling' ? 'Calling...' : '📞 Place Test Call'}
                </button>
                <button
                  onClick={() => {
                    setShowTestCallModal(false);
                    setSelectedNumber(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] font-medium hover:bg-[var(--background)]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
