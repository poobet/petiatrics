import { cookies } from 'next/headers';
import Link from 'next/link';
import { Badge } from '@petiatrics/ui/badge';
import { formatMinor } from '@/lib/currency';

interface Invoice {
  id: string;
  code?: string | null;
  visitId: string | null;
  patientId: string | null;
  totalMinor: number;
  status: string;
  issuedAt?: string;
  paidAt?: string;
  createdAt: string;
}

async function getInvoices(): Promise<Invoice[]> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get('petiatrics_sid')?.value;
    if (!sid) return [];
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/v1/billing/invoices`, {
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

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  ISSUED: 'default',
  PAID: 'outline',
  VOIDED: 'destructive',
};

export default async function BillingPage() {
  const invoices = await getInvoices();

  const byStatus = {
    ISSUED: invoices.filter((i) => i.status === 'ISSUED').length,
    DRAFT: invoices.filter((i) => i.status === 'DRAFT').length,
    PAID: invoices.filter((i) => i.status === 'PAID').length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Billing</h1>
        <div className="flex gap-2">
          <Link
            href="/clinic/billing/reports"
            className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Financial Reports
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border rounded-lg p-4 bg-yellow-50">
          <p className="text-sm text-gray-500">Outstanding</p>
          <p className="text-2xl font-bold text-yellow-700">{byStatus.ISSUED}</p>
        </div>
        <div className="border rounded-lg p-4 bg-gray-50">
          <p className="text-sm text-gray-500">Drafts</p>
          <p className="text-2xl font-bold">{byStatus.DRAFT}</p>
        </div>
        <div className="border rounded-lg p-4 bg-green-50">
          <p className="text-sm text-gray-500">Paid</p>
          <p className="text-2xl font-bold text-green-700">{byStatus.PAID}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Invoice ID</th>
              <th className="px-4 py-3 text-left">Patient</th>
              <th className="px-4 py-3 text-left">Visit</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No invoices found.
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600">
                  {inv.code ?? `${inv.id.slice(0, 8)}…`}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {inv.patientId ? `${inv.patientId.slice(0, 8)}…` : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {inv.visitId ? `${inv.visitId.slice(0, 8)}…` : '—'}
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatMinor(inv.totalMinor)}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_COLORS[inv.status] ?? 'secondary'}>{inv.status}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(inv.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/clinic/billing/${inv.id}`}
                    className="text-blue-600 hover:underline text-xs"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
