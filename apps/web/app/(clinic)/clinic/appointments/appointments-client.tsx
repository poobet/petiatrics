'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient, ApiError } from '@/lib/api-client';
import { Badge } from '@petiatrics/ui/badge';
import { Button } from '@petiatrics/ui/button';

interface Appointment {
  id: string;
  code?: string | null;
  patientId: string;
  ownerUserId: string;
  vetUserId?: string;
  scheduledAt: string;
  durationMinutes: number;
  reason: string;
  status: 'REQUESTED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  cancellationReason?: string;
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  REQUESTED: 'secondary',
  CONFIRMED: 'default',
  IN_PROGRESS: 'default',
  COMPLETED: 'outline',
  CANCELLED: 'destructive',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getWeekDays(anchor: Date): Date[] {
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function AppointmentsClient() {
  const [anchor, setAnchor] = useState(() => new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekDays = getWeekDays(anchor);

  const loadDay = async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<Appointment[]>(`/appointments?date=${date}`);
      setAppointments(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const [selectedDate, setSelectedDate] = useState<string>(() => formatDate(new Date()));

  useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate]);

  const prevWeek = () => {
    const d = new Date(anchor);
    d.setDate(d.getDate() - 7);
    setAnchor(d);
  };

  const nextWeek = () => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + 7);
    setAnchor(d);
  };

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-4">
      {/* Week navigator */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={prevWeek}>← Prev</Button>
        <div className="flex gap-1">
          {weekDays.map((day, i) => {
            const iso = formatDate(day);
            const isSelected = iso === selectedDate;
            const isToday = iso === formatDate(new Date());
            return (
              <button
                key={iso}
                onClick={() => setSelectedDate(iso)}
                className={[
                  'flex flex-col items-center px-3 py-2 rounded-lg text-sm transition-colors',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted',
                  isToday && !isSelected
                    ? 'border border-primary'
                    : '',
                ].join(' ')}
              >
                <span className="text-xs font-medium">{DAY_NAMES[i]}</span>
                <span className="text-base font-semibold">{day.getDate()}</span>
              </button>
            );
          })}
        </div>
        <Button variant="outline" size="sm" onClick={nextWeek}>Next →</Button>
      </div>

      {/* Quick action */}
      <div className="flex justify-end">
        <Link href="/clinic/appointments/new">
          <Button>+ New Appointment</Button>
        </Link>
      </div>

      {/* Day view */}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : appointments.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No appointments for {selectedDate}.
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map((appt) => (
            <div
              key={appt.id}
              className="rounded-lg border p-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="text-sm tabular-nums text-muted-foreground w-14">
                  {formatTime(appt.scheduledAt)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {appt.code && (
                      <Badge variant="outline" className="font-mono text-xs text-blue-600 bg-blue-50 border-blue-200">
                        {appt.code}
                      </Badge>
                    )}
                    <p className="font-medium text-sm">{appt.reason}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {appt.durationMinutes} min
                    {appt.vetUserId ? ` · Vet: ${appt.vetUserId.slice(0, 8)}…` : ''}
                  </p>
                </div>
              </div>
              <Badge variant={STATUS_COLORS[appt.status]}>
                {appt.status.replace('_', ' ')}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
