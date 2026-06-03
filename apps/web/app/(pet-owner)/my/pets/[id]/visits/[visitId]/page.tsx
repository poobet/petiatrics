import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Prescription {
  drug: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
}

interface Visit {
  _id: string;
  status: string;
  createdAt: string;
  finalizedAt?: string;
  soap?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  prescriptions?: Prescription[];
}

interface PageProps {
  params: Promise<{ id: string; visitId: string }>;
}

export default async function PetVisitDetailPage({ params }: PageProps) {
  const { id, visitId } = await params;

  const cookieStore = await cookies();
  const sid = cookieStore.get('petiatrics_sid')?.value;
  if (!sid) notFound();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${apiUrl}/api/v1/owner/pets/${id}/records/${visitId}`, {
    headers: { Cookie: `petiatrics_sid=${sid}` },
    cache: 'no-store',
  });

  if (!res.ok) notFound();
  const json = await res.json();
  const visit: Visit = json.data ?? json;

  return (
    <div className="p-4 space-y-5">
      <Link href={`/my/pets/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
        ← Back to Pet
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Visit Record</h1>
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium ${visit.status === 'finalized' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
        >
          {visit.status}
        </span>
      </div>

      <p className="text-sm text-gray-400">
        {new Date(visit.createdAt).toLocaleDateString()}
        {visit.finalizedAt && ` · Finalized ${new Date(visit.finalizedAt).toLocaleDateString()}`}
      </p>

      {/* SOAP Summary in plain language */}
      {visit.soap && (
        <div className="space-y-3">
          {visit.soap.subjective && (
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Your Concerns</p>
              <p className="text-sm text-gray-700">{visit.soap.subjective}</p>
            </div>
          )}
          {visit.soap.objective && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Examination Findings</p>
              <p className="text-sm text-gray-700">{visit.soap.objective}</p>
            </div>
          )}
          {visit.soap.assessment && (
            <div className="bg-orange-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-orange-600 uppercase mb-1">Diagnosis</p>
              <p className="text-sm text-gray-700">{visit.soap.assessment}</p>
            </div>
          )}
          {visit.soap.plan && (
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-green-600 uppercase mb-1">Treatment Plan</p>
              <p className="text-sm text-gray-700">{visit.soap.plan}</p>
            </div>
          )}
        </div>
      )}

      {/* Prescription Cards */}
      {visit.prescriptions && visit.prescriptions.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-800 mb-2">Prescriptions</h2>
          <div className="space-y-2">
            {visit.prescriptions.map((rx, idx) => (
              <div key={idx} className="bg-white border rounded-xl p-3">
                <p className="font-medium text-gray-900">{rx.drug}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                  {rx.dosage && <span>Dose: {rx.dosage}</span>}
                  {rx.frequency && <span>Frequency: {rx.frequency}</span>}
                  {rx.duration && <span>Duration: {rx.duration}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
