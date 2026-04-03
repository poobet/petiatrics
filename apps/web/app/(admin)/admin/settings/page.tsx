'use client';

import { useState } from 'react';

interface PlatformSettings {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
}

const DEFAULTS: PlatformSettings = {
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireNumbers: true,
  passwordRequireSymbols: false,
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 15,
};

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const res = await fetch('/api/v1/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Platform Settings</h1>
      <p className="text-sm text-gray-500 mb-6">Configure global security and authentication policies.</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>
      )}
      {saved && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">Settings saved.</div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <section className="bg-white border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Password Policy</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Minimum Length</label>
            <input
              type="number"
              min={6}
              max={32}
              value={settings.passwordMinLength}
              onChange={(e) => setSettings((s) => ({ ...s, passwordMinLength: Number(e.target.value) }))}
              className="border rounded-md px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {[
            { key: 'passwordRequireUppercase', label: 'Require uppercase letter' },
            { key: 'passwordRequireNumbers', label: 'Require numbers' },
            { key: 'passwordRequireSymbols', label: 'Require symbols (!@#$…)' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={settings[key as keyof PlatformSettings] as boolean}
                onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
                className="rounded"
              />
              {label}
            </label>
          ))}
        </section>

        <section className="bg-white border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Account Lockout</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Max Failed Attempts</label>
              <input
                type="number"
                min={1}
                max={20}
                value={settings.maxLoginAttempts}
                onChange={(e) => setSettings((s) => ({ ...s, maxLoginAttempts: Number(e.target.value) }))}
                className="border rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Lockout Duration (minutes)</label>
              <input
                type="number"
                min={1}
                max={1440}
                value={settings.lockoutDurationMinutes}
                onChange={(e) => setSettings((s) => ({ ...s, lockoutDurationMinutes: Number(e.target.value) }))}
                className="border rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
    </div>
  );
}
