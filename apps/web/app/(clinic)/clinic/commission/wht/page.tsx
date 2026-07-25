import { cookies } from 'next/headers';

interface WhtCert {
  id: string;
  code: string;
  businessPartnerId: string;
  payerName: string;
  payeeName: string;
  payeeTaxId: string;
  incomeType: string;
  totalIncomeMinor: number;
  whtAmountMinor: number;
  taxMonth: number;
  taxYear: number;
  issuedAt: string;
}

async function getWhtCertificates(): Promise<WhtCert[]> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get('petiatrics_sid')?.value;
    if (!sid) return [];
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/v1/commission/wht/certificates`, {
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

export default async function WhtCertificatesPage() {
  const certificates = await getWhtCertificates();
  const currentBuddhistYear = new Date().getFullYear() + 543;
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Withholding Tax (WHT / 50 Tawi) & P.N.D.3</h1>
          <p className="text-sm text-slate-500">Thai Revenue Department compliance, 50 Tawi certificates, and P.N.D.3 CSV export</p>
        </div>
        <div>
          <a
            href={`/api/v1/commission/wht/export?year=${currentBuddhistYear}&month=${currentMonth}`}
            download
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700"
          >
            Export P.N.D.3 CSV ({currentMonth}/{currentBuddhistYear})
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">Issued 50 Tawi Certificates</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3">Certificate Code</th>
                <th className="px-6 py-3">Payee Name</th>
                <th className="px-6 py-3">Payee Tax ID</th>
                <th className="px-6 py-3">Tax Period</th>
                <th className="px-6 py-3 text-right">Gross Income (฿)</th>
                <th className="px-6 py-3 text-right">WHT Rate</th>
                <th className="px-6 py-3 text-right">WHT Deducted (฿)</th>
                <th className="px-6 py-3">Issued Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {certificates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                    No WHT certificates issued yet
                  </td>
                </tr>
              ) : (
                certificates.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{c.code}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{c.payeeName}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{c.payeeTaxId}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">{c.taxMonth}/{c.taxYear}</td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-slate-900">
                      {(c.totalIncomeMinor / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs">3.00%</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-indigo-600">
                      {(c.whtAmountMinor / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">
                      {new Date(c.issuedAt).toLocaleDateString('th-TH')}
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
