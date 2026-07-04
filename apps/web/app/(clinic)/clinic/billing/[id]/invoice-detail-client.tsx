'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LineItem {
  id: string;
  itemType: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  subtotalMinor: number;
}

interface Invoice {
  id: string;
  visitId: string | null;
  patientId: string | null;
  ownerUserId: string | null;
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
}

function formatMinor(minor: number): string {
  return `฿${(minor / 100).toFixed(2)}`;
}

export default function InvoiceDetailClient({ invoice: initialInvoice }: { invoice: Invoice }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [actionLoading, setActionLoading] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [error, setError] = useState('');

  async function performAction(url: string, method = 'PATCH', body?: object) {
    setError('');
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
      setInvoice(json.data ?? json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleIssue() {
    await performAction(`/api/v1/billing/invoices/${invoice.id}/issue`);
  }

  async function handlePay() {
    await performAction(`/api/v1/billing/invoices/${invoice.id}/pay`);
  }

  async function handleVoid() {
    if (!voidReason.trim()) return;
    await performAction(`/api/v1/billing/invoices/${invoice.id}`, 'DELETE', { reason: voidReason });
    setShowVoidDialog(false);
    setVoidReason('');
  }

  const STATUS_BG: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    ISSUED: 'bg-yellow-100 text-yellow-700',
    PAID: 'bg-green-100 text-green-700',
    VOIDED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        ← Back to Billing
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Invoice</h1>
          <p className="text-xs text-gray-500 font-mono mt-1">{invoice.id}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_BG[invoice.status] ?? 'bg-gray-100'}`}>
          {invoice.status}
        </span>
      </div>

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
          <p>{new Date(invoice.createdAt).toLocaleDateString()}</p>
        </div>
        {invoice.issuedAt && (
          <div>
            <span className="text-gray-500">Issued</span>
            <p>{new Date(invoice.issuedAt).toLocaleDateString()}</p>
          </div>
        )}
        {invoice.paidAt && (
          <div>
            <span className="text-gray-500">Paid</span>
            <p>{new Date(invoice.paidAt).toLocaleDateString()}</p>
          </div>
        )}
        {invoice.voidedAt && (
          <div className="col-span-2">
            <span className="text-gray-500">Voided</span>
            <p className="text-red-600">{new Date(invoice.voidedAt).toLocaleDateString()} — {invoice.voidReason}</p>
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
      </div>

      {/* Actions */}
      {invoice.status !== 'VOIDED' && (
        <div className="flex gap-3">
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
          {(invoice.status === 'DRAFT' || invoice.status === 'ISSUED') && (
            <button
              onClick={() => setShowVoidDialog(true)}
              disabled={actionLoading}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm hover:bg-red-50 disabled:opacity-50"
            >
              Void
            </button>
          )}
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
