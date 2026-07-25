import { cookies } from 'next/headers';
import Link from 'next/link';

interface DfSummary {
  businessPartnerId: string;
  totalAccruedMinor: number;
  totalConfirmedMinor: number;
  totalSettledMinor: number;
  totalWhtMinor: number;
  totalNetPayableMinor: number;
  transactionCount: number;
}

async function getSummaries(): Promise<DfSummary[]> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get('petiatrics_sid')?.value;
    if (!sid) return [];
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/v1/commission/transactions/summary`, {
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

export default async function CommissionDashboardPage() {
  const summaries = await getSummaries();

  const totalAccrued = summaries.reduce((acc, s) => acc + s.totalAccruedMinor, 0);
  const totalConfirmed = summaries.reduce((acc, s) => acc + s.totalConfirmedMinor, 0);
  const totalSettled = summaries.reduce((acc, s) => acc + s.totalSettledMinor, 0);
  const totalWht = summaries.reduce((acc, s) => acc + s.totalWhtMinor, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Doctor Fee & Commission Engine</h1>
          <p className="text-sm text-slate-500">Revenue splitting, accrual tracking, payment runs, and WHT compliance</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/clinic/commission/payment-runs"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700"
          >
            Payment Runs
          </Link>
          <Link
            href="/clinic/commission/wht"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            WHT / Tax Reports
          </Link>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Accrued (Pending Invoice)</p>
          <p className="mt-2 text-2xl font-extrabold text-amber-600">฿{(totalAccrued / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Confirmed (Ready for Payout)</p>
          <p className="mt-2 text-2xl font-extrabold text-blue-600">฿{(totalConfirmed / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Settled (Paid Out)</p>
          <p className="mt-2 text-2xl font-extrabold text-emerald-600">฿{(totalSettled / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total WHT Deducted (3%)</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-700">฿{(totalWht / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
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
                    No doctor fee earnings recorded yet
                  </td>
                </tr>
              ) : (
                summaries.map((s) => (
                  <tr key={s.businessPartnerId} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{s.businessPartnerId}</td>
                    <td className="px-6 py-4 text-right font-mono">{s.transactionCount}</td>
                    <td className="px-6 py-4 text-right font-mono text-amber-600 font-medium">
                      {(s.totalAccruedMinor / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-blue-600 font-medium">
                      {(s.totalConfirmedMinor / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-emerald-600 font-medium">
                      {(s.totalSettledMinor / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-500">
                      {(s.totalWhtMinor / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                      {(s.totalNetPayableMinor / 100).toFixed(2)}
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
