import { cookies } from 'next/headers';
import Link from 'next/link';
import { apiClient } from '../../../lib/api-client';
import type { UserContext } from '@petiatrics/types';

interface Pet {
  _id: string;
  name: string;
  species: string;
  breed?: string;
  weight?: number;
}

interface Appointment {
  id: string;
  reason: string;
  scheduledAt: string;
  status: string;
}

async function getOwnerPets(): Promise<Pet[]> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get('petiatrics_sid')?.value;
    if (!sid) return [];
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/v1/owner/pets`, {
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

async function getUpcomingAppointments(): Promise<Appointment[]> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get('petiatrics_sid')?.value;
    if (!sid) return [];
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${apiUrl}/api/v1/appointments?date=${today}`, {
      headers: { Cookie: `petiatrics_sid=${sid}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data ?? []).filter((a: Appointment) => a.status !== 'CANCELLED').slice(0, 3);
  } catch {
    return [];
  }
}

const SPECIES_EMOJI: Record<string, string> = {
  dog: '🐶',
  cat: '🐱',
  bird: '🐦',
  rabbit: '🐰',
  hamster: '🐹',
};

function petEmoji(species: string) {
  return SPECIES_EMOJI[species.toLowerCase()] ?? '🐾';
}

export default async function PetOwnerHomePage() {
  const [pets, appointments] = await Promise.all([
    getOwnerPets(),
    getUpcomingAppointments(),
  ]);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Pets</h1>
        <p className="text-sm text-gray-500">Manage your pets' health records</p>
      </div>

      {/* Upcoming Appointment Banner */}
      {appointments.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-600 uppercase mb-2">Upcoming Today</p>
          {appointments.map((appt) => (
            <div key={appt.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">{appt.reason}</p>
                <p className="text-xs text-gray-500">
                  {new Date(appt.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                {appt.status}
              </span>
            </div>
          ))}
          <Link href="/my/appointments" className="text-xs text-blue-600 hover:underline mt-2 block">
            View all appointments →
          </Link>
        </div>
      )}

      {/* Pet Avatar Cards */}
      {pets.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🐾</p>
          <p className="text-sm">No pets registered yet.</p>
          <p className="text-xs text-gray-400 mt-1">Your clinic will add pets to your account.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {pets.map((pet) => (
            <Link
              key={pet._id}
              href={`/my/pets/${pet._id}`}
              className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow flex flex-col items-center gap-2"
            >
              <span className="text-4xl">{petEmoji(pet.species)}</span>
              <p className="font-semibold text-gray-900 text-center">{pet.name}</p>
              <p className="text-xs text-gray-500 capitalize">{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</p>
              {pet.weight && (
                <p className="text-xs text-gray-400">{pet.weight} kg</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
