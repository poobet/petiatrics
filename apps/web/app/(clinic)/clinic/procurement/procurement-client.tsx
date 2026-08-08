'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Button } from '@petiatrics/ui';
import {
  Plus,
  Check,
  Send,
  X,
  ArrowRight,
  TrendingUp,
  FileText,
  CreditCard,
  DollarSign,
  Info,
  AlertTriangle,
  Receipt,
  FileCheck2,
  Eye,
  ArrowLeft,
  Calendar,
} from 'lucide-react';
import { apiClient } from '../../../../lib/api-client';
import { useSessionStore } from '../../../../lib/session-store';
import { Role } from '@petiatrics/types';
import { Money } from '@/components/ui/money';
import { formatMinor } from '@/lib/currency';
import Link from 'next/link';

interface PO {
  id: string;
  code: string;
  status: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  creditTermDays: number;
  notes?: string | null;
  totalMinor: number;
  supplier: { id: string; name: string };
  createdBy?: { name: string };
  lines?: Array<{
    id: string;
    product: { name: string; code: string };
    quantityOrdered: number;
    quantityReceived: number;
    quantityInvoiced: number;
    unitPriceMinor: number;
  }>;
}

interface GR {
  id: string;
  code: string;
  receivedDate: string;
  receivedBy: { name: string };
  purchaseOrder?: { code: string } | null;
  lines?: Array<{
    id: string;
    product: { name: string; code: string };
    quantityReceived: number;
    lotNumber?: string | null;
    expiryDate?: string | null;
  }>;
}

interface PI {
  id: string;
  code: string;
  invoiceNumber: string;
  status: string;
  matchStatus: string;
  invoiceDate: string;
  dueDate: string;
  subtotalMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  supplier: { id: string; name: string };
  purchaseOrder?: { id: string; code: string } | null;
  createdBy?: { name: string } | null;
  lines?: Array<{
    id: string;
    product: { name: string; code: string };
    quantity: number;
    unitPriceMinor: number;
    taxRateBps: number;
    totalMinor: number;
  }>;
}

interface Payment {
  id: string;
  code: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string | null;
  amountMinor: number;
  whtAmountMinor: number;
  whtRateBps: number;
  supplier: { name: string; taxId?: string | null };
  createdBy?: { name: string } | null;
  allocations: Array<{
    amountAllocatedMinor: number;
    invoice: { code: string; totalMinor: number };
  }>;
}

interface Product {
  id: string;
  name: string;
  code: string;
  requiresBatchAndExpiryTracking: boolean;
  baseUnit?: { name: string; symbol: string } | null;
  categoryId?: string | null;
}

interface Supplier {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface ProcurementClientProps {
  initialTab?: 'pos' | 'grs' | 'invoices' | 'payments';
}

export default function ProcurementClient({ initialTab = 'pos' }: ProcurementClientProps) {
  const user = useSessionStore((s) => s.user);
  const activeBranch = useSessionStore((s) => s.activeBranch);

  const [activeTab, setActiveTab] = useState<'pos' | 'grs' | 'invoices' | 'payments'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [pos, setPos] = useState<PO[]>([]);
  const [grs, setGrs] = useState<GR[]>([]);
  const [invoices, setInvoices] = useState<PI[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // View states: 'list' | creation pages | details pages
  const [viewMode, setViewMode] = useState<'list' | 'create-po' | 'create-gr' | 'create-invoice' | 'create-payment' | 'view-po' | 'view-gr' | 'view-invoice' | 'view-payment'>('list');

  // Detail display states
  const [selectedPoDetails, setSelectedPoDetails] = useState<PO | null>(null);
  const [selectedGrDetails, setSelectedGrDetails] = useState<GR | null>(null);
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState<PI | null>(null);
  const [selectedPaymentDetails, setSelectedPaymentDetails] = useState<Payment | null>(null);

  // Match details state
  const [selectedMatchResult, setSelectedMatchResult] = useState<any>(null);
  const [matchingInvoiceId, setMatchingInvoiceId] = useState<string | null>(null);

  // Reference data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // PO form data
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [creditTermDays, setCreditTermDays] = useState(0);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [poLines, setPoLines] = useState<Array<{ productId: string; quantityOrdered: number; unitPrice: number; taxRateBps: number }>>([]);

  // GR form data
  const [selectedPoId, setSelectedPoId] = useState('');
  const [selectedPo, setSelectedPo] = useState<any>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [grLines, setGrLines] = useState<Array<{ poLineId: string; productId: string; name: string; quantityReceived: number; lotNumber?: string; expiryDate?: string; requiresTracking: boolean }>>([]);

  // Invoice form data
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [invoiceLines, setInvoiceLines] = useState<Array<{ poLineId?: string; productId: string; name: string; quantity: number; unitPrice: number; taxRateBps: number }>>([]);

  // Payment form data
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'CASH' | 'CHEQUE' | 'PROMISSORY_NOTE'>('BANK_TRANSFER');
  const [paymentDate, setPaymentDate] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [whtRateBps, setWhtRateBps] = useState(100); // 1% default e-tax WHT
  const [whtAmount, setWhtAmount] = useState(0);
  const [unpaidInvoices, setUnpaidInvoices] = useState<PI[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});

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
      } else if (activeTab === 'grs') {
        const data = await apiClient.get<GR[]>('/procurement/goods-receipts');
        setGrs(data ?? []);
      } else if (activeTab === 'invoices') {
        const data = await apiClient.get<PI[]>('/procurement/purchase-invoices');
        setInvoices(data ?? []);
      } else if (activeTab === 'payments') {
        const data = await apiClient.get<Payment[]>('/procurement/supplier-payments');
        setPayments(data ?? []);
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

  // Auto WHT calculation when payment amount or rate changes
  useEffect(() => {
    setWhtAmount(Math.round((paymentAmount * whtRateBps) / 10000 * 100) / 100);
  }, [paymentAmount, whtRateBps]);

  // Load PO references and open PO page
  const openPoCreatePage = async () => {
    setViewMode('create-po');
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

  // Load GR references and open GR page
  const openGrCreatePage = async () => {
    setViewMode('create-gr');
    try {
      const poList = await apiClient.get<PO[]>('/procurement/purchase-orders');
      setPos(poList.filter(po => ['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)));
    } catch (err) {
      console.error('Failed to load POs for GR', err);
    }
  };

  // Load Invoice references and open Invoice page
  const openInvoiceCreatePage = async () => {
    setViewMode('create-invoice');
    try {
      const [suppData, prodData, poList] = await Promise.all([
        apiClient.get<Supplier[]>('/clinic/business-partners'),
        apiClient.get<{ items: Product[] }>('/inventory/products'),
        apiClient.get<PO[]>('/procurement/purchase-orders'),
      ]);
      setSuppliers((suppData ?? []).filter(s => s.isActive && (s.type === 'SUPPLIER' || s.type === 'OTHER')));
      setProducts(prodData?.items ?? []);
      setPos(poList.filter(po => ['APPROVED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'].includes(po.status)));
    } catch (err) {
      console.error('Failed to load Invoice references', err);
    }
  };

  // Load Payment references and open Payment page
  const openPaymentCreatePage = async () => {
    setViewMode('create-payment');
    try {
      const suppData = await apiClient.get<Supplier[]>('/clinic/business-partners');
      setSuppliers((suppData ?? []).filter(s => s.isActive && (s.type === 'SUPPLIER' || s.type === 'OTHER')));
    } catch (err) {
      console.error('Failed to load Payment references', err);
    }
  };

  // Select PO for Invoicing
  const selectPoForInvoice = async (poId: string) => {
    setSelectedPoId(poId);
    if (!poId) {
      setInvoiceLines([]);
      return;
    }
    try {
      const fullPo = await apiClient.get<any>(`/procurement/purchase-orders/${poId}`);
      const initialInvLines = fullPo.lines.map((line: any) => {
        const remaining = Number(line.quantityOrdered) - Number(line.quantityInvoiced);
        return {
          poLineId: line.id,
          productId: line.productId,
          name: line.product.name,
          quantity: remaining > 0 ? remaining : 0,
          unitPrice: Number(line.unitPriceMinor) / 100,
          taxRateBps: line.taxRateBps || 700,
        };
      });
      setInvoiceLines(initialInvLines);
    } catch (err) {
      console.error('Failed to load PO details for Invoice', err);
    }
  };

  // Select Supplier for Payment
  const selectSupplierForPayment = async (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    if (!supplierId) {
      setUnpaidInvoices([]);
      setAllocations({});
      return;
    }
    try {
      const allInvoices = await apiClient.get<PI[]>('/procurement/purchase-invoices');
      const supplierUnpaid = allInvoices.filter(
        (inv) => inv.supplier.id === supplierId && ['POSTED', 'PARTIALLY_PAID'].includes(inv.status)
      );
      setUnpaidInvoices(supplierUnpaid);
      
      const initialAllocs: Record<string, number> = {};
      supplierUnpaid.forEach(inv => {
        initialAllocs[inv.id] = 0;
      });
      setAllocations(initialAllocs);
    } catch (err) {
      console.error('Failed to fetch unpaid invoices for supplier', err);
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
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate).toISOString() : undefined,
        notes,
        lines: poLines.map(line => ({
          productId: line.productId,
          quantityOrdered: line.quantityOrdered,
          unitPriceMinor: Math.round(line.unitPrice * 100),
          taxRateBps: line.taxRateBps,
        })),
      });
      setViewMode('list');
      setSelectedSupplierId('');
      setCreditTermDays(0);
      setExpectedDeliveryDate('');
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
          branchId: activeBranch.id,
          quantityReceived: line.quantityReceived,
          lotNumber: line.lotNumber || undefined,
          expiryDate: line.expiryDate ? new Date(line.expiryDate).toISOString() : undefined,
        })),
      });
      setViewMode('list');
      setSelectedPoId('');
      setSelectedPo(null);
      setOverrideReason('');
      setGrLines([]);
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to commit Goods Receipt');
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !invoiceNumber || !invoiceDate || !dueDate || invoiceLines.length === 0) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      await apiClient.post('/procurement/purchase-invoices', {
        supplierId: selectedSupplierId,
        purchaseOrderId: selectedPoId || undefined,
        invoiceNumber,
        invoiceDate: new Date(invoiceDate).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        lines: invoiceLines.map(line => ({
          poLineId: line.poLineId || undefined,
          productId: line.productId,
          quantity: line.quantity,
          unitPriceMinor: Math.round(line.unitPrice * 100),
          taxRateBps: line.taxRateBps,
        })),
      });
      setViewMode('list');
      setSelectedSupplierId('');
      setSelectedPoId('');
      setInvoiceNumber('');
      setInvoiceDate('');
      setDueDate('');
      setInvoiceLines([]);
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create Purchase Invoice');
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || paymentAmount <= 0) {
      alert('Please fill in all required fields.');
      return;
    }

    if (!activeBranch) {
      alert('Please select a branch first from the top navigation.');
      return;
    }

    const payloadAllocations = Object.entries(allocations)
      .filter(([_, amt]) => amt > 0)
      .map(([invoiceId, amt]) => ({
        purchaseInvoiceId: invoiceId,
        amountAllocatedMinor: Math.round(amt * 100),
      }));

    try {
      await apiClient.post('/procurement/supplier-payments', {
        supplierId: selectedSupplierId,
        paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        paymentMethod,
        referenceNumber: referenceNumber || undefined,
        amountMinor: Math.round(paymentAmount * 100),
        whtRateBps,
        whtAmountMinor: Math.round(whtAmount * 100),
        allocations: payloadAllocations,
      });
      setViewMode('list');
      setSelectedSupplierId('');
      setPaymentMethod('BANK_TRANSFER');
      setPaymentDate('');
      setReferenceNumber('');
      setPaymentAmount(0);
      setWhtRateBps(100);
      setUnpaidInvoices([]);
      setAllocations({});
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create Supplier Payment');
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

  const updateInvoiceLine = (index: number, key: string, value: any) => {
    setInvoiceLines(prev => prev.map((line, idx) => idx === index ? { ...line, [key]: value } : line));
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

  const runThreeWayMatch = async (invoiceId: string) => {
    setMatchingInvoiceId(invoiceId);
    try {
      const matchResult = await apiClient.post<any>(`/procurement/purchase-invoices/${invoiceId}/match`, {});
      setSelectedMatchResult(matchResult);
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to perform 3-way match');
    } finally {
      setMatchingInvoiceId(null);
    }
  };

  const postInvoice = async (invoiceId: string) => {
    try {
      await apiClient.patch(`/procurement/purchase-invoices/${invoiceId}/post`, {});
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to post invoice');
    }
  };

  const voidInvoice = async (invoiceId: string) => {
    try {
      await apiClient.patch(`/procurement/purchase-invoices/${invoiceId}/void`, {});
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to void invoice');
    }
  };

  // Fetch detailed document fields for viewing and change viewMode
  const showPoDetails = async (poId: string) => {
    try {
      const details = await apiClient.get<PO>(`/procurement/purchase-orders/${poId}`);
      setSelectedPoDetails(details);
      setViewMode('view-po');
    } catch (err) {
      alert('Failed to load purchase order details');
    }
  };

  const showGrDetails = async (grId: string) => {
    try {
      const details = await apiClient.get<GR>(`/procurement/goods-receipts/${grId}`);
      setSelectedGrDetails(details);
      setViewMode('view-gr');
    } catch (err) {
      alert('Failed to load goods receipt details');
    }
  };

  const showInvoiceDetails = async (invoiceId: string) => {
    try {
      const details = await apiClient.get<PI>(`/procurement/purchase-invoices/${invoiceId}`);
      setSelectedInvoiceDetails(details);
      setViewMode('view-invoice');
    } catch (err) {
      alert('Failed to load purchase invoice details');
    }
  };

  const showPaymentDetails = async (paymentId: string) => {
    try {
      const details = await apiClient.get<Payment>(`/procurement/supplier-payments/${paymentId}`);
      setSelectedPaymentDetails(details);
      setViewMode('view-payment');
    } catch (err) {
      alert('Failed to load supplier payment details');
    }
  };

  if (viewMode === 'create-po') {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewMode('list')} className="p-2 border rounded-lg hover:bg-gray-50 transition-colors text-gray-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Create Purchase Order</h1>
            <p className="text-xs text-gray-500">Draft a new procurement order contract with a supplier partner.</p>
          </div>
        </div>

        <form onSubmit={handleCreatePo} className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
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
            <label className="block text-xs font-semibold text-gray-700 mb-1">Expected Delivery Date</label>
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm h-24 focus:outline-blue-500"
              placeholder="Additional order notes or terms..."
            />
          </div>

          <div className="space-y-4">
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
                <div className="w-24">
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
                <div className="w-32">
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

          <div className="pt-4 border-t flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setViewMode('list')}>
              Cancel
            </Button>
            <Button type="submit">
              Save Purchase Order
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (viewMode === 'create-gr') {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewMode('list')} className="p-2 border rounded-lg hover:bg-gray-50 transition-colors text-gray-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Receive Inbound Goods</h1>
            <p className="text-xs text-gray-500">Check in delivery quantities and record batches/expiry dates against an approved PO.</p>
          </div>
        </div>

        <form onSubmit={handleCreateGr} className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
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
                      <span className="text-xs font-bold text-gray-950">{line.name}</span>
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

              <div className="pt-4 border-t flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setViewMode('list')}>
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
    );
  }

  if (viewMode === 'create-invoice') {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewMode('list')} className="p-2 border rounded-lg hover:bg-gray-50 transition-colors text-gray-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Create Supplier Invoice</h1>
            <p className="text-xs text-gray-500">Record a supplier tax invoice details to match and queue for payments.</p>
          </div>
        </div>

        <form onSubmit={handleCreateInvoice} className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">Link Purchase Order</label>
              <select
                value={selectedPoId}
                onChange={(e) => selectPoForInvoice(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500"
              >
                <option value="">Select PO (Optional)...</option>
                {pos.filter(po => !selectedSupplierId || po.supplier.name === suppliers.find(s=>s.id===selectedSupplierId)?.name).map(po => (
                  <option key={po.id} value={po.id}>{po.code} - {formatMinor(po.totalMinor)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Vendor Invoice # *</label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500"
                placeholder="e.g. TAX-88392"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Date *</label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Due Date *</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500"
              />
            </div>
          </div>

          {invoiceLines.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900 border-b pb-2">Invoice Line Items</h3>
              {invoiceLines.map((line, idx) => (
                <div key={idx} className="border-b pb-3 space-y-2">
                  <div className="text-xs font-bold text-gray-800">{line.name}</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Invoice Qty</label>
                      <input
                        type="number"
                        min={0.001}
                        step="0.001"
                        required
                        value={line.quantity}
                        onChange={(e) => updateInvoiceLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Unit Price (฿)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        required
                        value={line.unitPrice}
                        onChange={(e) => updateInvoiceLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Tax (VAT %)</label>
                      <select
                        value={line.taxRateBps}
                        onChange={(e) => updateInvoiceLine(idx, 'taxRateBps', parseInt(e.target.value) || 0)}
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-blue-500"
                      >
                        <option value={700}>7% VAT</option>
                        <option value={0}>0% / Exempt</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setViewMode('list')}>
              Cancel
            </Button>
            <Button type="submit">
              Save Invoice
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (viewMode === 'create-payment') {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewMode('list')} className="p-2 border rounded-lg hover:bg-gray-50 transition-colors text-gray-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Record Supplier Payment</h1>
            <p className="text-xs text-gray-500">Record a supplier disbursement payment transaction with tax withholding.</p>
          </div>
        </div>

        <form onSubmit={handleCreatePayment} className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Supplier *</label>
              <select
                required
                value={selectedSupplierId}
                onChange={(e) => selectSupplierForPayment(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500"
              >
                <option value="">Select Supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Method *</label>
              <select
                required
                value={paymentMethod}
                onChange={(e) => {
                  const method = e.target.value as any;
                  setPaymentMethod(method);
                  if (method === 'BANK_TRANSFER') setWhtRateBps(100);
                  else setWhtRateBps(0);
                }}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500"
              >
                <option value="BANK_TRANSFER">Bank Transfer (e-Tax flat 1% WHT)</option>
                <option value="CASH">Cash (No WHT)</option>
                <option value="CHEQUE">Cheque (3% standard WHT)</option>
                <option value="PROMISSORY_NOTE">Promissory Note</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reference Number</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500"
                placeholder="e.g. TRX-20260719-89"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t pt-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Amount (฿) *</label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500 font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Withholding Tax (WHT %)</label>
              <select
                value={whtRateBps}
                onChange={(e) => setWhtRateBps(parseInt(e.target.value) || 0)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500 text-red-600 font-semibold"
              >
                <option value={100}>1% e-WHT flat rate (Incentive through 2027)</option>
                <option value={300}>3% Standard Service rate</option>
                <option value={0}>0% No WHT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Auto-Calc WHT Amount</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-red-600 font-bold">
                ฿{whtAmount.toFixed(2)}
              </div>
            </div>
          </div>

          {unpaidInvoices.length > 0 ? (
            <div className="space-y-3">
                <Money baht={whtAmount} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-gray-700">
              Select Supplier Invoices to Settle (Allocation)
            </label>
            {unpaidInvoices.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No unpaid posted invoices available for this supplier.</p>
            ) : (
              unpaidInvoices.map((inv) => {
                const outstanding = (inv.totalMinor - inv.amountPaidMinor) / 100;
                const isChecked = selectedInvoiceIds.includes(inv.id);
                return (
                  <div
                    key={inv.id}
                    onClick={() => toggleInvoiceSelection(inv.id)}
                    className={`p-3 border rounded-lg cursor-pointer flex items-center justify-between text-xs transition-colors ${
                      isChecked ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-gray-900">{inv.code}</span>
                      <span className="text-gray-400 ml-2">({new Date(inv.issueDate).toLocaleDateString()})</span>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Outstanding: <Money baht={outstanding} /> | Due: {new Date(inv.dueDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="w-36 flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500">฿</span>
                      <input
                        type="number"
                        min={0}
                        max={outstanding}
                        step="0.01"
                        value={allocations[inv.id] || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setAllocations(prev => ({ ...prev, [inv.id]: val }));
                        }}
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-blue-500 font-mono text-right"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-4 border-t flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setViewMode('list')}>
              Cancel
            </Button>
            <Button type="submit" disabled={paymentAmount <= 0}>
              Confirm Payment & Tax Withholding
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (viewMode === 'view-po' && selectedPoDetails) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewMode('list')} className="p-2 border rounded-lg hover:bg-gray-50 transition-colors text-gray-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              Purchase Order Details: {selectedPoDetails.code}
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                selectedPoDetails.status === 'APPROVED' ? 'bg-green-50 text-green-700 border border-green-200' :
                selectedPoDetails.status === 'DRAFT' ? 'bg-gray-100 text-gray-700' :
                selectedPoDetails.status === 'PENDING_APPROVAL' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {selectedPoDetails.status}
              </span>
            </h1>
            <p className="text-xs text-gray-500">Audit details of PO contract agreement.</p>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-400 mb-1">Supplier</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700">{selectedPoDetails.supplier.name}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Credit Terms (Days)</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700">{selectedPoDetails.creditTermDays}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Order Date</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700">
                {new Date(selectedPoDetails.orderDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Expected Delivery Date</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700">
                {selectedPoDetails.expectedDeliveryDate ? new Date(selectedPoDetails.expectedDeliveryDate).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Notes</label>
            <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700 min-h-16 whitespace-pre-wrap">
              {selectedPoDetails.notes || 'No notes added'}
            </div>
          </div>

          {selectedPoDetails.lines && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900 border-b pb-2">Line Items</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-100 font-semibold border-b text-gray-700">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-center">Ordered Qty</th>
                      <th className="p-3 text-center">Received Qty</th>
                      <th className="p-3 text-center">Invoiced Qty</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPoDetails.lines.map((line: any, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-semibold text-gray-800">{line.product.name} ({line.product.code})</td>
                        <td className="p-3 text-center font-mono">{line.quantityOrdered}</td>
                        <td className="p-3 text-center font-mono">{line.quantityReceived}</td>
                        <td className="p-3 text-center font-mono">{line.quantityInvoiced}</td>
                        <td className="p-3 text-right font-mono"><Money minor={line.unitPriceMinor} /></td>
                        <td className="p-3 text-right font-mono font-semibold"><Money minor={line.quantityOrdered * line.unitPriceMinor} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="pt-4 border-t flex justify-end">
            <Button type="button" variant="outline" onClick={() => setViewMode('list')}>
              Return to Workspace
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'view-gr' && selectedGrDetails) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewMode('list')} className="p-2 border rounded-lg hover:bg-gray-50 transition-colors text-gray-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Goods Receipt Details: {selectedGrDetails.code}</h1>
            <p className="text-xs text-gray-500">Audit details of inventory check-in log.</p>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Linked PO Reference</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700">{selectedGrDetails.purchaseOrder?.code ?? 'N/A'}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Received By</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700">{selectedGrDetails.receivedBy.name}</div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Receipt Committed Date</label>
            <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700">
              {new Date(selectedGrDetails.receivedDate).toLocaleString()}
            </div>
          </div>

          {selectedGrDetails.lines && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900 border-b pb-2">Inbound Check-in Items</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-100 font-semibold border-b text-gray-700">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-center">Received Qty</th>
                      <th className="p-3">Lot Number</th>
                      <th className="p-3">Expiry Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGrDetails.lines.map((line: any, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-semibold text-gray-800">{line.product.name} ({line.product.code})</td>
                        <td className="p-3 text-center font-mono">{line.quantityReceived}</td>
                        <td className="p-3 font-mono">{line.lotNumber || 'N/A'}</td>
                        <td className="p-3">{line.expiryDate ? new Date(line.expiryDate).toLocaleDateString() : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="pt-4 border-t flex justify-end">
            <Button type="button" variant="outline" onClick={() => setViewMode('list')}>
              Return to Workspace
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'view-invoice' && selectedInvoiceDetails) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewMode('list')} className="p-2 border rounded-lg hover:bg-gray-50 transition-colors text-gray-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              Purchase Invoice Details: {selectedInvoiceDetails.code}
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                selectedInvoiceDetails.matchStatus === 'MATCHED' ? 'bg-green-50 text-green-700 border border-green-200' :
                selectedInvoiceDetails.matchStatus === 'TOLERANCE_APPROVED' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                selectedInvoiceDetails.matchStatus === 'EXCEPTION' ? 'bg-red-50 text-red-700 border border-red-200' :
                'bg-gray-100 text-gray-700'
              }`}>
                Match: {selectedInvoiceDetails.matchStatus}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                selectedInvoiceDetails.status === 'POSTED' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                selectedInvoiceDetails.status === 'PAID' ? 'bg-green-50 text-green-700 border border-green-200' :
                selectedInvoiceDetails.status === 'PARTIALLY_PAID' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-gray-100 text-gray-700'
              }`}>
                {selectedInvoiceDetails.status}
              </span>
            </h1>
            <p className="text-xs text-gray-500">Auditing and tax allocation ledger details.</p>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Supplier</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700">{selectedInvoiceDetails.supplier.name}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Link Purchase Order</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700">{selectedInvoiceDetails.purchaseOrder?.code ?? 'N/A'}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Vendor Invoice #</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700 font-mono">{selectedInvoiceDetails.invoiceNumber}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Invoice Date</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700">
                {new Date(selectedInvoiceDetails.invoiceDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Due Date</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700">
                {new Date(selectedInvoiceDetails.dueDate).toLocaleDateString()}
              </div>
            </div>
          </div>

          {selectedInvoiceDetails.lines && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900 border-b pb-2">Invoice Line Items</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-100 font-semibold border-b text-gray-700">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-center">Invoice Qty</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">VAT Rate</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoiceDetails.lines.map((line: any, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-semibold text-gray-800">{line.product.name} ({line.product.code})</td>
                        <td className="p-3 text-center font-mono">{line.quantity}</td>
                        <td className="p-3 text-right font-mono"><Money minor={line.unitPriceMinor} /></td>
                        <td className="p-3 text-right font-mono">{(line.taxRateBps / 100)}%</td>
                        <td className="p-3 text-right font-mono font-semibold"><Money minor={line.totalMinor} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex justify-end gap-6 text-xs text-gray-700 pt-2 border-t font-medium">
                <div>Subtotal: <span className="font-mono"><Money minor={selectedInvoiceDetails.subtotalMinor} /></span></div>
                <div>Tax: <span className="font-mono"><Money minor={selectedInvoiceDetails.taxTotalMinor} /></span></div>
                <div className="font-bold text-gray-900">Total: <span className="font-mono"><Money minor={selectedInvoiceDetails.totalMinor} /></span></div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t flex justify-end gap-2">
            {selectedInvoiceDetails.matchStatus !== 'PENDING' && (
              <button
                onClick={async () => {
                  const r = await apiClient.post<any>(`/procurement/purchase-invoices/${selectedInvoiceDetails.id}/match`, {});
                  setSelectedMatchResult(r);
                }}
                className="inline-flex items-center px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded border border-indigo-100 hover:bg-indigo-100"
              >
                View Match Result Logs
              </button>
            )}
            <Button type="button" variant="outline" onClick={() => setViewMode('list')}>
              Return to Workspace
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'view-payment' && selectedPaymentDetails) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewMode('list')} className="p-2 border rounded-lg hover:bg-gray-50 transition-colors text-gray-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Supplier Payment Details: {selectedPaymentDetails.code}</h1>
            <p className="text-xs text-gray-500">Audit trail of allocations and withholding tax deductions.</p>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Supplier</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700">{selectedPaymentDetails.supplier.name}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Payment Date</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700">
                {new Date(selectedPaymentDetails.paymentDate).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Payment Method</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700 font-semibold text-indigo-600">{selectedPaymentDetails.paymentMethod}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Reference Number</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-700 font-mono">{selectedPaymentDetails.referenceNumber || 'N/A'}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t pt-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Payment Amount (฿)</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-gray-800 font-bold"><Money minor={selectedPaymentDetails.amountMinor} /></div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Withholding Tax (WHT %)</label>
              <div className="w-full bg-gray-50 border rounded px-3 py-2 text-sm text-red-600 font-semibold">{(selectedPaymentDetails.whtRateBps / 100)}%</div>
            </div>
            <div>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPaymentDetails.allocations.map((alloc: any, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-semibold text-gray-800">{alloc.invoice.code}</td>
                        <td className="p-3 text-right font-mono">฿{(alloc.invoice.totalMinor / 100).toFixed(2)}</td>
                        <td className="p-3 text-right font-mono font-semibold text-green-600">฿{(alloc.amountAllocatedMinor / 100).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="pt-4 border-t flex justify-end">
            <Button type="button" variant="outline" onClick={() => setViewMode('list')}>
              Return to Workspace
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-7 h-7 text-blue-600" />
            {activeTab === 'pos' && 'ใบสั่งซื้อ (Purchase Orders)'}
            {activeTab === 'grs' && 'ใบรับสินค้า (Goods Receipts)'}
            {activeTab === 'invoices' && 'ใบแจ้งหนี้ผู้ขาย (Purchase Invoices)'}
            {activeTab === 'payments' && 'การชำระเงินผู้ขาย (Supplier Payments)'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage purchase orders, goods receipts, supplier invoices, and digital payments.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/clinic/procurement/analytics">
            <Button size="sm" variant="outline" className="flex items-center gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50">
              <TrendingUp className="w-4 h-4" />
              Vendor Scorecards & KPIs
            </Button>
          </Link>
          
          {activeTab === 'pos' && (
            <Button size="sm" onClick={openPoCreatePage}>
              <Plus className="w-4 h-4 mr-2" />
              New Purchase Order
            </Button>
          )}
          {activeTab === 'grs' && (
            <Button size="sm" onClick={openGrCreatePage}>
              <Plus className="w-4 h-4 mr-2" />
              Receive Inbound Goods
            </Button>
          )}
          {activeTab === 'invoices' && (
            <Button size="sm" onClick={openInvoiceCreatePage}>
              <Plus className="w-4 h-4 mr-2" />
              New Purchase Invoice
            </Button>
          )}
          {activeTab === 'payments' && (
            <Button size="sm" onClick={openPaymentCreatePage}>
              <Plus className="w-4 h-4 mr-2" />
              Record Supplier Payment
            </Button>
          )}
        </div>
      </div>

      {/* Main Table Views */}
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
                <th className="p-3">Expected Del.</th>
                <th className="p-3">Status</th>
                <th className="p-3">Total Amount</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">No Purchase Orders found.</td>
                </tr>
              ) : (
                pos.map(po => (
                  <tr key={po.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-medium text-gray-900">{po.code}</td>
                    <td className="p-3">{po.supplier.name}</td>
                    <td className="p-3">{new Date(po.orderDate).toLocaleDateString()}</td>
                    <td className="p-3">{po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : 'N/A'}</td>
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
                    <td className="p-3 font-medium"><Money minor={po.totalMinor} /></td>
                    <td className="p-3 text-right flex justify-end gap-2">
                      <button
                        onClick={() => showPoDetails(po.id)}
                        className="inline-flex items-center px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded border border-gray-100 hover:bg-gray-100"
                      >
                        <Eye className="w-3 h-3 mr-1" /> View
                      </button>
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
      ) : activeTab === 'grs' ? (
        <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-gray-50 border-b text-gray-700 font-semibold">
              <tr>
                <th className="p-3">GR Code</th>
                <th className="p-3">Received Date</th>
                <th className="p-3">Received By</th>
                <th className="p-3">Linked PO</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {grs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">No Goods Receipts found.</td>
                </tr>
              ) : (
                grs.map(gr => (
                  <tr key={gr.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-medium text-gray-900">{gr.code}</td>
                    <td className="p-3">{new Date(gr.receivedDate).toLocaleString()}</td>
                    <td className="p-3">{gr.receivedBy.name}</td>
                    <td className="p-3">{gr.purchaseOrder?.code ?? 'N/A'}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => showGrDetails(gr.id)}
                        className="inline-flex items-center px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded border border-gray-100 hover:bg-gray-100"
                      >
                        <Eye className="w-3 h-3 mr-1" /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'invoices' ? (
        <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-gray-50 border-b text-gray-700 font-semibold">
              <tr>
                <th className="p-3">Invoice Code</th>
                <th className="p-3">Vendor Invoice #</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Invoice Date</th>
                <th className="p-3">Due Date</th>
                <th className="p-3">Match Status</th>
                <th className="p-3">Total Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">No Purchase Invoices found.</td>
                </tr>
              ) : (
                invoices.map(inv => (
                  <tr key={inv.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-medium text-gray-900">{inv.code}</td>
                    <td className="p-3 font-mono">{inv.invoiceNumber}</td>
                    <td className="p-3">{inv.supplier.name}</td>
                    <td className="p-3">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                    <td className="p-3">{new Date(inv.dueDate).toLocaleDateString()}</td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        inv.matchStatus === 'MATCHED' ? 'bg-green-50 text-green-700 border border-green-200' :
                        inv.matchStatus === 'TOLERANCE_APPROVED' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        inv.matchStatus === 'EXCEPTION' ? 'bg-red-50 text-red-700 border border-red-200 animate-pulse' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {inv.matchStatus}
                      </span>
                    </td>
                    <td className="p-3 font-medium"><Money minor={inv.totalMinor} /></td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        inv.status === 'POSTED' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                        inv.status === 'PAID' ? 'bg-green-50 text-green-700 border border-green-200' :
                        inv.status === 'PARTIALLY_PAID' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        inv.status === 'VOIDED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-3 text-right flex justify-end gap-2">
                      <button
                        onClick={() => showInvoiceDetails(inv.id)}
                        className="inline-flex items-center px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded border border-gray-100 hover:bg-gray-100"
                      >
                        <Eye className="w-3 h-3 mr-1" /> View
                      </button>
                      
                      {inv.status === 'DRAFT' && (
                        <>
                          <button
                            onClick={() => runThreeWayMatch(inv.id)}
                            disabled={matchingInvoiceId === inv.id}
                            className="inline-flex items-center px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded border border-amber-100 hover:bg-amber-100 disabled:opacity-50"
                          >
                            {matchingInvoiceId === inv.id ? 'Matching...' : '3-Way Match'}
                          </button>
                          
                          {inv.matchStatus !== 'PENDING' && inv.matchStatus !== 'EXCEPTION' && (
                            <button
                              onClick={() => postInvoice(inv.id)}
                              className="inline-flex items-center px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded border border-indigo-100 hover:bg-indigo-100"
                            >
                              <FileCheck2 className="w-3 h-3 mr-1" /> Post
                            </button>
                          )}
                        </>
                      )}
                      
                      {inv.status !== 'PAID' && inv.status !== 'VOIDED' && (
                        <button
                          onClick={() => voidInvoice(inv.id)}
                          className="inline-flex items-center px-2 py-1 text-xs bg-red-50 text-red-700 rounded border border-red-100 hover:bg-red-100"
                        >
                          Void
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
                <th className="p-3">Payment Code</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Payment Date</th>
                <th className="p-3">Method</th>
                <th className="p-3">Reference #</th>
                <th className="p-3">WHT Deducted</th>
                <th className="p-3">Paid Amount</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">No Supplier Payments found.</td>
                </tr>
              ) : (
                payments.map(pay => (
                  <tr key={pay.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-medium text-gray-900">{pay.code}</td>
                    <td className="p-3">{pay.supplier.name}</td>
                    <td className="p-3">{new Date(pay.paymentDate).toLocaleDateString()}</td>
                    <td className="p-3 font-semibold text-xs text-indigo-600">{pay.paymentMethod}</td>
                    <td className="p-3 font-mono text-xs">{pay.referenceNumber ?? 'N/A'}</td>
                    <td className="p-3 text-red-600 font-medium"><Money minor={pay.whtAmountMinor} /> ({pay.whtRateBps / 100}%)</td>
                    <td className="p-3 font-medium text-green-600"><Money minor={pay.amountMinor} /></td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => showPaymentDetails(pay.id)}
                        className="inline-flex items-center px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded border border-gray-100 hover:bg-gray-100"
                      >
                        <Eye className="w-3 h-3 mr-1" /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Matching Result Details Modal */}
      {selectedMatchResult && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-indigo-600" />
                  3-Way Match Verification Details
                </h2>
                <p className="text-xs text-gray-500 mt-1">Cross-check metrics between Purchase Order, Goods Receipt, and Supplier Invoice.</p>
              </div>
              <button onClick={() => setSelectedMatchResult(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className={`p-4 rounded-lg flex items-start gap-3 border ${
                selectedMatchResult.status === 'MATCHED' ? 'bg-green-50 border-green-200 text-green-800' :
                selectedMatchResult.status === 'TOLERANCE_APPROVED' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                'bg-red-50 border-red-200 text-red-800'
              }`}>
                {selectedMatchResult.status === 'MATCHED' ? (
                  <Check className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                ) : selectedMatchResult.status === 'TOLERANCE_APPROVED' ? (
                  <Info className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5 animate-bounce" />
                )}
                
                <div>
                  <h3 className="font-bold text-sm">
                    Match Status: {selectedMatchResult.status}
                  </h3>
                  <p className="text-xs mt-1">
                    {selectedMatchResult.status === 'MATCHED' && 'All invoice quantities and prices perfectly match procurement contracts and delivery receipts.'}
                    {selectedMatchResult.status === 'TOLERANCE_APPROVED' && 'Some discrepancies were found but they are within config-approved tolerance parameters.'}
                    {selectedMatchResult.status === 'EXCEPTION' && 'Attention Required: The invoice fails 3-way verification limits. Discrepancies exceed allowed thresholds.'}
                  </p>
                </div>
              </div>

              {selectedMatchResult.status === 'EXCEPTION' && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedMatchResult.lineResults.some((r: any) => r.status === 'EXCEPTION' && (r.discrepancyType === 'PRICE' || r.discrepancyType === 'BOTH')) && (
                    <div className="border border-amber-200 bg-amber-50 p-3.5 rounded-lg flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <h4 className="font-semibold text-xs text-amber-800">Procurement Team Exception Alert</h4>
                        <p className="text-[11px] text-amber-700 mt-1">Price mismatch detected exceeding threshold. This ticket has been automatically routed to Procurement for supplier renegotiation.</p>
                      </div>
                    </div>
                  )}

                  {selectedMatchResult.lineResults.some((r: any) => r.status === 'EXCEPTION' && (r.discrepancyType === 'QUANTITY' || r.discrepancyType === 'BOTH')) && (
                    <div className="border border-indigo-200 bg-indigo-50 p-3.5 rounded-lg flex gap-3">
                      <Info className="w-5 h-5 text-indigo-600 shrink-0" />
                      <div>
                        <h4 className="font-semibold text-xs text-indigo-800">Receiving Team Exception Alert</h4>
                        <p className="text-[11px] text-indigo-700 mt-1">Invoiced quantity exceeds Goods Receipt delivery records. This ticket has been automatically routed to Warehouse staff for check-in audits.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-100 font-semibold border-b text-gray-700">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-center">PO Qty</th>
                      <th className="p-3 text-center">GR Qty</th>
                      <th className="p-3 text-center">Inv Qty</th>
                      <th className="p-3 text-right">PO Price</th>
                      <th className="p-3 text-right">Inv Price</th>
                      <th className="p-3 text-center">Variance %</th>
                      <th className="p-3 text-center">Tolerance %</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMatchResult.lineResults.map((line: any, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-800">{line.productName}</td>
                        <td className="p-3 text-center font-mono">{line.poQuantity ?? 'N/A'}</td>
                        <td className="p-3 text-center font-mono">{line.grQuantity ?? 'N/A'}</td>
                        <td className="p-3 text-center font-mono font-semibold">{line.invoiceQuantity}</td>
                        <td className="p-3 text-right font-mono"><Money minor={line.poUnitPrice} /></td>
                        <td className="p-3 text-right font-mono font-semibold"><Money minor={line.invoiceUnitPrice} /></td>
                        <td className="p-3 text-center font-semibold font-mono">
                          {line.discrepancyType === 'PRICE' && <span className="text-amber-600">Price: {line.priceVariancePercent}%</span>}
                          {line.discrepancyType === 'QUANTITY' && <span className="text-indigo-600">Qty: {line.quantityVariancePercent}%</span>}
                          {line.discrepancyType === 'BOTH' && (
                            <span className="text-red-600">
                              P: {line.priceVariancePercent}% / Q: {line.quantityVariancePercent}%
                            </span>
                          )}
                          {line.discrepancyType === null && <span className="text-green-600">0%</span>}
                        </td>
                        <td className="p-3 text-center font-mono text-gray-500">{line.tolerancePercent}%</td>
                        <td className="p-3 text-right">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            line.status === 'MATCHED' ? 'bg-green-50 text-green-700' :
                            line.status === 'TOLERANCE_APPROVED' ? 'bg-blue-50 text-blue-700' :
                            'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {line.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t flex justify-end">
              <Button size="sm" onClick={() => setSelectedMatchResult(null)}>Close Window</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
