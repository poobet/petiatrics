'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useSessionStore } from '@/lib/session-store';
import { Tag, Plus, Trash2, Edit2, ArrowRight } from 'lucide-react';

interface InventoryLocation {
  id: string;
  code: string;
  name: string;
  isSellable: boolean;
}

interface ReasonCode {
  id: string;
  code: string;
  description: string;
  type: string;
  defaultLocationId: string | null;
  defaultLocation?: InventoryLocation | null;
  isActive: boolean;
}

const REASON_TYPES = ['RETURN', 'SHRINKAGE', 'EXPIRED', 'DAMAGE', 'ADJUSTMENT', 'OTHER'];

export default function ReasonCodesClient() {
  const activeBranch = useSessionStore((s) => s.activeBranch);
  const [reasonCodes, setReasonCodes] = useState<ReasonCode[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('RETURN');
  const [defaultLocationId, setDefaultLocationId] = useState('');
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!activeBranch) return;
    setLoading(true);
    try {
      const [reasonsRes, locsRes] = await Promise.allSettled([
        apiClient.get<ReasonCode[]>('/inventory/reason-codes'),
        apiClient.get<InventoryLocation[]>('/inventory/locations'),
      ]);
      setReasonCodes(reasonsRes.status === 'fulfilled' ? (reasonsRes.value ?? []) : []);
      setLocations(locsRes.status === 'fulfilled' ? (locsRes.value ?? []) : []);
    } catch {
      setReasonCodes([]);
    } finally {
      setLoading(false);
    }
  }, [activeBranch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openCreateModal() {
    setEditingId(null);
    setCode('');
    setDescription('');
    setType('RETURN');
    setDefaultLocationId('');
    setError('');
    setShowModal(true);
  }

  function openEditModal(rc: ReasonCode) {
    setEditingId(rc.id);
    setCode(rc.code);
    setDescription(rc.description);
    setType(rc.type);
    setDefaultLocationId(rc.defaultLocationId ?? '');
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await apiClient.patch(`/inventory/reason-codes/${editingId}`, {
          description,
          type,
          defaultLocationId: defaultLocationId || null,
        });
      } else {
        await apiClient.post('/inventory/reason-codes', {
          code,
          description,
          type,
          defaultLocationId: defaultLocationId || null,
        });
      }
      setShowModal(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save reason code');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deactivate this reason code?')) return;
    try {
      await apiClient.delete(`/inventory/reason-codes/${id}`);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete reason code');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Tag className="w-5 h-5 text-purple-600" />
            Reason Codes & Return Routing (รหัสเหตุผลและการจัดเส้นทางคืนสินค้า)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            กำหนดรหัสเหตุผลการคืน/ปรับปรุงสินค้า พร้อมจับคู่คลังปลายทางอัตโนมัติ (Automated Return Routing)
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Reason Code
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading reason codes…</div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-xs uppercase font-medium text-gray-500 border-b">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Automated Default Location Routing</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reasonCodes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground text-xs">
                    No reason codes found.
                  </td>
                </tr>
              ) : (
                reasonCodes.map((rc) => (
                  <tr key={rc.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono font-bold text-purple-900">{rc.code}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{rc.description}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="px-2 py-0.5 rounded bg-gray-100 font-semibold text-gray-700">
                        {rc.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {rc.defaultLocation ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <ArrowRight className="w-3.5 h-3.5 text-purple-500" />
                          <span className="font-semibold text-gray-800">{rc.defaultLocation.name}</span>
                          {rc.defaultLocation.isSellable ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700">Sellable</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700">Defect Bin</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Unmapped (Default fallback)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(rc)}
                        className="p-1 text-gray-500 hover:text-purple-600"
                        title="Edit Reason Code"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rc.id)}
                        className="p-1 text-gray-500 hover:text-red-600"
                        title="Deactivate Reason Code"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Reason Code Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              {editingId ? 'Edit Reason Code' : 'New Reason Code'}
            </h3>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reason Code *</label>
              <input
                type="text"
                disabled={!!editingId}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. RTN_DEFECT, EXPIRED"
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 font-mono disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Customer Return (Damaged/Defective)"
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
              >
                {REASON_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Automated Default Location Routing (คลังปลายทางอัตโนมัติ)
              </label>
              <select
                value={defaultLocationId}
                onChange={(e) => setDefaultLocationId(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
              >
                <option value="">-- Select Location --</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code}) {loc.isSellable ? '[Sellable]' : '[Defect Bin]'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded-md text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 font-medium"
              >
                Save Reason Code
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
