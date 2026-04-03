import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Pet {
  _id: string;
  name: string;
  species: string;
  breed?: string;
  weight?: number;
  dateOfBirth?: string;
  ownerUserId: string;
}

interface Visit {
  _id: string;
  status: string;
  createdAt: string;
  soap?: { assessment?: string };
}

interface Vaccination {
  _id: string;
  vaccineName: string;
  administeredAt: string;
  nextDueAt?: string;
}

async function fetchFromApi(path: string): Promise<unknown> {
  const cookieStore = await cookies();
  const sid = cookieStore.get('petiatrics_sid')?.value;
  if (!sid) return null;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `petiatrics_sid=${sid}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PetDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [pet, visits, vaccinations] = await Promise.all([
    fetchFromApi(`/api/v1/owner/pets`).then((pets) =>
      Array.isArray(pets) ? pets.find((p: Pet) => p._id === id) ?? null : null,
    ),
    fetchFromApi(`/api/v1/owner/pets/${id}/records`),
    fetchFromApi(`/api/v1/owner/pets/${id}/vaccinations`),
  ]);

  if (!pet) notFound();

  const petData = pet as Pet;
  const visitList = (Array.isArray(visits) ? visits : []) as Visit[];
  const vaccinationList = (Array.isArray(vaccinations) ? vaccinations : []) as Vaccination[];

  const SPECIES_EMOJI: Record<string, string> = {
    dog: '🐶', cat: '🐱', bird: '🐦', rabbit: '🐰', hamster: '🐹',
  };
  const emoji = SPECIES_EMOJI[petData.species?.toLowerCase()] ?? '🐾';

  return (
    <div className="p-4 space-y-6">
      <Link href="/my" className="text-sm text-gray-500 hover:text-gray-700">
        ← My Pets
      </Link>

      {/* Health Summary Card */}
      <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
        <span className="text-5xl">{emoji}</span>
        <div>
          <h1 className="text-xl font-bold">{petData.name}</h1>
          <p className="text-sm text-gray-500 capitalize">
            {petData.species}{petData.breed ? ` · ${petData.breed}` : ''}
          </p>
          {petData.weight && <p className="text-xs text-gray-400">{petData.weight} kg</p>}
          {petData.dateOfBirth && (
            <p className="text-xs text-gray-400">
              Born {new Date(petData.dateOfBirth).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Vaccination Status Chips */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-2">Vaccinations</h2>
        {vaccinationList.length === 0 ? (
          <p className="text-sm text-gray-400">No vaccinations recorded.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {vaccinationList.map((v) => {
              const isDue = v.nextDueAt && new Date(v.nextDueAt) <= new Date();
              return (
                <span
                  key={v._id}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${isDue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                >
                  {v.vaccineName}
                  {isDue && ' ⚠ Due'}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Visit Records Timeline */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-2">Health Records</h2>
        {visitList.length === 0 ? (
          <p className="text-sm text-gray-400">No visit records found.</p>
        ) : (
          <div className="space-y-2">
            {visitList.map((visit) => (
              <Link
                key={visit._id}
                href={`/my/pets/${id}/visits/${visit._id}`}
                className="block bg-white rounded-xl border p-3 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {new Date(visit.createdAt).toLocaleDateString()}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${visit.status === 'finalized' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {visit.status}
                  </span>
                </div>
                {visit.soap?.assessment && (
                  <p className="text-sm text-gray-700 mt-1 line-clamp-2">{visit.soap.assessment}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
