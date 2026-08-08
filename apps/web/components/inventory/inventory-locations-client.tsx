'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useSessionStore } from '@/lib/session-store';
import { MapPin, Plus, Trash2, Edit2, CheckCircle2, XCircle } from 'lucide-react';

interface InventoryLocation {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSellable: boolean;
  isDefault: boolean;
  isActive: boolean;
}

export default function InventoryLocationsClient() {
  const activeBranch = useSessionStore((s) => s.activeBranch);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSellable, setIsSellable] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState('');

  const fetchLocations = useCallback(async () => {
    if (!activeBranch) return;
    setLoading(true);
    try {
      const data = await apiClient.get<InventoryLocation[]>('/inventory/locations');
      setLocations(data ?? []);
    } catch {
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [activeBranch]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  function openCreateModal() {
    setEditingId(null);
    setCode('');
    setName('');
    setDescription('');
    setIsSellable(true);
    setIsDefault(false);
    setError('');
    setShowModal(true);
  }

  function openEditModal(loc: InventoryLocation) {
    setEditingId(loc.id);
    setCode(loc.code);
    setName(loc.name);
    setDescription(loc.description ?? '');
    setIsSellable(loc.isSellable);
    setIsDefault(loc.isDefault);
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await apiClient.patch(`/inventory/locations/${editingId}`, {
          name,
          description,
          isSellable,
          isDefault,
        });
      } else {
        await apiClient.post('/inventory/locations', {
          code,
          name,
          description,
          isSellable,
          isDefault,
        });
      }
      setShowModal(false);
      await fetchLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save location');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deactivate this location?')) return;
    try {
      await apiClient.delete(`/inventory/locations/${id}`);
      await fetchLocations();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete location');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Inventory Locations (คลัง / พื้นที่จัดเก็บ)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            กำหนดคลังสินค้า จุดจัดเก็บ หรือถังสินค้าชำรุด (Defect Bin) ประจำสาขา
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Location
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading locations…</div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-xs uppercase font-medium text-gray-500 border-b">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Location Name</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-center">Status / Sellable</th>
                <th className="px-4 py-3 text-center">Default</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {locations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                    No inventory locations found.
                  </td>
                </tr>
              ) : (
                locations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono font-bold text-blue-900">{loc.code}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{loc.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{loc.description || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {loc.isSellable ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                          <CheckCircle2 className="w-3 h-3 text-green-600" /> Sellable (คลังปกติ)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                          <XCircle className="w-3 h-3 text-red-600" /> Non-Sellable (Defect Bin)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {loc.isDefault ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
                          DEFAULT
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(loc)}
                        className="p-1 text-gray-500 hover:text-blue-600"
                        title="Edit Location"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(loc.id)}
                        className="p-1 text-gray-500 hover:text-red-600"
                        title="Deactivate Location"
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

      {/* Location Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              {editingId ? 'Edit Inventory Location' : 'New Inventory Location'}
            </h3>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Location Code *</label>
              <input
                type="text"
                disabled={!!editingId}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. WH_MAIN, DEFECT_BIN"
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 font-mono disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Location Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Warehouse, Defect Bin"
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional notes…"
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSellable}
                  onChange={(e) => setIsSellable(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                Is Sellable (เป็นคลังปกติพร้อมจำหน่าย / POS)
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                Set as Default Location for Branch
              </label>
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
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 font-medium"
              >
                Save Location
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
