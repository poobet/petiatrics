'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient, ApiError } from '@/lib/api-client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@petiatrics/ui/tabs';
import { Badge } from '@petiatrics/ui/badge';
import { Button } from '@petiatrics/ui/button';

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

interface VisitRecord {
  _id: string;
  vetId: string;
  visitDate: string;
  status: 'draft' | 'finalized' | 'amended';
  chiefComplaint?: string;
  soap?: { subjective?: string; objective?: string; assessment?: string; plan?: string };
  finalizedAt?: string;
}

interface VaccinationRecord {
  _id: string;
  vaccineName: string;
  administeredAt: string;
  nextDueAt?: string;
  batchNumber?: string;
  vetId: string;
}

export default function PatientProfileClient({ patient }: { patient: Patient }) {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([]);
  const [tab, setTab] = useState('info');
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [loadingVax, setLoadingVax] = useState(false);

  useEffect(() => {
    if (tab === 'visits' && visits.length === 0) {
      setLoadingVisits(true);
      apiClient
        .get<VisitRecord[]>(`/api/v1/patients/${patient._id}/visits`)
        .then(setVisits)
        .finally(() => setLoadingVisits(false));
    }
    if (tab === 'vaccinations' && vaccinations.length === 0) {
      setLoadingVax(true);
      apiClient
        .get<VaccinationRecord[]>(`/api/v1/patients/${patient._id}/vaccinations`)
        .then(setVaccinations)
        .finally(() => setLoadingVax(false));
    }
  }, [tab, patient._id]);

  const SPECIES_LABELS: Record<string, string> = {
    dog: 'Dog', cat: 'Cat', rabbit: 'Rabbit', bird: 'Bird', other: 'Other',
  };

  const statusColors: Record<string, string> = {
    draft: 'secondary',
    finalized: 'default',
    amended: 'destructive',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{patient.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">
                {SPECIES_LABELS[patient.species] ?? patient.species}
              </Badge>
              {patient.breed && (
                <span className="text-muted-foreground text-sm">{patient.breed}</span>
              )}
            </div>
          </div>
        </div>
        <Link href={`/patients/${patient._id}/visits/new`}>
          <Button>+ New Visit</Button>
        </Link>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="visits">Medical History</TabsTrigger>
          <TabsTrigger value="vaccinations">Vaccinations</TabsTrigger>
        </TabsList>

        {/* INFO TAB */}
        <TabsContent value="info" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border p-4">
            <InfoRow label="Species" value={SPECIES_LABELS[patient.species] ?? patient.species} />
            <InfoRow label="Breed" value={patient.breed || '—'} />
            <InfoRow
              label="Date of Birth"
              value={patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : '—'}
            />
            <InfoRow
              label="Weight"
              value={patient.weightKg != null ? `${patient.weightKg} kg` : '—'}
            />
            <InfoRow label="Owner ID" value={patient.ownerUserId} />
            <InfoRow
              label="Registered"
              value={new Date(patient.createdAt).toLocaleDateString()}
            />
          </div>
        </TabsContent>

        {/* VISITS TAB */}
        <TabsContent value="visits" className="mt-4">
          {loadingVisits ? (
            <p className="text-muted-foreground text-sm">Loading visits…</p>
          ) : visits.length === 0 ? (
            <p className="text-muted-foreground text-sm">No visits recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {visits.map((v) => (
                <Link
                  key={v._id}
                  href={`/patients/${patient._id}/visits/${v._id}`}
                  className="block rounded-lg border p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {new Date(v.visitDate).toLocaleDateString()}
                      </p>
                      {v.chiefComplaint && (
                        <p className="text-muted-foreground text-sm mt-0.5">{v.chiefComplaint}</p>
                      )}
                    </div>
                    <Badge variant={statusColors[v.status] as any}>{v.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* VACCINATIONS TAB */}
        <TabsContent value="vaccinations" className="mt-4">
          {loadingVax ? (
            <p className="text-muted-foreground text-sm">Loading vaccinations…</p>
          ) : vaccinations.length === 0 ? (
            <p className="text-muted-foreground text-sm">No vaccination records found.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Vaccine</th>
                    <th className="text-left px-4 py-3 font-medium">Administered</th>
                    <th className="text-left px-4 py-3 font-medium">Next Due</th>
                    <th className="text-left px-4 py-3 font-medium">Batch #</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {vaccinations.map((vax) => (
                    <tr key={vax._id}>
                      <td className="px-4 py-3 font-medium">{vax.vaccineName}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(vax.administeredAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {vax.nextDueAt ? new Date(vax.nextDueAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {vax.batchNumber ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  );
}
