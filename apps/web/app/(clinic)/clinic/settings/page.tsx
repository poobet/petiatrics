'use client';

import { useState, useEffect } from 'react';

interface ClinicProfile {
  id: string;
  name: string;
  address: string;
  taxId: string;
  taxRateBps: number;
}

export default function ClinicSettingsPage() {
  const [profile, setProfile] = useState<ClinicProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/v1/clinics/me')
      .then((r) => r.json())
      .then((d) => setProfile(d?.data ?? d))
      .catch(() => setError('Failed to load clinic settings'));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const res = await fetch(`/api/v1/clinics/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          address: profile.address,
          taxId: profile.taxId,
          taxRateBps: profile.taxRateBps,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (!profile && !error) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Clinic Settings</h1>
      <p className="text-sm text-gray-500 mb-6">Manage clinic profile and billing configuration.</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>
      )}
      {saved && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">Settings saved.</div>
      )}

      {profile && (
        <form onSubmit={handleSave} className="space-y-6">
          <section className="bg-white border rounded-lg p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Clinic Profile</h2>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Clinic Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile((p) => p && { ...p, name: e.target.value })}
                required
                className="border rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Address</label>
              <textarea
                value={profile.address}
                onChange={(e) => setProfile((p) => p && { ...p, address: e.target.value })}
                rows={3}
                className="border rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Tax ID</label>
              <input
                type="text"
                value={profile.taxId}
                onChange={(e) => setProfile((p) => p && { ...p, taxId: e.target.value })}
                className="border rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </section>

          <section className="bg-white border rounded-lg p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Billing Configuration</h2>
            <div>
              <label className="block text-sm text-gray-600 mb-1">VAT Rate (bps)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={5000}
                  step={1}
                  value={profile.taxRateBps}
                  onChange={(e) => setProfile((p) => p && { ...p, taxRateBps: Number(e.target.value) })}
                  className="border rounded-md px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500">= {(profile.taxRateBps / 100).toFixed(2)}%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Thailand default: 700 bps = 7% VAT</p>
            </div>
          </section>

          <section className="bg-white border rounded-lg p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Financial & Accounting Setup</h2>
            <div className="grid grid-cols-2 gap-4">
              <a
                href="/clinic/settings/chart-of-accounts"
                className="p-4 border rounded-xl hover:border-indigo-500 hover:shadow-sm transition-all group block"
              >
                <div className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 flex items-center gap-2">
                  <span>📖</span> Chart of Accounts (COA)
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Manage 5 category accounts, protected system accounts & user sub-accounts
                </div>
              </a>

              <a
                href="/clinic/settings/accounting-rules"
                className="p-4 border rounded-xl hover:border-indigo-500 hover:shadow-sm transition-all group block"
              >
                <div className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 flex items-center gap-2">
                  <span>⚙️</span> Dynamic Posting Rules
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Rule evaluator engine for perpetual inventory journal entry posting
                </div>
              </a>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
