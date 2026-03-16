'use client';

import { useState } from 'react';

type RequestStatus = 'PENDING' | 'PROCESSING' | 'FULFILLED' | 'REJECTED' | 'CANCELLED';

interface PhoneRequest {
  id: string;
  tenantId: string;
  tenantName: string;
  userEmail: string;
  countryCode: string;
  preferredArea: string | null;
  purpose: string | null;
  status: RequestStatus;
  assignedNumber: string | null;
  adminNotes: string | null;
  requestedAt: string;
  processedAt?: string;
  fulfilledAt?: string;
}

interface Props {
  requests: PhoneRequest[];
}

const STATUS_COLORS: Record<RequestStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  FULFILLED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

const COUNTRY_FLAGS: Record<string, string> = {
  MX: '🇲🇽',
  US: '🇺🇸',
  ES: '🇪🇸',
  CO: '🇨🇴',
  AR: '🇦🇷',
  CL: '🇨🇱',
  PE: '🇵🇪',
};

export function PhoneRequestsClient({ requests }: Props) {
  const [selectedRequest, setSelectedRequest] = useState<PhoneRequest | null>(null);
  const [assignedNumber, setAssignedNumber] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<RequestStatus | 'ALL'>('ALL');

  const filteredRequests = filter === 'ALL' 
    ? requests 
    : requests.filter(r => r.status === filter);

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

  async function updateRequest(id: string, status: RequestStatus, number?: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/phone-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status, 
          assignedNumber: number || null,
          adminNotes: adminNotes || null,
        }),
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

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {(['PENDING', 'PROCESSING', 'FULFILLED', 'REJECTED', 'CANCELLED'] as RequestStatus[]).map(status => {
          const count = requests.filter(r => r.status === status).length;
          return (
            <button
              key={status}
              onClick={() => setFilter(filter === status ? 'ALL' : status)}
              className={`p-4 rounded-lg border transition-all ${
                filter === status ? 'border-[var(--primary)] shadow-md' : 'border-[var(--border)]'
              }`}
            >
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs text-[var(--muted)]">{status}</div>
            </button>
          );
        })}
      </div>

      {pendingCount > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center gap-2">
          <span className="text-yellow-600">⚠️</span>
          <span className="text-sm text-yellow-800">
            <strong>{pendingCount}</strong> request{pendingCount > 1 ? 's' : ''} waiting for review
          </span>
        </div>
      )}

      {/* Requests Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-[var(--background)]">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium">Tenant</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Country</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Number</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Requested</th>
              <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map(request => (
              <tr key={request.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">
                  <div className="font-medium">{request.tenantName}</div>
                  <div className="text-xs text-[var(--muted)]">{request.userEmail}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-lg">{COUNTRY_FLAGS[request.countryCode] || '🌐'}</span>
                  <span className="ml-1 text-sm">{request.countryCode}</span>
                  {request.preferredArea && (
                    <span className="text-xs text-[var(--muted)]"> ({request.preferredArea})</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[request.status]}`}>
                    {request.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-sm">
                  {request.assignedNumber || '—'}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">
                  {new Date(request.requestedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      setSelectedRequest(request);
                      setAssignedNumber(request.assignedNumber || '');
                      setAdminNotes(request.adminNotes || '');
                    }}
                    className="text-sm text-[var(--accent)] hover:underline"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
            {filteredRequests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  No requests found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Management Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-semibold">Manage Request</h2>
              <button 
                onClick={() => setSelectedRequest(null)}
                className="text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-[var(--background)]">
                <div>
                  <div className="text-xs text-[var(--muted)]">Tenant</div>
                  <div className="font-medium">{selectedRequest.tenantName}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted)]">Email</div>
                  <div className="text-sm">{selectedRequest.userEmail}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted)]">Country</div>
                  <div>{COUNTRY_FLAGS[selectedRequest.countryCode]} {selectedRequest.countryCode}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted)]">Area Preference</div>
                  <div>{selectedRequest.preferredArea || 'None'}</div>
                </div>
              </div>

              {selectedRequest.purpose && (
                <div>
                  <div className="text-xs text-[var(--muted)] mb-1">Purpose</div>
                  <p className="text-sm p-3 rounded bg-[var(--background)]">{selectedRequest.purpose}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5">Assigned Phone Number</label>
                <input
                  type="tel"
                  value={assignedNumber}
                  onChange={(e) => setAssignedNumber(e.target.value)}
                  placeholder="+523312345678"
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Internal notes..."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-2 pt-4">
                {selectedRequest.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => updateRequest(selectedRequest.id, 'PROCESSING')}
                      disabled={saving}
                      className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      Start Processing
                    </button>
                    <button
                      onClick={() => updateRequest(selectedRequest.id, 'REJECTED')}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg border border-red-300 text-red-600 font-medium hover:bg-red-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}

                {selectedRequest.status === 'PROCESSING' && (
                  <button
                    onClick={() => updateRequest(selectedRequest.id, 'FULFILLED', assignedNumber)}
                    disabled={saving || !assignedNumber}
                    className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    Mark as Fulfilled
                  </button>
                )}

                {['PENDING', 'PROCESSING'].includes(selectedRequest.status) && (
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="px-4 py-2 rounded-lg border border-[var(--border)] font-medium hover:bg-[var(--background)]"
                  >
                    Cancel
                  </button>
                )}

                {['FULFILLED', 'REJECTED', 'CANCELLED'].includes(selectedRequest.status) && (
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="w-full px-4 py-2 rounded-lg border border-[var(--border)] font-medium hover:bg-[var(--background)]"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
