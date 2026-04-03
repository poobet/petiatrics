import { Suspense } from 'react';
import PatientsClient from './patients-client';

export default function PatientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Patients</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage patient profiles and medical history
        </p>
      </div>
      <Suspense fallback={<div className="text-muted-foreground">Loading patients…</div>}>
        <PatientsClient />
      </Suspense>
    </div>
  );
}
