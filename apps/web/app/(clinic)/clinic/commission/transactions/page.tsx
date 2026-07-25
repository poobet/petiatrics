import { cookies } from 'next/headers';

interface DfTx {
  id: string;
  businessPartnerId: string;
  visitId: string | null;
  invoiceId: string | null;
  productId: string | null;
  revenueAmountMinor: number;
  commissionType: string;
  commissionRate: number;
  dfAmountMinor: number;
  whtRate: number;
  whtAmountMinor: number;
  netPayableMinor: number;
  status: 'ACCRUED' | 'CONFIRMED' | 'SETTLED' | 'VOIDED';
  accruedAt: string;
}

async function getTransactions(): Promise<DfTx[]> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get('petiatrics_sid')?.value;
    if (!sid) return [];
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/v1/commission/transactions`, {
      headers: { Cookie: `petiatrics_sid=${sid}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

const STATUS_BADGES: Record<string, string> = {
  ACCRUED: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  SETTLED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  VOIDED: 'bg-rose-100 text-rose-800 border-rose-200 line-through',
};

export default async function CommissionTransactionsPage() {
  const transactions = await getTransactions();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Doctor Fee Ledger</h1>
          <p className="text-sm text-slate-500">Immutable transaction log of all accrued, confirmed, and settled doctor fees</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Partner ID</th>
                <th className="px-6 py-3">Visit / Invoice</th>
                <th className="px-6 py-3 text-right">Revenue (฿)</th>
                <th className="px-6 py-3 text-right">Rate</th>
                <th className="px-6 py-3 text-right">DF Amount (฿)</th>
                <th className="px-6 py-3 text-right">WHT (3%) (฿)</th>
                <th className="px-6 py-3 text-right">Net Payable (฿)</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-400">
                    No doctor fee transactions logged yet
                  </td>
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
                      {(tx.revenueAmountMinor / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs">
                      {tx.commissionType === 'PERCENTAGE' ? `${tx.commissionRate}%` : `฿${(tx.commissionRate / 100).toFixed(2)}`}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                      {(tx.dfAmountMinor / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-500">
                      {(tx.whtAmountMinor / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">
                      {(tx.netPayableMinor / 100).toFixed(2)}
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
