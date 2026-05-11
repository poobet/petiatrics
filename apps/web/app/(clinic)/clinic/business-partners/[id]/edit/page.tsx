import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { Metadata } from 'next';
import BusinessPartnerForm from '../../../../../../components/business-partners/business-partner-form';
import { BusinessPartnerResponse, AuthProfile } from '@petiatrics/types';

export const metadata: Metadata = { title: 'Edit Business Partner | Petiatrics' };

async function getBusinessPartner(id: string): Promise<BusinessPartnerResponse | null> {
  const cookieStore = await cookies();
  const sid = cookieStore.get('petiatrics_sid')?.value;
  if (!sid) return null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${apiUrl}/api/v1/clinic/business-partners/${id}`, {
    headers: { Cookie: `petiatrics_sid=${sid}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? null;
}

async function getClinicCurrency(): Promise<string> {
  const cookieStore = await cookies();
  const sid = cookieStore.get('petiatrics_sid')?.value;
  if (!sid) return 'THB';

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${apiUrl}/api/v1/auth/me`, {
    headers: { Cookie: `petiatrics_sid=${sid}` },
    cache: 'no-store',
  });
  if (!res.ok) return 'THB';
  const json = await res.json();
  const profile: AuthProfile = json.data ?? json;
  return profile.currencyCode ?? 'THB';
}

export default async function EditBusinessPartnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [bp, currencyCode] = await Promise.all([
    getBusinessPartner(id),
    getClinicCurrency(),
  ]);
  if (!bp) notFound();

  return <BusinessPartnerForm initial={bp} currencyCode={currencyCode} />;
}
