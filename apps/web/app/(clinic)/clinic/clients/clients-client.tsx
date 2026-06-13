'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@petiatrics/ui/button';
import { Input } from '@petiatrics/ui/input';
import { usePermission } from '@/lib/use-permission';

interface ClientUser {
  id: string;
  name: string;
  email: string | null;
  businessPartners?: {
    code: string | null;
    phone: string | null;
  }[];
}

export default function ClientsClient() {
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canAddClient = usePermission('PATIENT:EDIT');

  useEffect(() => {
    apiClient
      .get<ClientUser[]>('/clinic/clients')
      .then(setClients)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load clients'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    const bp = c.businessPartners?.[0];
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (bp?.code && bp.code.toLowerCase().includes(q)) ||
      (bp?.phone && bp.phone.includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Search by name, email, phone or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {canAddClient && (
          <Link href="/clinic/clients/new">
            <Button>+ Register Client</Button>
          </Link>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">BP Code</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No clients found
                  </td>
                </tr>
              )}
              {filtered.map((c) => {
                const bp = c.businessPartners?.[0];
                return (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/clinic/clients/${c.id}`} className="text-primary hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{bp?.code ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{bp?.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/clinic/clients/${c.id}`} className="text-primary underline-offset-4 hover:underline text-sm font-medium">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
