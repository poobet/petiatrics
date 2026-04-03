'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface ClinicUser {
  id: string;
  email: string;
  role: string;
  status: string;
}

interface ClinicDetail {
  id: string;
  name: string;
  taxId: string;
  address: Record<string, string>;
  status: string;
  subscriptionTier: string;
  createdAt: string;
  settings: Record<string, unknown>;
  users?: ClinicUser[];
}

type Tab = 'info' | 'users';

export default function AdminClinicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [clinic, setClinic] = useState<ClinicDetail | null>(null);
  const [tab, setTab] = useState<Tab>('info');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/v1/admin/clinics/${id}`)
      .then((r) => r.json())
      .then((d) => setClinic(d?.data ?? d))
      .catch(() => setError('Failed to load clinic'));
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!clinic) return;
    setSaving(true);
    try {
      await fetch(`/api/v1/admin/clinics/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clinic.name, taxId: clinic.taxId }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusToggle() {
    if (!clinic) return;
    const next = clinic.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await fetch(`/api/v1/admin/clinics/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    setClinic((c) => c && { ...c, status: next });
  }

  if (!clinic && !error) return <div className="p-6 text-sm text-gray-400">Loading…</div>;
  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;

  const STATUS_COLOR: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    SUSPENDED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/clinics" className="text-sm text-gray-500 hover:text-blue-600">← Clinics</Link>
        <h1 className="text-2xl font-bold flex-1">{clinic!.name}</h1>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[clinic!.status] ?? ''}`}>
          {clinic!.status}
        </span>
        <button
          onClick={handleStatusToggle}
          className="text-xs border rounded px-3 py-1.5 hover:bg-gray-50"
        >
          {clinic!.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {(['info', 'users'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize -mb-px border-b-2 transition-colors ${
              tab === t ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'info' ? 'Info' : 'Users'}
          </button>
        ))}
      </div>

      {tab === 'info' && clinic && (
        <form onSubmit={handleSave} className="space-y-4">
          {saved && <p className="text-sm text-green-600">Saved.</p>}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Clinic Name</label>
            <input
              type="text"
              value={clinic.name}
              onChange={(e) => setClinic((c) => c && { ...c, name: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Tax ID</label>
            <input
              type="text"
              value={clinic.taxId}
              onChange={(e) => setClinic((c) => c && { ...c, taxId: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Subscription Tier</label>
            <p className="text-sm text-gray-700 font-medium">{clinic.subscriptionTier}</p>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Created</label>
            <p className="text-sm text-gray-700">{new Date(clinic.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {tab === 'users' && (
        <div>
          {!clinic?.users || clinic.users.length === 0 ? (
            <p className="text-sm text-gray-400">No users found for this clinic.</p>
          ) : (
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clinic.users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{u.role}</td>
                    <td className="px-4 py-3">{u.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
