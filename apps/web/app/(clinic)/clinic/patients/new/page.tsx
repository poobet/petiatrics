import { Suspense } from 'react';
import PatientNewClient from './patient-new-client';

export default function NewPatientPage() {
  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Add Patient</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Register a new pet in the clinic system.
        </p>
      </div>
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading form…</div>}>
        <PatientNewClient />
      </Suspense>
    </div>
  );
}
