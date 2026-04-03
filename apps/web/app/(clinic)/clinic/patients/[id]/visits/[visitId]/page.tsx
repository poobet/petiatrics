import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import VisitDetailClient from './visit-detail-client';

interface VisitRecord {
  _id: string;
  patientId: string;
  vetId: string;
  visitDate: string;
  status: 'draft' | 'finalized' | 'amended';
  chiefComplaint?: string;
  soap?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  prescriptions?: Array<{
    drug: string;
    dosage: string;
    frequency: string;
    duration: string;
    productId?: string;
    inventoryLinked: boolean;
  }>;
  attachments?: Array<{ type: string; url: string }>;
  finalizedAt?: string;
  amendedAt?: string;
  amendedBy?: string;
  amendmentReason?: string;
}

async function getVisit(patientId: string, visitId: string): Promise<VisitRecord | null> {
  const cookieStore = await cookies();
  const sid = cookieStore.get('petiatrics_sid')?.value;
  if (!sid) return null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(
    `${apiUrl}/api/v1/patients/${patientId}/visits/${visitId}`,
    {
      headers: { Cookie: `petiatrics_sid=${sid}` },
      cache: 'no-store',
    },
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? null;
}

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>;
}) {
  const { id: patientId, visitId } = await params;
  const visit = await getVisit(patientId, visitId);
  if (!visit) notFound();

  return <VisitDetailClient visit={visit} patientId={patientId} />;
}
