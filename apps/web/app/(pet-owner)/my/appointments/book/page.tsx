'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BookAppointmentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    date: '',
    time: '',
    durationMinutes: '30',
    reason: '',
  });

  function handleFieldChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString();
      const res = await fetch('/api/v1/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledAt,
          durationMinutes: Number(form.durationMinutes),
          reason: form.reason,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? 'Could not book appointment');
      }
      router.push('/my/appointments');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  const DURATIONS = [15, 30, 45, 60, 90];

  return (
    <div className="p-4 space-y-5">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">
        ← Cancel
      </button>

      <h1 className="text-xl font-bold">Book Appointment</h1>

      {/* Step Indicator */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex-1 h-1.5 rounded-full ${s <= step ? 'bg-blue-500' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1: Select Date */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">When would you like to visit?</p>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => handleFieldChange('date', e.target.value)}
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!form.date}
              className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

        {/* Step 2: Select Time & Duration */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">What time works for you?</p>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Preferred Time</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => handleFieldChange('time', e.target.value)}
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-2">Estimated Duration</label>
              <div className="flex gap-2 flex-wrap">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleFieldChange('durationMinutes', String(d))}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${form.durationMinutes === String(d) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:border-blue-400'}`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 border rounded-xl py-3 text-sm"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!form.time}
                className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Reason & Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">Tell us about the visit</p>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Reason for Visit</label>
              <textarea
                value={form.reason}
                onChange={(e) => handleFieldChange('reason', e.target.value)}
                rows={4}
                className="w-full border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Annual checkup, vaccination, not feeling well…"
                required
              />
            </div>

            {/* Summary */}
            <div className="bg-blue-50 rounded-xl p-4 text-sm space-y-1">
              <p className="font-semibold text-blue-700">Appointment Summary</p>
              <p className="text-gray-600">📅 {new Date(form.date).toLocaleDateString()} at {form.time}</p>
              <p className="text-gray-600">⏱ {form.durationMinutes} minutes</p>
              <p className="text-gray-600">📝 {form.reason || '—'}</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 border rounded-xl py-3 text-sm"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={saving || !form.reason}
                className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Booking…' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
