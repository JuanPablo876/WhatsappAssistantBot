'use client';

import { useState } from 'react';
import dayjs from 'dayjs';

type Appointment = {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  status: string;
  calendarEventId: string | null;
  contact: {
    id: string;
    name: string | null;
    phone: string;
  };
  serviceType?: {
    id: string;
    name: string;
  } | null;
};

type ServiceType = {
  id: string;
  name: string;
  duration: number;
};

interface Props {
  appointments: Appointment[];
  serviceTypes: ServiceType[];
}

export function AppointmentsClient({ appointments: initialAppointments, serviceTypes }: Props) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const upcoming = appointments.filter(
    (a) => a.status !== 'CANCELLED' && new Date(a.startTime) >= new Date()
  );
  const past = appointments.filter(
    (a) => a.status === 'CANCELLED' || new Date(a.startTime) < new Date()
  );

  function statusColor(status: string) {
    switch (status) {
      case 'CONFIRMED': return 'bg-green-500/20 text-green-400';
      case 'PENDING': return 'bg-yellow-500/20 text-yellow-400';
      case 'CANCELLED': return 'bg-red-500/20 text-red-400';
      case 'COMPLETED': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-[var(--border)] text-[var(--muted)]';
    }
  }

  async function updateStatus(id: string, status: string) {
    setLoading(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAppointments(appointments.map(a => a.id === id ? { ...a, ...updated } : a));
      }
    } catch (error) {
      console.error('Failed to update appointment:', error);
    }
    setLoading(null);
  }

  async function saveEdit() {
    if (!editingApt) return;
    setLoading(editingApt.id);
    try {
      const res = await fetch(`/api/appointments/${editingApt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingApt.title,
          description: editingApt.description,
          startTime: editingApt.startTime,
          endTime: editingApt.endTime,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAppointments(appointments.map(a => a.id === editingApt.id ? { ...a, ...updated } : a));
        setEditingApt(null);
      }
    } catch (error) {
      console.error('Failed to save appointment:', error);
    }
    setLoading(null);
  }

  async function deleteAppointment(id: string) {
    if (!confirm('Are you sure you want to delete this appointment?')) return;
    setLoading(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAppointments(appointments.filter(a => a.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete appointment:', error);
    }
    setLoading(null);
  }

  function AppointmentRow({ apt }: { apt: Appointment }) {
    const isLoading = loading === apt.id;
    const isPast = new Date(apt.startTime) < new Date();
    const isCancelled = apt.status === 'CANCELLED';

    return (
      <div className="card p-4">
        <div className="flex items-center gap-4">
          {/* Date box */}
          <div className="w-14 h-14 rounded-lg bg-[var(--primary-light)] flex flex-col items-center justify-center shrink-0">
            <span className="text-xs text-[var(--primary)] font-medium">
              {dayjs(apt.startTime).format('MMM')}
            </span>
            <span className="text-lg font-bold text-[var(--primary)] -mt-0.5">
              {dayjs(apt.startTime).format('DD')}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{apt.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColor(apt.status)}`}>
                {apt.status}
              </span>
              {apt.serviceType && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)]">
                  {apt.serviceType.name}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {apt.contact.name || apt.contact.phone} · {dayjs(apt.startTime).format('h:mm A')} – {dayjs(apt.endTime).format('h:mm A')}
            </p>
            {apt.description && (
              <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{apt.description}</p>
            )}
          </div>

          {/* Calendar icon */}
          {apt.calendarEventId && (
            <div className="text-xs text-[var(--muted)] shrink-0" title="Synced to Google Calendar">
              📅
            </div>
          )}
        </div>

        {/* Actions */}
        {!isPast && !isCancelled && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
            {apt.status === 'PENDING' && (
              <button
                onClick={() => updateStatus(apt.id, 'CONFIRMED')}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50"
              >
                ✓ Confirm
              </button>
            )}
            {apt.status === 'CONFIRMED' && (
              <button
                onClick={() => updateStatus(apt.id, 'COMPLETED')}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
              >
                ✓ Complete
              </button>
            )}
            <button
              onClick={() => setEditingApt(apt)}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--border)] hover:bg-[var(--border-hover)] disabled:opacity-50"
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => updateStatus(apt.id, 'CANCELLED')}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
            >
              ✕ Cancel
            </button>
            <button
              onClick={() => deleteAppointment(apt.id)}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-[var(--muted)] hover:text-red-400 disabled:opacity-50 ml-auto"
            >
              🗑️
            </button>
          </div>
        )}

        {/* Past/cancelled actions */}
        {(isPast || isCancelled) && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
            {isCancelled && !isPast && (
              <button
                onClick={() => updateStatus(apt.id, 'PENDING')}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-50"
              >
                ↩️ Restore
              </button>
            )}
            <button
              onClick={() => deleteAppointment(apt.id)}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-[var(--muted)] hover:text-red-400 disabled:opacity-50 ml-auto"
            >
              🗑️ Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {appointments.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="font-semibold mb-1">No appointments yet</h3>
          <p className="text-sm text-[var(--muted)]">
            When clients book through your WhatsApp bot, appointments will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                Upcoming ({upcoming.length})
              </h2>
              <div className="space-y-2">
                {upcoming.map((apt) => (
                  <AppointmentRow key={apt.id} apt={apt} />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                Past / Cancelled ({past.length})
              </h2>
              <div className="space-y-2 opacity-60">
                {past.map((apt) => (
                  <AppointmentRow key={apt.id} apt={apt} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingApt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="font-semibold text-lg mb-4">Edit Appointment</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={editingApt.title}
                  onChange={(e) => setEditingApt({ ...editingApt, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={editingApt.description || ''}
                  onChange={(e) => setEditingApt({ ...editingApt, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={dayjs(editingApt.startTime).format('YYYY-MM-DDTHH:mm')}
                    onChange={(e) => setEditingApt({ ...editingApt, startTime: new Date(e.target.value).toISOString() })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={dayjs(editingApt.endTime).format('YYYY-MM-DDTHH:mm')}
                    onChange={(e) => setEditingApt({ ...editingApt, endTime: new Date(e.target.value).toISOString() })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] focus:border-[var(--primary)] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Client</label>
                <div className="px-3 py-2 rounded-lg bg-[var(--border)] text-sm">
                  {editingApt.contact.name || editingApt.contact.phone}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditingApt(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-[var(--border)]"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={loading === editingApt.id}
                className="px-4 py-2 text-sm font-medium rounded-lg gradient-primary text-white disabled:opacity-50"
              >
                {loading === editingApt.id ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
