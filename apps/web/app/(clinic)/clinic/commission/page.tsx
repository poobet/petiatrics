'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DollarSign, ArrowRight } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Money } from '@/components/ui/money';

export default function CommissionDashboardPage() {
  const [summaries, setSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get('/billing/commission/partner-summary')
      .then((data) => setSummaries(Array.isArray(data) ? data : []))
      .catch(() => setSummaries([]))
      .finally(() => setLoading(false));
  }, []);

  const totalAccrued = summaries.reduce((acc, curr) => acc + (curr.totalAccruedMinor || 0), 0);
  const totalConfirmed = summaries.reduce((acc, curr) => acc + (curr.totalConfirmedMinor || 0), 0);
  const totalSettled = summaries.reduce((acc, curr) => acc + (curr.totalSettledMinor || 0), 0);
  const totalWht = summaries.reduce((acc, curr) => acc + (curr.totalWhtMinor || 0), 0);

  return (
    <div className="p-8 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-amber-500" />
            Doctor Fee & Commission Engine
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Automated DF calculations, tier rules, WHT (3%) deductions & settlement runs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/clinic/commission/rules"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors"
          >
            Commission Rules
          </Link>
          <Link
            href="/clinic/commission/transactions"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors"
          >
            All Transactions
          </Link>
          <Link
            href="/clinic/commission/payment-runs"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5"
          >
            <span>Payment Runs</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Accrued (Pending Invoice)</p>
          <p className="mt-2 text-2xl font-extrabold text-amber-600"><Money minor={totalAccrued} /></p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Confirmed (Ready for Payout)</p>
          <p className="mt-2 text-2xl font-extrabold text-blue-600"><Money minor={totalConfirmed} /></p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Settled (Paid Out)</p>
          <p className="mt-2 text-2xl font-extrabold text-emerald-600"><Money minor={totalSettled} /></p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total WHT Deducted (3%)</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-700"><Money minor={totalWht} /></p>
        </div>
      </div>

      {/* Doctor Breakdown Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">Doctor / Staff Earnings Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3">Partner ID</th>
                <th className="px-6 py-3 text-right">Transactions</th>
                <th className="px-6 py-3 text-right">Accrued (฿)</th>
                <th className="px-6 py-3 text-right">Confirmed (฿)</th>
                <th className="px-6 py-3 text-right">Settled (฿)</th>
                <th className="px-6 py-3 text-right">WHT (3%) (฿)</th>
                <th className="px-6 py-3 text-right">Net Payable (฿)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {summaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    {loading ? 'Loading...' : 'No doctor fee earnings recorded yet'}
                  </td>
                </tr>
              ) : (
                summaries.map((s) => (
                  <tr key={s.businessPartnerId} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{s.businessPartnerId}</td>
                    <td className="px-6 py-4 text-right font-mono">{s.transactionCount}</td>
                    <td className="px-6 py-4 text-right font-mono text-amber-600 font-medium">
                      <Money minor={s.totalAccruedMinor} showSymbol={false} />
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-blue-600 font-medium">
                      <Money minor={s.totalConfirmedMinor} showSymbol={false} />
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-emerald-600 font-medium">
                      <Money minor={s.totalSettledMinor} showSymbol={false} />
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-500">
                      <Money minor={s.totalWhtMinor} showSymbol={false} />
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                      <Money minor={s.totalNetPayableMinor} showSymbol={false} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
