import { cookies } from 'next/headers';
import Link from 'next/link';

interface Appointment {
  id: string;
  reason: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
}

async function getAppointments(): Promise<Appointment[]> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get('petiatrics_sid')?.value;
    if (!sid) return [];
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/v1/appointments`, {
      headers: { Cookie: `petiatrics_sid=${sid}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

const STATUS_STYLE: Record<string, string> = {
  REQUESTED: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default async function MyAppointmentsPage() {
  const appointments = await getAppointments();
  const now = new Date();
  const upcoming = appointments.filter(
    (a) => a.status !== 'CANCELLED' && new Date(a.scheduledAt) >= now,
  );
  const past = appointments.filter(
    (a) => a.status === 'COMPLETED' || new Date(a.scheduledAt) < now,
  );

  function AppointmentCard({ appt }: { appt: Appointment }) {
    return (
      <div className="bg-white rounded-xl border p-4 space-y-1">
        <div className="flex items-center justify-between">
          <p className="font-medium text-gray-900 text-sm">{appt.reason}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[appt.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {appt.status}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {new Date(appt.scheduledAt).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {' · '}{appt.durationMinutes} min
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">My Appointments</h1>
        <Link
          href="/my/appointments/book"
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-full hover:bg-blue-700"
        >
          + Book
        </Link>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400">No upcoming appointments.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((a) => <AppointmentCard key={a.id} appt={a} />)}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Past</h2>
          <div className="space-y-2">
            {past.slice(0, 5).map((a) => <AppointmentCard key={a.id} appt={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}
