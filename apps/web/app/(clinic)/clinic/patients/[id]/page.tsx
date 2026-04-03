import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import PatientProfileClient from './patient-profile-client';

interface Patient {
  _id: string;
  name: string;
  species: string;
  breed: string;
  ownerUserId: string;
  dateOfBirth?: string;
  weightKg?: number;
  photoUrl?: string;
  createdAt: string;
}

async function getPatient(id: string): Promise<Patient | null> {
  const cookieStore = await cookies();
  const sid = cookieStore.get('petiatrics_sid')?.value;
  if (!sid) return null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${apiUrl}/api/v1/patients/${id}`, {
    headers: { Cookie: `petiatrics_sid=${sid}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? null;
}

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) notFound();

  return <PatientProfileClient patient={patient} />;
}
