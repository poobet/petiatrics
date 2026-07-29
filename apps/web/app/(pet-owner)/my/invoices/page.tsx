import { cookies } from 'next/headers';
import { formatMinor } from '@/lib/currency';

interface Invoice {
  id: string;
  totalMinor: number;
  subtotalMinor: number;
  taxTotalMinor: number;
  taxRateBps: number;
  status: string;
  issuedAt?: string;
  paidAt?: string;
  createdAt: string;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPriceMinor: number;
    subtotalMinor: number;
  }>;
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

const STATUS_BG: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ISSUED: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
  VOIDED: 'bg-red-100 text-red-700',
};

export default async function MyInvoicesPage() {
  const invoices = await getInvoices();

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">My Invoices</h1>

      {invoices.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No invoices yet.</p>
      ) : (
        invoices.map((inv) => (
          <details key={inv.id} className="bg-white rounded-xl border overflow-hidden">
            <summary className="p-4 cursor-pointer flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{formatMinor(inv.totalMinor)}</p>
                <p className="text-xs text-gray-400">{new Date(inv.createdAt).toLocaleDateString()}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BG[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {inv.status}
              </span>
            </summary>
            {/* Receipt View */}
            <div className="border-t px-4 pb-4 pt-3 space-y-2">
              {inv.lineItems.map((li) => (
                <div key={li.id} className="flex justify-between text-xs text-gray-600">
                  <span>{li.description} × {li.quantity}</span>
                  <span>{formatMinor(li.subtotalMinor)}</span>
                </div>
              ))}
              <div className="border-t pt-2 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Subtotal</span>
                  <span>{formatMinor(inv.subtotalMinor)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>VAT ({(inv.taxRateBps / 100).toFixed(0)}%)</span>
                  <span>{formatMinor(inv.taxTotalMinor)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span>{formatMinor(inv.totalMinor)}</span>
                </div>
              </div>
              {inv.paidAt && (
                <p className="text-xs text-green-600">✓ Paid on {new Date(inv.paidAt).toLocaleDateString()}</p>
              )}
            </div>
          </details>
        ))
      )}
    </div>
  );
}
