'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { usePermission } from '@/lib/use-permission';

interface BranchSetting {
  id: string;
  branchId: string;
  isActive: boolean;
  retailPrice: number | string;
  movingAverageCost: number | string;
}

interface Branch {
  id: string;
  name: string;
}

interface Props {
  productId: string;
}

function formatMinor(minor: number): string {
  return (minor / 100).toFixed(2);
}

export default function BranchSettingsTab({ productId }: Props) {
  const canEdit = usePermission('INVENTORY:EDIT');

  const [settings, setSettings] = useState<BranchSetting[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [settingsRes, branchesRes] = await Promise.allSettled([
          apiClient.get<BranchSetting[]>(`/inventory/products/${productId}/branch-settings`),
          apiClient.get<{ items: Branch[] }>('/identity/branches'),
        ]);
        const currentSettings = settingsRes.status === 'fulfilled' ? (settingsRes.value ?? []) : [];
        const allBranches = branchesRes.status === 'fulfilled' ? (branchesRes.value?.items ?? []) : [];
        setBranches(allBranches);

        // Merge: for branches with no existing setting, create a default row
        const merged = allBranches.map((branch) => {
          const existing = currentSettings.find((s) => s.branchId === branch.id);
          return existing ?? {
            id: '',
            branchId: branch.id,
            isActive: true,
            retailPrice: 0,
            movingAverageCost: 0,
          };
        });
        setSettings(merged);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [productId]);

  function handleChange(branchId: string, field: keyof BranchSetting, value: unknown) {
    setSettings((prev) =>
      prev.map((s) => (s.branchId === branchId ? { ...s, [field]: value } : s)),
    );
    setSuccess('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = settings.map((s) => ({
        branchId: s.branchId,
        isActive: s.isActive,
        retailPrice: Math.round(Number(s.retailPrice) * 100),
        movingAverageCost: Math.round(Number(s.movingAverageCost) * 100),
      }));
      await apiClient.put(`/inventory/products/${productId}/branch-settings`, { settings: payload });
      setSuccess('Branch settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save branch settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400 py-6 text-center">Loading branch settings…</p>;
  }

  if (branches.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">No branches configured for this clinic.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Configure per-branch retail prices and stock activation for this product.
        Leave retail price at 0 to use the base selling price.
      </p>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-4 py-3 font-semibold text-gray-600">Branch</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Active</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Retail Price (THB)</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Moving Avg Cost (THB)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {settings.map((setting) => {
              const branch = branches.find((b) => b.id === setting.branchId);
              return (
                <tr key={setting.branchId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {branch?.name ?? setting.branchId}
                  </td>
                  <td className="px-4 py-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id={`branch-active-${setting.branchId}`}
                        type="checkbox"
                        checked={setting.isActive}
                        onChange={(e) => handleChange(setting.branchId, 'isActive', e.target.checked)}
                        disabled={!canEdit}
                        className="sr-only peer"
                      />
                      <div className={`w-9 h-5 rounded-full peer peer-checked:bg-blue-600 bg-gray-200 peer-disabled:opacity-50 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full`} />
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      id={`branch-retail-${setting.branchId}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={formatMinor(Number(setting.retailPrice))}
                      onChange={(e) => handleChange(setting.branchId, 'retailPrice', Math.round(parseFloat(e.target.value || '0') * 100))}
                      disabled={!canEdit}
                      className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      id={`branch-mac-${setting.branchId}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={formatMinor(Number(setting.movingAverageCost))}
                      onChange={(e) => handleChange(setting.branchId, 'movingAverageCost', Math.round(parseFloat(e.target.value || '0') * 100))}
                      disabled={!canEdit}
                      className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">✓ {success}</p>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <button
            id="branch-settings-save"
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Branch Settings'}
          </button>
        </div>
      )}
    </div>
  );
}
