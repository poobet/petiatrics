'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Clinic {
  id: string;
  name: string;
  taxId: string;
  status: string;
  subscriptionTier: string;
  createdAt: string;
  _count?: { users: number };
}

export default function AdminClinicsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadClinics() {
    try {
      const res = await fetch('/api/v1/admin/clinics');
      const json = await res.json();
      setClinics(json?.data ?? json ?? []);
    } catch {
      setError('Failed to load clinics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClinics(); }, []);

  async function handleStatusToggle(clinic: Clinic) {
    const next = clinic.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await fetch(`/api/v1/admin/clinics/${clinic.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    loadClinics();
  }

  const STATUS_COLOR: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    SUSPENDED: 'bg-red-100 text-red-700',
    ARCHIVED: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Clinics</h1>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Tax ID</th>
                <th className="text-left px-4 py-3">Tier</th>
                <th className="text-left px-4 py-3">Users</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {clinics.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clinics/${c.id}`} className="text-blue-600 hover:underline font-medium">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.taxId}</td>
                  <td className="px-4 py-3">{c.subscriptionTier}</td>
                  <td className="px-4 py-3">{c._count?.users ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[c.status] ?? ''}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleStatusToggle(c)}
                      className="text-xs text-gray-600 hover:text-blue-600 underline"
                    >
                      {c.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {clinics.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No clinics found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
