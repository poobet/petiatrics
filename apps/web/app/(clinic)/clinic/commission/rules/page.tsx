import { cookies } from 'next/headers';

interface CommissionRule {
  id: string;
  businessPartnerId: string;
  productId: string | null;
  commissionType: 'PERCENTAGE' | 'FLAT_RATE';
  rate: number;
  isActive: boolean;
  createdAt: string;
}

async function getRules(): Promise<CommissionRule[]> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get('petiatrics_sid')?.value;
    if (!sid) return [];
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/v1/commission/rules`, {
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

export default async function CommissionRulesPage() {
  const rules = await getRules();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Commission Rules</h1>
          <p className="text-sm text-slate-500">Configure percentage or flat-rate rules per Doctor / Staff member</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3">Partner ID</th>
                <th className="px-6 py-3">Product / Service</th>
                <th className="px-6 py-3">Rule Type</th>
                <th className="px-6 py-3 text-right">Rate / Amount</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No commission rules defined yet
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{rule.businessPartnerId}</td>
                    <td className="px-6 py-4 font-mono text-slate-600">
                      {rule.productId ? rule.productId : <span className="italic text-slate-400">BP Default (All Items)</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        rule.commissionType === 'PERCENTAGE'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {rule.commissionType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                      {rule.commissionType === 'PERCENTAGE'
                        ? `${rule.rate}%`
                        : `฿${(rule.rate / 100).toFixed(2)}`}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        rule.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {rule.isActive ? 'Active' : 'Inactive'}
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
