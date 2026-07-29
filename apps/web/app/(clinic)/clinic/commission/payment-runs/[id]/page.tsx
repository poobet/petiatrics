'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

interface Allocation {
  id: string;
  dfTransactionId: string;
  amountMinor: number;
}

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
  paymentMethod?: string;
  referenceNumber?: string;
  createdAt: string;
  allocations: Allocation[];
}

export default function PaymentRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [run, setRun] = useState<PaymentRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Adjustment modal state
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjType, setAdjType] = useState<'ADJUSTMENT_ADD' | 'ADJUSTMENT_DEDUCT'>('ADJUSTMENT_ADD');
  const [adjAmountBaht, setAdjAmountBaht] = useState('');
  const [adjReason, setAdjReason] = useState('');

  useEffect(() => {
    fetchRun();
  }, [id]);

  async function fetchRun() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/commission/payment-runs/${id}`);
      if (!res.ok) throw new Error('Failed to load payment run detail');
      const data = await res.json();
      setRun(data?.data ?? data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!run || !adjAmountBaht || !adjReason.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      const amountMinor = Math.round(parseFloat(adjAmountBaht) * 100);
      const res = await fetch('/api/v1/commission/transactions/adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessPartnerId: run.businessPartnerId,
          type: adjType,
          amountMinor,
          reason: adjReason,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to add adjustment');
      }

      setShowAdjModal(false);
      setAdjAmountBaht('');
      setAdjReason('');
      await fetchRun();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove() {
    if (!run) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/commission/payment-runs/${run.id}/approve`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to approve');
      await fetchRun();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  const STATUS_BADGES: Record<string, string> = {
    DRAFT: 'bg-amber-100 text-amber-800 border-amber-200',
    APPROVED: 'bg-blue-100 text-blue-800 border-blue-200',
    PAID: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200 line-through',
  };

  if (loading) return <div className="p-6 text-slate-500">Loading payment run detail…</div>;
  if (!run) return <div className="p-6 text-red-600">Payment run not found</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        ← Back to Payment Runs
      </button>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-mono">#{run.code}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Partner ID: <span className="font-semibold text-slate-800">{run.businessPartnerId}</span>
          </p>
          <p className="text-xs text-slate-400 font-mono">
            Period: {new Date(run.periodStart).toLocaleDateString('th-TH')} - {new Date(run.periodEnd).toLocaleDateString('th-TH')}
          </p>
        </div>
        <span className={`inline-flex items-center border rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGES[run.status]}`}>
          {run.status}
        </span>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">รวมค่ามือแพทย์ (Total DF)</p>
          <p className="text-xl font-bold font-mono text-slate-900 mt-1">
            ฿{(run.totalDfMinor / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">หัก ณ ที่จ่าย 3% (WHT 3%)</p>
          <p className="text-xl font-bold font-mono text-slate-500 mt-1">
            ฿{(run.totalWhtMinor / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">ยอดสุทธิจ่ายจริง (Net Payable)</p>
          <p className="text-xl font-bold font-mono text-emerald-600 mt-1">
            ฿{(run.totalNetMinor / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t pt-4">
        <div>
          {run.status === 'DRAFT' && (
            <button
              onClick={() => setShowAdjModal(true)}
              className="px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium"
            >
              + เพิ่มการปรับปรุงยอด (Add DF Adjustment)
            </button>
          )}
        </div>
        <div className="flex gap-3">
          {run.status === 'DRAFT' && (
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Approve Payment Run
            </button>
          )}
        </div>
      </div>

      {/* Allocations Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50">
          <h2 className="font-semibold text-slate-800 text-sm">รายการธุรกรรมในรอบทำจ่าย ({run.allocations.length} รายการ)</h2>
        </div>
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-6 py-3">Transaction ID</th>
              <th className="px-6 py-3 text-right">Net Amount (฿)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {run.allocations.map((alloc) => (
              <tr key={alloc.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 font-mono text-xs text-slate-800">{alloc.dfTransactionId}</td>
                <td className="px-6 py-3 text-right font-mono font-medium text-slate-900">
                  ฿{(alloc.amountMinor / 100).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Adjustment Modal */}
      {showAdjModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddAdjustment} className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">เพิ่มการปรับปรุงยอด DF (DF Adjustment)</h3>
            <p className="text-xs text-slate-500">
              บันทึกยอดเพิ่มหรือหักลบค่ามือแพทย์ข้ามเดือน (Forward-Only Adjustment) พร้อมคำนวณ ภาษี 3% อัตโนมัติ
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ประเภทการปรับปรุง</label>
              <select
                value={adjType}
                onChange={(e) => setAdjType(e.target.value as any)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ADJUSTMENT_ADD">+ เพิ่มยอดค่ามือแพทย์ (ADJUSTMENT_ADD)</option>
                <option value="ADJUSTMENT_DEDUCT">- หักยอดค่ามือแพทย์ (ADJUSTMENT_DEDUCT)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">จำนวนเงิน (บาท)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={adjAmountBaht}
                onChange={(e) => setAdjAmountBaht(e.target.value)}
                required
                placeholder="0.00"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">เหตุผล / หมายเหตุ</label>
              <textarea
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                required
                rows={3}
                placeholder="ระบุเหตุผลการปรับปรุงยอด..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdjModal(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={actionLoading || !adjAmountBaht || !adjReason.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {actionLoading ? 'กำลังบันทึก…' : 'บันทึกการปรับปรุง'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
