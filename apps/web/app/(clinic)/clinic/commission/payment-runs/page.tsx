import { cookies } from 'next/headers';
import Link from 'next/link';

interface PaymentRun {
  id: string;
  code: string;
  businessPartnerId: string;
  periodStart: string;
  periodEnd: string;
  totalDfMinor: number;
  totalWhtMinor: number;
  totalNetMinor: number;
  status: 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED';
  paymentMethod: string | null;
  referenceNumber: string | null;
  createdAt: string;
}

async function getPaymentRuns(): Promise<PaymentRun[]> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get('petiatrics_sid')?.value;
    if (!sid) return [];
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/v1/commission/payment-runs`, {
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
  DRAFT: 'bg-amber-100 text-amber-800 border-amber-200',
  APPROVED: 'bg-blue-100 text-blue-800 border-blue-200',
  PAID: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200 line-through',
};

export default async function CommissionPaymentRunsPage() {
  const runs = await getPaymentRuns();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payment Runs (Settlements)</h1>
          <p className="text-sm text-slate-500">Batch doctor fee payouts, WHT deduction, and settlement history</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3">Code</th>
                <th className="px-6 py-3">Partner ID</th>
                <th className="px-6 py-3">Coverage Period</th>
                <th className="px-6 py-3 text-right">Total DF (฿)</th>
                <th className="px-6 py-3 text-right">WHT (3%) (฿)</th>
                <th className="px-6 py-3 text-right">Net Payable (฿)</th>
                <th className="px-6 py-3">Method / Ref</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                    No payment runs created yet
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{run.code}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{run.businessPartnerId}</td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">
                      {new Date(run.periodStart).toLocaleDateString('th-TH')} - {new Date(run.periodEnd).toLocaleDateString('th-TH')}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-slate-900">
                      {(run.totalDfMinor / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-500">
                      {(run.totalWhtMinor / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">
                      {(run.totalNetMinor / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {run.paymentMethod ? `${run.paymentMethod} ${run.referenceNumber ? `(${run.referenceNumber})` : ''}` : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center border rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGES[run.status] || 'bg-slate-100'}`}>
                        {run.status}
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
