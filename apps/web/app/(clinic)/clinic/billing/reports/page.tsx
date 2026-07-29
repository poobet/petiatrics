'use client';

import { useState } from 'react';
import { formatMinor } from '@/lib/currency';

interface Invoice {
  id: string;
  totalMinor: number;
  status: string;
  paidAt?: string;
  createdAt: string;
}

interface ReportData {
  invoices: Invoice[];
  revenueMinor: number;
  outstandingMinor: number;
  periodFrom: string;
  periodTo: string;
}

function getDefaultDates() {
  const to = new Date();
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function FinancialReportsPage() {
  const defaults = getDefaultDates();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadReport() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/billing/reports?from=${from}&to=${to}`);
      if (!res.ok) throw new Error('Failed to load report');
      const json = await res.json();
      setReport(json.data ?? json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const paidInvoices = report?.invoices.filter((i) => i.status === 'PAID') ?? [];
  const issuedInvoices = report?.invoices.filter((i) => i.status === 'ISSUED') ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Financial Reports</h1>

      {/* Date Range Filter */}
      <div className="flex items-end gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
        <div>
          <label htmlFor="from" className="block text-sm font-medium text-gray-700 mb-1">
            From
          </label>
          <input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="to" className="block text-sm font-medium text-gray-700 mb-1">
            To
          </label>
          <input
            id="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={loadReport}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Generate Report'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {report && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="border rounded-lg p-4 bg-green-50">
              <p className="text-sm text-gray-500">
                Revenue (Paid) —{' '}
                {new Date(report.periodFrom).toLocaleDateString()} to{' '}
                {new Date(report.periodTo).toLocaleDateString()}
              </p>
              <p className="text-3xl font-bold text-green-700 mt-1">
                {formatMinor(report.revenueMinor)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{paidInvoices.length} paid invoice{paidInvoices.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="border rounded-lg p-4 bg-yellow-50">
              <p className="text-sm text-gray-500">Outstanding (All Time)</p>
              <p className="text-3xl font-bold text-yellow-700 mt-1">
                {formatMinor(report.outstandingMinor)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{issuedInvoices.length} outstanding invoice{issuedInvoices.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Invoice Table */}
          <h2 className="text-base font-semibold mb-2">Invoices in Period</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice ID</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-left">Paid At</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.invoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      No invoices in this period.
                    </td>
                  </tr>
                )}
                {report.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{inv.id.slice(0, 8)}…</td>
                    <td className="px-4 py-2 text-right font-medium">{formatMinor(inv.totalMinor)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          inv.status === 'PAID'
                            ? 'bg-green-100 text-green-700'
                            : inv.status === 'ISSUED'
                            ? 'bg-yellow-100 text-yellow-700'
                            : inv.status === 'VOIDED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
