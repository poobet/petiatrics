'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Money } from '@/components/ui/money';

const STATUS_BADGES: Record<string, string> = {
  ACCRUED: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  SETTLED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
};

export default function CommissionTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get('/billing/commission/transactions')
      .then((data) => setTransactions(Array.isArray(data) ? data : []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center space-x-4 border-b pb-4">
        <Link href="/clinic/commission" className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commission & DF Ledger Transactions</h1>
          <p className="text-slate-500 text-sm">Detailed audit trail of all Doctor Fee accruals and settlements</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Partner ID</th>
                <th className="px-6 py-3.5">Source Ref</th>
                <th className="px-6 py-3.5 text-right">Revenue (฿)</th>
                <th className="px-6 py-3.5 text-right">Rate</th>
                <th className="px-6 py-3.5 text-right">DF Amount (฿)</th>
                <th className="px-6 py-3.5 text-right">WHT (3%) (฿)</th>
                <th className="px-6 py-3.5 text-right">Net Payable (฿)</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-400">Loading transactions...</td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-400">No transactions recorded yet</td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">
                      {new Date(tx.accruedAt).toLocaleDateString('th-TH')}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">{tx.businessPartnerId}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      {tx.invoiceId ? `Inv: ${tx.invoiceId.slice(0, 8)}` : tx.visitId ? `Visit: ${tx.visitId.slice(0, 8)}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-slate-700">
                      <Money minor={tx.revenueAmountMinor} showSymbol={false} />
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs">
                      {tx.commissionType === 'PERCENTAGE' ? `${tx.commissionRate}%` : <Money minor={tx.commissionRate} />}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                      <Money minor={tx.dfAmountMinor} showSymbol={false} />
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-500">
                      <Money minor={tx.whtAmountMinor} showSymbol={false} />
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">
                      <Money minor={tx.netPayableMinor} showSymbol={false} />
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center border rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGES[tx.status] || 'bg-slate-100'}`}>
                        {tx.status}
                      </span>
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
