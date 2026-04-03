import { Suspense } from 'react';
import AppointmentsClient from './appointments-client';

export default function AppointmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Appointments</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Schedule and manage clinic appointments
        </p>
      </div>
      <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
        <AppointmentsClient />
      </Suspense>
    </div>
  );
}
