'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMinor } from '@/lib/currency';

interface LineItem {
  id: string;
  itemType: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  subtotalMinor: number;
  vatRateBps?: number;
  productId?: string | null;
  sourceReferenceId?: string | null;
}

interface LinkedDocument {
  id: string;
  code?: string | null;
  documentType: string;
  totalMinor: number;
  reasonCode?: string | null;
  status: string;
  createdAt: string;
}

interface ReferenceInvoice {
  id: string;
  code?: string | null;
  documentType: string;
  totalMinor: number;
  status: string;
}

interface Invoice {
  id: string;
  code?: string | null;
  visitId: string | null;
  patientId: string | null;
  ownerUserId: string | null;
  documentType?: string;
  referenceInvoiceId?: string | null;
  reasonCode?: string | null;
  subtotalMinor: number;
  taxRateBps: number;
  taxTotalMinor: number;
  totalMinor: number;
  status: string;
  issuedAt?: string;
  paidAt?: string;
  voidedAt?: string;
  voidReason?: string;
  createdAt: string;
  lineItems: LineItem[];
  creditNotes?: LinkedDocument[];
  referenceInvoice?: ReferenceInvoice | null;
}

const REASON_CODES_CN = {
  WRONG_PRICE: 'WRONG_PRICE - คิดเงินเกิน / ราคาผิด',
  DEFECTIVE: 'DEFECTIVE - สินค้าชำรุด / เสียหาย',
  CUSTOMER_RETURN: 'CUSTOMER_RETURN - คืนสินค้า / ยกเลิกบริการ',
  OTHER: 'OTHER - อื่นๆ',
};

const REASON_CODES_DN = {
  UNDERCHARGED: 'UNDERCHARGED - คิดเงินขาด',
  ADDITIONAL_SERVICE: 'ADDITIONAL_SERVICE - บริการเพิ่มเติม',
  PRICE_ADJUSTMENT: 'PRICE_ADJUSTMENT - ปรับราคา',
  OTHER: 'OTHER - อื่นๆ',
};

const DOC_TYPE_LABEL: Record<string, string> = {
  INVOICE: 'Invoice',
  CREDIT_NOTE: 'ใบลดหนี้ (CN)',
  DEBIT_NOTE: 'ใบเพิ่มหนี้ (DN)',
};

const DOC_TYPE_BG: Record<string, string> = {
  CREDIT_NOTE: 'bg-purple-100 text-purple-700',
  DEBIT_NOTE: 'bg-orange-100 text-orange-700',
};

function formatDate(dateInput?: string | null) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function InvoiceDetailClient({ invoice: initialInvoice }: { invoice: Invoice }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [actionLoading, setActionLoading] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function performAction(url: string, method = 'PATCH', body?: object) {
    setError('');
    setSuccessMessage('');
    setActionLoading(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? 'Action failed');
      }
      const json = await res.json();
      return json.data ?? json;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      return null;
    } finally {
      setActionLoading(false);
    }
  }

  async function refreshInvoice() {
    try {
      const res = await fetch(`/api/v1/billing/invoices/${invoice.id}`);
      if (res.ok) {
        const json = await res.json();
        setInvoice(json.data ?? json);
      }
    } catch {
      // Silently fail refresh
    }
  }

  async function handleIssue() {
    const result = await performAction(`/api/v1/billing/invoices/${invoice.id}/issue`);
    if (result) setInvoice(result);
  }

  async function handlePay() {
    const result = await performAction(`/api/v1/billing/invoices/${invoice.id}/pay`);
    if (result) setInvoice(result);
  }

  async function handleVoid() {
    if (!voidReason.trim()) return;
    const result = await performAction(`/api/v1/billing/invoices/${invoice.id}`, 'DELETE', { reason: voidReason });
    if (result) setInvoice(result);
    setShowVoidDialog(false);
    setVoidReason('');
  }

  // ── Itemized Adjustment Modal State ──────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [adjType, setAdjType] = useState<'CREDIT_NOTE' | 'DEBIT_NOTE'>('CREDIT_NOTE');
  const [reasonCode, setReasonCode] = useState('WRONG_PRICE');
  const [reason, setReason] = useState('');
  const [itemStates, setItemStates] = useState<
    Record<
      string,
      {
        selected: boolean;
        adjustQty: number;
        adjustAmountMinor: number;
        returnToStock: boolean;
      }
    >
  >({});

  function openAdjustmentModal(type: 'CREDIT_NOTE' | 'DEBIT_NOTE') {
    setAdjType(type);
    setReasonCode(type === 'CREDIT_NOTE' ? 'WRONG_PRICE' : 'UNDERCHARGED');
    setReason('');

    // Initialize item states
    const initial: Record<
      string,
      { selected: boolean; adjustQty: number; adjustAmountMinor: number; returnToStock: boolean }
    > = {};

    invoice.lineItems.forEach((li) => {
      initial[li.id] = {
        selected: true,
        adjustQty: Number(li.quantity),
        adjustAmountMinor: li.subtotalMinor,
        returnToStock: li.itemType === 'PRODUCT',
      };
    });

    setItemStates(initial);
    setShowModal(true);
  }

  function handleQtyChange(itemId: string, origUnitPrice: number, maxQty: number, valStr: string) {
    const parsed = parseFloat(valStr);
    const validQty = isNaN(parsed) ? 0 : Math.max(0, Math.min(maxQty, parsed));
    const autoAmount = Math.round(validQty * origUnitPrice);

    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        adjustQty: validQty,
        adjustAmountMinor: autoAmount,
      },
    }));
  }

  function handleAmountChange(itemId: string, maxAmount: number, valStr: string) {
    const parsed = parseInt(valStr, 10);
    const validAmount = isNaN(parsed) ? 0 : Math.max(0, Math.min(maxAmount, parsed));

    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        adjustAmountMinor: validAmount,
      },
    }));
  }

  function toggleItemSelect(itemId: string) {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        selected: !prev[itemId]?.selected,
      },
    }));
  }

  function toggleReturnToStock(itemId: string) {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        returnToStock: !prev[itemId]?.returnToStock,
      },
    }));
  }

  // Calculate live preview totals for the modal
  const selectedLineItems = invoice.lineItems.filter((li) => itemStates[li.id]?.selected);
  const liveSubtotal = selectedLineItems.reduce((sum, li) => sum + (itemStates[li.id]?.adjustAmountMinor || 0), 0);
  const liveVat = selectedLineItems.reduce((sum, li) => {
    const amt = itemStates[li.id]?.adjustAmountMinor || 0;
    const vatRateBps = li.vatRateBps ?? invoice.taxRateBps ?? 0;
    return sum + Math.round(amt * (vatRateBps / 10000));
  }, 0);
  const liveTotal = liveSubtotal + liveVat;

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;

    if (selectedLineItems.length === 0) {
      setError('Please select at least one item to adjust');
      return;
    }

    const payload = {
      type: adjType,
      reasonCode,
      reason,
      items: selectedLineItems.map((li) => ({
        originalItemId: li.id,
        adjustQty: itemStates[li.id].adjustQty,
        adjustAmountMinor: itemStates[li.id].adjustAmountMinor,
        returnToStock: itemStates[li.id].returnToStock ?? false,
      })),
    };

    const result = await performAction(
      `/api/v1/billing/invoices/${invoice.id}/itemized-adjustment`,
      'POST',
      payload,
    );

    if (result) {
      const typeLabel = adjType === 'CREDIT_NOTE' ? 'ใบลดหนี้' : 'ใบเพิ่มหนี้';
      setSuccessMessage(`${typeLabel} ${result.code || result.id} สร้างสำเร็จ (Adjustment created successfully)`);
      setShowModal(false);
      setReason('');
      await refreshInvoice();
    }
  }

  const STATUS_BG: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    ISSUED: 'bg-yellow-100 text-yellow-700',
    PAID: 'bg-green-100 text-green-700',
    VOIDED: 'bg-red-100 text-red-700',
    CREDIT_NOTE: 'bg-purple-100 text-purple-700',
  };

  const isOriginalInvoice = invoice.documentType === 'INVOICE' || !invoice.documentType;
  const linkedDocuments = invoice.creditNotes ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        ← Back to Billing
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {DOC_TYPE_LABEL[invoice.documentType ?? 'INVOICE'] ?? 'Invoice'}{' '}
            {invoice.code ? <span className="font-mono text-blue-600">#{invoice.code}</span> : ''}
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-1">ID: {invoice.id}</p>
          {invoice.referenceInvoice && (
            <p className="text-xs text-gray-500 mt-1">
              อ้างอิง (Ref):{' '}
              <a
                href={`/clinic/billing/${invoice.referenceInvoice.id}`}
                className="text-blue-600 hover:underline font-mono"
              >
                #{invoice.referenceInvoice.code ?? invoice.referenceInvoice.id}
              </a>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_BG[invoice.status] ?? 'bg-gray-100'}`}>
            {invoice.status}
          </span>
          {invoice.documentType && invoice.documentType !== 'INVOICE' && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DOC_TYPE_BG[invoice.documentType] ?? 'bg-gray-100'}`}>
              {DOC_TYPE_LABEL[invoice.documentType]}
            </span>
          )}
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700 flex items-center justify-between">
          <span>✅ {successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="text-green-500 hover:text-green-700 text-xs ml-2">✕</button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Meta */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6 p-4 bg-gray-50 rounded-lg">
        <div>
          <span className="text-gray-500">Patient ID</span>
          <p className="font-mono">{invoice.patientId}</p>
        </div>
        <div>
          <span className="text-gray-500">Visit ID</span>
          <p className="font-mono">{invoice.visitId}</p>
        </div>
        <div>
          <span className="text-gray-500">Created</span>
          <p>{formatDate(invoice.createdAt)}</p>
        </div>
        {invoice.issuedAt && (
          <div>
            <span className="text-gray-500">Issued</span>
            <p>{formatDate(invoice.issuedAt)}</p>
          </div>
        )}
        {invoice.paidAt && (
          <div>
            <span className="text-gray-500">Paid</span>
            <p>{formatDate(invoice.paidAt)}</p>
          </div>
        )}
        {invoice.voidedAt && (
          <div className="col-span-2">
            <span className="text-gray-500">Voided</span>
            <p className="text-red-600">{formatDate(invoice.voidedAt)} — {invoice.voidReason}</p>
          </div>
        )}
        {invoice.reasonCode && (
          <div className="col-span-2">
            <span className="text-gray-500">Reason Code</span>
            <p className="font-mono">{invoice.reasonCode}</p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-2">Line Items</h2>
        <table className="w-full text-sm border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-2 text-left">Description</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Unit Price</th>
              <th className="px-4 py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoice.lineItems.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-gray-400 text-xs">
                  No line items
                </td>
              </tr>
            )}
            {invoice.lineItems.map((li) => (
              <tr key={li.id}>
                <td className="px-4 py-2">{li.description}</td>
                <td className="px-4 py-2 text-gray-500 text-xs">{li.itemType}</td>
                <td className="px-4 py-2 text-right">{li.quantity}</td>
                <td className="px-4 py-2 text-right">{formatMinor(li.unitPriceMinor)}</td>
                <td className="px-4 py-2 text-right font-medium">{formatMinor(li.subtotalMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex flex-col items-end gap-1 text-sm mb-6">
        <div className="flex gap-8">
          <span className="text-gray-500">Subtotal</span>
          <span>{formatMinor(invoice.subtotalMinor)}</span>
        </div>
        <div className="flex gap-8">
          <span className="text-gray-500">VAT ({(invoice.taxRateBps / 100).toFixed(0)}%)</span>
          <span>{formatMinor(invoice.taxTotalMinor)}</span>
        </div>
        <div className="flex gap-8 font-bold text-base border-t pt-1 mt-1">
          <span>Total</span>
          <span>{formatMinor(invoice.totalMinor)}</span>
        </div>
        {linkedDocuments.length > 0 && (
          <div className="w-full flex flex-col items-end gap-1 mt-2 pt-2 border-t border-dashed border-gray-300">
            {linkedDocuments.some((d) => d.documentType === 'CREDIT_NOTE') && (
              <div className="flex gap-8 text-xs text-purple-700 font-medium">
                <span>ยอดลดหนี้สะสม (Total Credit Notes)</span>
                <span>
                  -
                  {formatMinor(
                    linkedDocuments
                      .filter((d) => d.documentType === 'CREDIT_NOTE')
                      .reduce((sum, d) => sum + Math.abs(d.totalMinor), 0),
                  )}
                </span>
              </div>
            )}
            {linkedDocuments.some((d) => d.documentType === 'DEBIT_NOTE') && (
              <div className="flex gap-8 text-xs text-orange-700 font-medium">
                <span>ยอดเพิ่มหนี้สะสม (Total Debit Notes)</span>
                <span>
                  +
                  {formatMinor(
                    linkedDocuments
                      .filter((d) => d.documentType === 'DEBIT_NOTE')
                      .reduce((sum, d) => sum + Math.abs(d.totalMinor), 0),
                  )}
                </span>
              </div>
            )}
            <div className="flex gap-8 font-bold text-sm text-blue-900 bg-blue-50 px-3 py-1.5 rounded-md mt-1 border border-blue-200">
              <span>ยอดสุทธิหลังปรับปรุง (Net Balance)</span>
              <span>
                {formatMinor(
                  invoice.totalMinor -
                    linkedDocuments
                      .filter((d) => d.documentType === 'CREDIT_NOTE')
                      .reduce((sum, d) => sum + Math.abs(d.totalMinor), 0) +
                    linkedDocuments
                      .filter((d) => d.documentType === 'DEBIT_NOTE')
                      .reduce((sum, d) => sum + Math.abs(d.totalMinor), 0),
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Linked Documents (CN/DN) */}
      {linkedDocuments.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-2">📑 เอกสารที่เชื่อมโยง (Linked Documents)</h2>
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-2 text-left">Document</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Reason</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {linkedDocuments.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <a
                      href={`/clinic/billing/${doc.id}`}
                      className="text-blue-600 hover:underline font-mono text-xs"
                    >
                      #{doc.code ?? doc.id.slice(0, 8)}
                    </a>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DOC_TYPE_BG[doc.documentType] ?? 'bg-gray-100'}`}>
                      {DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{doc.reasonCode ?? '—'}</td>
                  <td className={`px-4 py-2 text-right font-medium ${doc.totalMinor < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatMinor(doc.totalMinor)}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {formatDate(doc.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      {invoice.status !== 'VOIDED' && isOriginalInvoice && (
        <div className="flex flex-wrap gap-3">
          {invoice.status === 'DRAFT' && (
            <button
              onClick={handleIssue}
              disabled={actionLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Issue Invoice
            </button>
          )}
          {invoice.status === 'ISSUED' && (
            <button
              onClick={handlePay}
              disabled={actionLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
            >
              Mark as Paid
            </button>
          )}
          {invoice.status === 'PAID' && (
            <>
              <button
                onClick={() => openAdjustmentModal('CREDIT_NOTE')}
                disabled={actionLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 disabled:opacity-50 shadow-sm"
              >
                📄 ออกใบลดหนี้ (Issue Credit Note / Refund)
              </button>
              <button
                onClick={() => openAdjustmentModal('DEBIT_NOTE')}
                disabled={actionLoading}
                className="px-4 py-2 bg-orange-600 text-white rounded-md text-sm hover:bg-orange-700 disabled:opacity-50 shadow-sm"
              >
                📄 ออกใบเพิ่มหนี้ (Issue Debit Note)
              </button>
            </>
          )}
          {(invoice.status === 'DRAFT' || invoice.status === 'ISSUED') && (
            <>
              <button
                onClick={() => setShowVoidDialog(true)}
                disabled={actionLoading}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm hover:bg-red-50 disabled:opacity-50"
              >
                Void
              </button>
              <div className="w-full text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-md mt-1">
                💡 <b>คำแนะนำ:</b> ปุ่มออกใบลดหนี้ (Credit Note) และใบเพิ่มหนี้ (Debit Note) จะแสดงเมื่อกดชำระเงิน Invoice เป็นสถานะ <b>PAID</b> แล้วเท่านั้น (กรุณากด Mark as Paid ก่อน)
              </div>
            </>
          )}
        </div>
      )}

      {/* Itemized Adjustment Modal (CN & DN) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <form onSubmit={handleFormSubmit} className="bg-white rounded-lg p-6 max-w-2xl w-full shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {adjType === 'CREDIT_NOTE' ? 'ออกใบลดหนี้รายรายการ (Itemized Credit Note)' : 'ออกใบเพิ่มหนี้รายรายการ (Itemized Debit Note)'}
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${DOC_TYPE_BG[adjType]}`}>
                {DOC_TYPE_LABEL[adjType]}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">รหัสเหตุผล (Reason Code) *</label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                >
                  {Object.entries(adjType === 'CREDIT_NOTE' ? REASON_CODES_CN : REASON_CODES_DN).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">รายละเอียด / หมายเหตุ *</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  placeholder={adjType === 'CREDIT_NOTE' ? 'ระบุเหตุผลการคืนสินค้า/ลดหนี้...' : 'ระบุเหตุผลการเพิ่มหนี้...'}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Table of Original Invoice Items */}
            <div>
              <label className="block text-xs font-semibold text-gray-800 mb-2">
                รายการสินค้า/บริการที่ต้องการปรับปรุง (Select & Adjust Items)
              </label>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 text-gray-600 uppercase border-b">
                    <tr>
                      <th className="px-3 py-2 text-center w-10">เลือก</th>
                      <th className="px-3 py-2">รายการ</th>
                      <th className="px-3 py-2 text-right">จำนวนที่ปรับ</th>
                      <th className="px-3 py-2 text-right">ยอดปรับปรุง (สตางค์/฿)</th>
                      <th className="px-3 py-2 text-center">คืนสต็อก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoice.lineItems.map((li) => {
                      const state = itemStates[li.id] || {
                        selected: false,
                        adjustQty: Number(li.quantity),
                        adjustAmountMinor: li.subtotalMinor,
                        returnToStock: li.itemType === 'PRODUCT',
                      };

                      return (
                        <tr key={li.id} className={state.selected ? 'bg-purple-50/40' : 'opacity-60'}>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={state.selected}
                              onChange={() => toggleItemSelect(li.id)}
                              className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-900">{li.description}</p>
                            <p className="text-[10px] text-gray-500">
                              เดิม: {li.quantity} {li.itemType} @ {formatMinor(li.unitPriceMinor)} (สุทธิ {formatMinor(li.subtotalMinor)})
                            </p>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              max={Number(li.quantity)}
                              disabled={!state.selected}
                              value={state.adjustQty}
                              onChange={(e) => handleQtyChange(li.id, li.unitPriceMinor, Number(li.quantity), e.target.value)}
                              className="w-20 border rounded px-2 py-1 text-right text-xs focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="1"
                              max={li.subtotalMinor}
                              disabled={!state.selected}
                              value={state.adjustAmountMinor}
                              onChange={(e) => handleAmountChange(li.id, li.subtotalMinor, e.target.value)}
                              className="w-24 border rounded px-2 py-1 text-right text-xs focus:ring-2 focus:ring-purple-500 font-mono disabled:bg-gray-100"
                            />
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              = {formatMinor(state.adjustAmountMinor)}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {li.itemType === 'PRODUCT' ? (
                              <input
                                type="checkbox"
                                checked={state.returnToStock}
                                disabled={!state.selected || adjType === 'DEBIT_NOTE'}
                                onChange={() => toggleReturnToStock(li.id)}
                                className="rounded text-green-600 focus:ring-green-500 h-4 w-4 disabled:opacity-40"
                              />
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Live Calculation Preview */}
            <div className="bg-gray-50 p-3 rounded-lg flex flex-col items-end gap-1 text-xs border">
              <div className="flex justify-between w-48">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatMinor(liveSubtotal)}</span>
              </div>
              <div className="flex justify-between w-48">
                <span className="text-gray-500">VAT (7%)</span>
                <span>{formatMinor(liveVat)}</span>
              </div>
              <div className="flex justify-between w-48 font-bold text-sm text-purple-900 border-t pt-1 mt-0.5">
                <span>Grand Total</span>
                <span>{adjType === 'CREDIT_NOTE' ? '-' : '+'}{formatMinor(liveTotal)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded-md text-sm text-gray-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={!reason.trim() || selectedLineItems.length === 0 || actionLoading}
                className={`px-4 py-2 text-white rounded-md text-sm disabled:opacity-50 font-medium ${
                  adjType === 'CREDIT_NOTE' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {actionLoading ? 'กำลังสร้าง…' : `ยืนยันออก${DOC_TYPE_LABEL[adjType]}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Void Dialog */}
      {showVoidDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-base font-semibold mb-2">Void Invoice</h3>
            <p className="text-sm text-gray-500 mb-4">Please provide a reason for voiding this invoice.</p>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
              className="w-full border rounded-md px-3 py-2 text-sm resize-none mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="Reason for voiding…"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowVoidDialog(false)}
                className="px-4 py-2 border rounded-md text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleVoid}
                disabled={!voidReason.trim() || actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
              >
                Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
