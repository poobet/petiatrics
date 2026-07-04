'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@petiatrics/ui/button';
import { Badge } from '@petiatrics/ui/badge';
import { usePermission } from '@/lib/use-permission';
import { BusinessPartnerResponse } from '@petiatrics/types';

interface Pet {
  _id: string;
  name: string;
  species: string;
  breed: string;
  weightKg?: number;
  createdAt: string;
}

export default function ClientDetailClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [bp, setBp] = useState<BusinessPartnerResponse | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = usePermission('PATIENT:EDIT');

  useEffect(() => {
    const loadData = async () => {
      try {
        const bpData = await apiClient.get<BusinessPartnerResponse>(`/clinic/business-partners/${id}`);
        setBp(bpData);

        // Pets are still linked via ownerUserId (User table ID)
        // bp.user contains the linked user record
        if (bpData.user?.id) {
          const petsData = await apiClient.get<Pet[]>(`/patients?ownerUserId=${bpData.user.id}`);
          setPets(petsData);
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load details');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (error || !bp) return <p className="text-destructive text-sm">{error || 'Client not found'}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{bp.name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            BP Code: <span className="font-medium text-foreground">{bp.code ?? '—'}</span>
            <Link
              href={`/clinic/business-partners/${bp.id}/edit`}
              className="ml-2 text-primary hover:underline text-xs"
            >
              View BP Record →
            </Link>
          </p>
        </div>
        <Link href="/clinic/clients">
          <Button variant="outline">Back to Clients</Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 border rounded-lg p-5 space-y-4 bg-card">
          <h2 className="font-semibold text-lg border-b pb-2">Client Profile</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground block">Email</span>
              <span className="font-medium">{bp.email ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Phone</span>
              <span className="font-medium">{bp.phone ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Line ID</span>
              <span className="font-medium">{bp.lineId ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Tax ID</span>
              <span className="font-medium">{bp.taxId ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Address</span>
              <span className="font-medium whitespace-pre-line">
                {bp.addressLine1 ? (
                  <>
                    {bp.addressLine1}
                    {(bp.subDistrict || bp.district || bp.province) && '\n'}
                    {[bp.subDistrict, bp.district, bp.province].filter(Boolean).join(', ')}
                    {bp.zipcode && ` ${bp.zipcode}`}
                  </>
                ) : (
                  '—'
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="col-span-2 border rounded-lg p-5 space-y-4 bg-card">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-lg">Patients / Pets</h2>
            {canEdit && (
              <Link href={`/clinic/patients/new?ownerId=${bp.user?.id}`}>
                <Button size="sm">+ Add Pet</Button>
              </Link>
            )}
          </div>

          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Pet Name</th>
                  <th className="text-left px-4 py-2.5 font-medium">Species / Breed</th>
                  <th className="text-left px-4 py-2.5 font-medium">Weight</th>
                  <th className="px-4 py-2.5 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {pets.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No pets registered for this client.
                    </td>
                  </tr>
                )}
                {pets.map((pet) => (
                  <tr key={pet._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{pet.name}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="capitalize">{pet.species}</Badge>
                        {pet.breed && <span className="text-muted-foreground text-xs">{pet.breed}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {pet.weightKg != null ? `${pet.weightKg} kg` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/clinic/patients/${pet._id}`} className="text-primary hover:underline text-xs font-semibold">
                        View History
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
