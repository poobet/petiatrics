import { Suspense } from 'react';
import ClientsClient from './clients-client';

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage pet owners, B2C business partners, and demographics
        </p>
      </div>
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading clients…</div>}>
        <ClientsClient />
      </Suspense>
    </div>
  );
}
