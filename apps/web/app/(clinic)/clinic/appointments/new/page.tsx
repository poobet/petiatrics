'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@petiatrics/ui/button';
import { Input } from '@petiatrics/ui/input';
import { Label } from '@petiatrics/ui/label';

export default function NewAppointmentPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    patientId: '',
    ownerUserId: '',
    vetUserId: '',
    scheduledAt: '',
    scheduledTime: '',
    durationMinutes: '30',
    reason: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientId || !form.ownerUserId || !form.scheduledAt || !form.scheduledTime || !form.reason) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const scheduledAt = new Date(`${form.scheduledAt}T${form.scheduledTime}:00`);

    try {
      await apiClient.post('/appointments', {
        patientId: form.patientId,
        ownerUserId: form.ownerUserId,
        vetUserId: form.vetUserId || undefined,
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: parseInt(form.durationMinutes, 10),
        reason: form.reason,
      });
      router.push('/appointments');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to book appointment');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Appointment</h1>
        <p className="text-muted-foreground text-sm mt-1">Book a new clinic appointment</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-1.5">
          <Label htmlFor="patientId">Patient ID (MongoDB) *</Label>
          <Input
            id="patientId"
            value={form.patientId}
            onChange={(e) => setForm({ ...form, patientId: e.target.value })}
            placeholder="ObjectId of pet profile"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ownerUserId">Owner User ID *</Label>
          <Input
            id="ownerUserId"
            value={form.ownerUserId}
            onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vetUserId">Vet User ID</Label>
          <Input
            id="vetUserId"
            value={form.vetUserId}
            onChange={(e) => setForm({ ...form, vetUserId: e.target.value })}
            placeholder="UUID — leave blank for unassigned"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="scheduledAt">Date *</Label>
            <Input
              id="scheduledAt"
              type="date"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scheduledTime">Time *</Label>
            <Input
              id="scheduledTime"
              type="time"
              value={form.scheduledTime}
              onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="duration">Duration (minutes) *</Label>
          <Input
            id="duration"
            type="number"
            min="15"
            step="15"
            value={form.durationMinutes}
            onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason / Chief Complaint *</Label>
          <Input
            id="reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Annual checkup, vaccination, etc."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Booking…' : 'Book Appointment'}
          </Button>
        </div>
      </form>
    </div>
  );
}
