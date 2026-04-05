'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Clinic {
  id: string;
  name: string;
  taxId: string;
  slug: string;
  status: string;
  subscriptionTier: string;
  createdAt: string;
  _count?: { users: number };
}

export default function AdminClinicsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejectDialog, setRejectDialog] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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

  async function handleApprove(id: string) {
    await fetch(`/api/v1/admin/clinics/${id}/approve`, { method: 'PATCH' });
    loadClinics();
  }

  async function handleReject() {
    if (!rejectDialog) return;
    await fetch(`/api/v1/admin/clinics/${rejectDialog.id}/reject`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason }),
    });
    setRejectDialog(null);
    setRejectReason('');
    loadClinics();
  }

  const STATUS_COLOR: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    SUSPENDED: 'bg-red-100 text-red-700',
    ARCHIVED: 'bg-gray-100 text-gray-500',
    PENDING: 'bg-yellow-100 text-yellow-700',
    REJECTED: 'bg-red-100 text-red-500',
  };

  const pendingClinics = clinics.filter((c) => c.status === 'PENDING');
  const activeClinics = clinics.filter((c) => c.status !== 'PENDING');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Clinics</h1>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <>
          {/* Pending approvals */}
          {pendingClinics.length > 0 && (
            <div className="mb-6">
              <h2 className="text-base font-semibold text-yellow-700 mb-3">
                ⏳ Pending Approval ({pendingClinics.length})
              </h2>
              <div className="bg-yellow-50 rounded-lg border border-yellow-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-yellow-100 text-yellow-800">
                    <tr>
                      <th className="text-left px-4 py-3">Clinic</th>
                      <th className="text-left px-4 py-3">Tax ID</th>
                      <th className="text-left px-4 py-3">Submitted</th>
                      <th className="text-left px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-yellow-100">
                    {pendingClinics.map((c) => (
                      <tr key={c.id} className="hover:bg-yellow-50">
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-gray-500">{c.taxId}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 flex gap-2">
                          <button
                            onClick={() => handleApprove(c.id)}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectDialog({ id: c.id, name: c.name })}
                            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* All clinics table */}
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
                {activeClinics.map((c) => (
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
                      {(c.status === 'ACTIVE' || c.status === 'SUSPENDED') && (
                        <button
                          onClick={() => handleStatusToggle(c)}
                          className="text-xs text-gray-600 hover:text-blue-600 underline"
                        >
                          {c.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {activeClinics.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No clinics found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Reject dialog */}
      {rejectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Reject: {rejectDialog.name}</h3>
            <p className="text-sm text-gray-600 mb-4">Provide a reason for rejection (optional).</p>
            <textarea
              className="w-full border rounded p-2 text-sm min-h-[80px] mb-4"
              placeholder="Reason for rejection…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setRejectDialog(null); setRejectReason(''); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Reject Registration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

