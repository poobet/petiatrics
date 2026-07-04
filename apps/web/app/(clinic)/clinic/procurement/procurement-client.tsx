'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Button } from '@petiatrics/ui';
import { Plus, Check, Send, X, ArrowRight } from 'lucide-react';
import { apiClient } from '../../../../lib/api-client';
import { useSessionStore } from '../../../../lib/session-store';
import { Role } from '@petiatrics/types';

interface PO {
  id: string;
  code: string;
  status: string;
  orderDate: string;
  creditTermDays: number;
  notes?: string | null;
  totalMinor: number;
  supplier: { name: string };
  createdBy?: { name: string };
}

interface GR {
  id: string;
  code: string;
  receivedDate: string;
  receivedBy: { name: string };
  purchaseOrder?: { code: string } | null;
}

interface Product {
  id: string;
  name: string;
  code: string;
  requiresBatchAndExpiryTracking: boolean;
  baseUnit?: { name: string; symbol: string } | null;
}

interface Supplier {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

export default function ProcurementClient() {
  const user = useSessionStore((s) => s.user);
  const activeBranch = useSessionStore((s) => s.activeBranch);

  const [activeTab, setActiveTab] = useState<'pos' | 'grs'>('pos');
  const [pos, setPos] = useState<PO[]>([]);
  const [grs, setGrs] = useState<GR[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [poFormOpen, setPoFormOpen] = useState(false);
  const [grFormOpen, setGrFormOpen] = useState(false);

  // Reference data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // PO form data
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [creditTermDays, setCreditTermDays] = useState(0);
  const [notes, setNotes] = useState('');
  const [poLines, setPoLines] = useState<Array<{ productId: string; quantityOrdered: number; unitPrice: number; taxRateBps: number }>>([]);

  // GR form data
  const [selectedPoId, setSelectedPoId] = useState('');
  const [selectedPo, setSelectedPo] = useState<any>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [grLines, setGrLines] = useState<Array<{ poLineId: string; productId: string; name: string; quantityReceived: number; lotNumber?: string; expiryDate?: string; requiresTracking: boolean }>>([]);

  const isApprover = useMemo(() => {
    return user && [Role.SUPER_ADMIN, Role.CLINIC_OWNER, Role.VET].includes(user.role as Role);
  }, [user]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (activeTab === 'pos') {
        const data = await apiClient.get<PO[]>('/procurement/purchase-orders');
        setPos(data ?? []);
      } else {
        const data = await apiClient.get<GR[]>('/procurement/goods-receipts');
        setGrs(data ?? []);
      }
    } catch (err) {
      console.error('Failed to load procurement data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Load PO form references
  const openPoForm = async () => {
    setPoFormOpen(true);
    try {
      const [suppData, prodData] = await Promise.all([
        apiClient.get<Supplier[]>('/clinic/business-partners'),
        apiClient.get<{ items: Product[] }>('/inventory/products'),
      ]);
      setSuppliers((suppData ?? []).filter(s => s.isActive && (s.type === 'SUPPLIER' || s.type === 'OTHER')));
      setProducts(prodData?.items ?? []);
    } catch (err) {
      console.error('Failed to load PO references', err);
    }
  };

  // Load GR form references
  const openGrForm = async () => {
    setGrFormOpen(true);
    try {
      const poList = await apiClient.get<PO[]>('/procurement/purchase-orders');
      // Only show POs eligible for receipt
      setPos(poList.filter(po => ['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)));
    } catch (err) {
      console.error('Failed to load POs for GR', err);
    }
  };

  const selectPoForReceipt = async (poId: string) => {
    setSelectedPoId(poId);
    if (!poId) {
      setSelectedPo(null);
      setGrLines([]);
      return;
    }
    try {
      const fullPo = await apiClient.get<any>(`/procurement/purchase-orders/${poId}`);
      setSelectedPo(fullPo);
      // Pre-populate receipt lines with outstanding quantities
      const initialGrLines = fullPo.lines.map((line: any) => {
        const remaining = Number(line.quantityOrdered) - Number(line.quantityReceived);
        return {
          poLineId: line.id,
          productId: line.productId,
          name: line.product.name,
          quantityReceived: remaining > 0 ? remaining : 0,
          lotNumber: '',
          expiryDate: '',
          requiresTracking: !!line.product.requiresBatchAndExpiryTracking,
        };
      });
      setGrLines(initialGrLines);
    } catch (err) {
      console.error('Failed to load full PO details', err);
    }
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || poLines.length === 0) {
      alert('Please fill in all required fields and add at least one item.');
      return;
    }
    try {
      await apiClient.post('/procurement/purchase-orders', {
        supplierId: selectedSupplierId,
        creditTermDays,
        notes,
        lines: poLines.map(line => ({
          productId: line.productId,
          quantityOrdered: line.quantityOrdered,
          unitPriceMinor: Math.round(line.unitPrice * 100),
          taxRateBps: line.taxRateBps,
        })),
      });
      setPoFormOpen(false);
      // Reset form
      setSelectedSupplierId('');
      setCreditTermDays(0);
      setNotes('');
      setPoLines([]);
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create Purchase Order');
    }
  };

  const handleCreateGr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoId || grLines.length === 0) {
      alert('Please select a PO and fill in receipt quantities.');
      return;
    }

    // Verify target branch exists
    if (!activeBranch) {
      alert('Please select a branch first from the top navigation.');
      return;
    }

    try {
      await apiClient.post('/procurement/goods-receipts', {
        purchaseOrderId: selectedPoId,
        overrideReason: overrideReason || undefined,
        lines: grLines.map(line => ({
          poLineId: line.poLineId,
          productId: line.productId,
          branchId: activeBranch.id, // Current active branch scoping delivery!
          quantityReceived: line.quantityReceived,
          lotNumber: line.lotNumber || undefined,
          expiryDate: line.expiryDate ? new Date(line.expiryDate).toISOString() : undefined,
        })),
      });
      setGrFormOpen(false);
      // Reset form
      setSelectedPoId('');
      setSelectedPo(null);
      setOverrideReason('');
      setGrLines([]);
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to commit Goods Receipt');
    }
  };

  const addPoLine = () => {
    setPoLines(prev => [...prev, { productId: '', quantityOrdered: 1, unitPrice: 0, taxRateBps: 700 }]);
  };

  const updatePoLine = (index: number, key: string, value: any) => {
    setPoLines(prev => prev.map((line, idx) => idx === index ? { ...line, [key]: value } : line));
  };

  const removePoLine = (index: number) => {
    setPoLines(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateGrLine = (index: number, key: string, value: any) => {
    setGrLines(prev => prev.map((line, idx) => idx === index ? { ...line, [key]: value } : line));
  };

  const handleAction = async (id: string, action: 'submit' | 'approve' | 'cancel') => {
    try {
      await apiClient.patch(`/procurement/purchase-orders/${id}/${action}`, {});
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${action} PO`);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procurement</h1>
          <p className="text-sm text-gray-500 mt-1">Manage purchase orders and inventory inbound receipts.</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'pos' ? (
            <Button size="sm" onClick={openPoForm}>
              <Plus className="w-4 h-4 mr-2" />
              New Purchase Order
            </Button>
          ) : (
            <Button size="sm" onClick={openGrForm}>
              <Plus className="w-4 h-4 mr-2" />
              Receive Inbound Goods
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-6">
        <button
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'pos'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('pos')}
        >
          Purchase Orders
        </button>
        <button
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'grs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('grs')}
        >
          Goods Receipts
        </button>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500">Loading procurement workspace...</div>
      ) : activeTab === 'pos' ? (
        <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-gray-50 border-b text-gray-700 font-semibold">
              <tr>
                <th className="p-3">PO Code</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Order Date</th>
                <th className="p-3">Status</th>
                <th className="p-3">Total Amount</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">No Purchase Orders found.</td>
                </tr>
              ) : (
                pos.map(po => (
                  <tr key={po.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-medium text-gray-900">{po.code}</td>
                    <td className="p-3">{po.supplier.name}</td>
                    <td className="p-3">{new Date(po.orderDate).toLocaleDateString()}</td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        po.status === 'APPROVED' ? 'bg-green-50 text-green-700 border border-green-200' :
                        po.status === 'DRAFT' ? 'bg-gray-100 text-gray-700' :
                        po.status === 'PENDING_APPROVAL' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="p-3 font-medium">฿{(po.totalMinor / 100).toFixed(2)}</td>
                    <td className="p-3 text-right flex justify-end gap-2">
                      {po.status === 'DRAFT' && (
                        <button
                          onClick={() => handleAction(po.id, 'submit')}
                          className="inline-flex items-center px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded border border-blue-100 hover:bg-blue-100"
                        >
                          <Send className="w-3 h-3 mr-1" /> Submit
                        </button>
                      )}
                      {po.status === 'PENDING_APPROVAL' && isApprover && (
                        <button
                          onClick={() => handleAction(po.id, 'approve')}
                          className="inline-flex items-center px-2 py-1 text-xs bg-green-50 text-green-700 rounded border border-green-100 hover:bg-green-100"
                        >
                          <Check className="w-3 h-3 mr-1" /> Approve
                        </button>
                      )}
                      {['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(po.status) && (
                        <button
                          onClick={() => handleAction(po.id, 'cancel')}
                          className="inline-flex items-center px-2 py-1 text-xs bg-red-50 text-red-700 rounded border border-red-100 hover:bg-red-100"
                        >
                          <X className="w-3 h-3 mr-1" /> Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-gray-50 border-b text-gray-700 font-semibold">
              <tr>
                <th className="p-3">GR Code</th>
                <th className="p-3">Received Date</th>
                <th className="p-3">Received By</th>
                <th className="p-3">Linked PO</th>
              </tr>
            </thead>
            <tbody>
              {grs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-400">No Goods Receipts found.</td>
                </tr>
              ) : (
                grs.map(gr => (
                  <tr key={gr.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-medium text-gray-900">{gr.code}</td>
                    <td className="p-3">{new Date(gr.receivedDate).toLocaleString()}</td>
                    <td className="p-3">{gr.receivedBy.name}</td>
                    <td className="p-3">{gr.purchaseOrder?.code ?? 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PO Form Drawer Panel */}
      {poFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-end z-50">
          <div className="bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Create Purchase Order</h2>
              <button onClick={() => setPoFormOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePo} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Supplier *</label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500"
                  >
                    <option value="">Select Supplier...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Credit Terms (Days)</label>
                  <input
                    type="number"
                    min={0}
                    value={creditTermDays}
                    onChange={(e) => setCreditTermDays(parseInt(e.target.value) || 0)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm h-20 focus:outline-blue-500"
                  placeholder="Additional order notes or terms..."
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-bold text-gray-900">PO Lines</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addPoLine}>
                    + Add Item
                  </Button>
                </div>

                {poLines.map((line, idx) => (
                  <div key={idx} className="flex gap-3 items-end border-b pb-3">
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Product</label>
                      <select
                        required
                        value={line.productId}
                        onChange={(e) => updatePoLine(idx, 'productId', e.target.value)}
                        className="w-full border rounded px-2 py-1.5 text-xs focus:outline-blue-500"
                      >
                        <option value="">Select Product...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-20">
                      <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Qty</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={line.quantityOrdered}
                        onChange={(e) => updatePoLine(idx, 'quantityOrdered', parseInt(e.target.value) || 1)}
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-blue-500"
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Price (฿)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        required
                        value={line.unitPrice}
                        onChange={(e) => updatePoLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-blue-500"
                      />
                    </div>
                    <button type="button" onClick={() => removePoLine(idx)} className="text-red-500 hover:text-red-700 pb-1.5">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPoFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save Purchase Order
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GR Form Drawer Panel */}
      {grFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-end z-50">
          <div className="bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Receive Inbound Goods</h2>
              <button onClick={() => setGrFormOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGr} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select Purchase Order *</label>
                <select
                  required
                  value={selectedPoId}
                  onChange={(e) => selectPoForReceipt(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500"
                >
                  <option value="">Select PO...</option>
                  {pos.map(po => (
                    <option key={po.id} value={po.id}>{po.code} - {po.supplier.name}</option>
                  ))}
                </select>
              </div>

              {selectedPo && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Override Reason</label>
                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500"
                      placeholder="Required if receiving quantities exceed PO limits..."
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 border-b pb-2">PO Items to Receive</h3>

                    {grLines.map((line, idx) => (
                      <div key={idx} className="border-b pb-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-900">{line.name}</span>
                          {line.requiresTracking && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                              Batch/Lot Required
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Quantity Received</label>
                            <input
                              type="number"
                              min={0}
                              required
                              value={line.quantityReceived}
                              onChange={(e) => updateGrLine(idx, 'quantityReceived', parseFloat(e.target.value) || 0)}
                              className="w-full border rounded px-2 py-1 text-xs focus:outline-blue-500"
                            />
                          </div>

                          {line.requiresTracking && (
                            <>
                              <div>
                                <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Lot Number *</label>
                                <input
                                  type="text"
                                  required
                                  value={line.lotNumber || ''}
                                  onChange={(e) => updateGrLine(idx, 'lotNumber', e.target.value)}
                                  className="w-full border rounded px-2 py-1 text-xs focus:outline-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Expiry Date *</label>
                                <input
                                  type="date"
                                  required
                                  value={line.expiryDate || ''}
                                  onChange={(e) => updateGrLine(idx, 'expiryDate', e.target.value)}
                                  className="w-full border rounded px-2 py-1 text-xs focus:outline-blue-500"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setGrFormOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      Commit Inbound Receipt
                    </Button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
