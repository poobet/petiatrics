'use client';

import { useState, useEffect } from 'react';

interface AccountingPeriod {
  id: string;
  year: number;
  month: number;
  status: 'OPEN' | 'CLOSING' | 'CLOSED';
  closedAt?: string;
  closedBy?: { name: string; email: string };
  reopenReason?: string;
}

export default function AccountingPeriodsPage() {
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Create Modal state
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
  const [creating, setCreating] = useState(false);

  // Close/Reopen Modal state
  const [activeModalPeriod, setActiveModalPeriod] = useState<AccountingPeriod | null>(null);
  const [modalType, setModalType] = useState<'close' | 'reopen' | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPeriods();
  }, [selectedYear]);

  async function fetchPeriods() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/accounting-periods?year=${selectedYear}`);
      if (!res.ok) throw new Error('Failed to fetch accounting periods');
      const data = await res.json();
      setPeriods(data?.data ?? data ?? []);
    } catch (err: any) {
      setError(err.message || 'Error loading periods');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePeriod(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/v1/accounting-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: Number(newYear), month: Number(newMonth) }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || errData.error?.message || 'Failed to create period');
      }
      await fetchPeriods();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleClosePeriod() {
    if (!activeModalPeriod) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/accounting-periods/${activeModalPeriod.id}/close`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || errData.error?.message || 'Failed to close period');
      }
      setActiveModalPeriod(null);
      setModalType(null);
      await fetchPeriods();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReopenPeriod(e: React.FormEvent) {
    e.preventDefault();
    if (!activeModalPeriod || !reopenReason.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/accounting-periods/${activeModalPeriod.id}/reopen`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reopenReason }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || errData.error?.message || 'Failed to reopen period');
      }
      setActiveModalPeriod(null);
      setModalType(null);
      setReopenReason('');
      await fetchPeriods();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  const monthNames = [
    'มกราคม (Jan)', 'กุมภาพันธ์ (Feb)', 'มีนาคม (Mar)', 'เมษายน (Apr)',
    'พฤษภาคม (May)', 'มิถุนายน (Jun)', 'กรกฎาคม (Jul)', 'สิงหาคม (Aug)',
    'กันยายน (Sep)', 'ตลุาคม (Oct)', 'พฤศจิกายน (Nov)', 'ธันวาคม (Dec)'
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">จัดการรอบบัญชี (Accounting Periods)</h1>
        <p className="text-sm text-gray-500 mt-1">
          เปิด-ปิดงบบัญชีรายเดือน เพื่อล็อกข้อมูลทางบัญชีไม่ให้แก้ไขย้อนหลัง (Immutable Accounting Ledger)
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Create New Period Section */}
      <div className="bg-white p-5 border rounded-lg shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-800">สร้างรอบบัญชีใหม่ (Create Period)</h2>
        <form onSubmit={handleCreatePeriod} className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ปี (Year)</label>
            <input
              type="number"
              value={newYear}
              onChange={(e) => setNewYear(Number(e.target.value))}
              className="border rounded-md px-3 py-1.5 text-sm w-32 focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">เดือน (Month)</label>
            <select
              value={newMonth}
              onChange={(e) => setNewMonth(Number(e.target.value))}
              className="border rounded-md px-3 py-1.5 text-sm w-48 focus:ring-2 focus:ring-blue-500"
            >
              {monthNames.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {idx + 1}. {name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50"
          >
            {creating ? 'กำลังสร้าง…' : '+ เพิ่มรอบบัญชี'}
          </button>
        </form>
      </div>

      {/* Periods List */}
      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="font-semibold text-gray-800">รายการรอบบัญชี</h2>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">กรองปี:</span>
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm w-24"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">กำลังโหลดข้อมูล…</div>
        ) : periods.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">ไม่พบรอบบัญชีในปีนี้</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
              <tr>
                <th className="py-3 px-4">รอบบัญชี</th>
                <th className="py-3 px-4">สถานะ (Status)</th>
                <th className="py-3 px-4">ผู้ปิดงบ</th>
                <th className="py-3 px-4">วันที่ปิดงบ</th>
                <th className="py-3 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-700">
              {periods.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">
                    {p.year}-{String(p.month).padStart(2, '0')} ({monthNames[p.month - 1]})
                  </td>
                  <td className="py-3 px-4">
                    {p.status === 'OPEN' && (
                      <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                        OPEN (เปิดอยู่)
                      </span>
                    )}
                    {p.status === 'CLOSING' && (
                      <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                        CLOSING (กำลังปิด)
                      </span>
                    )}
                    {p.status === 'CLOSED' && (
                      <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                        CLOSED (ปิดงบแล้ว)
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-500">
                    {p.closedBy?.name || '-'}
                  </td>
                  <td className="py-3 px-4 text-gray-500">
                    {p.closedAt ? new Date(p.closedAt).toLocaleDateString('th-TH') : '-'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {p.status === 'OPEN' && (
                      <button
                        onClick={() => {
                          setActiveModalPeriod(p);
                          setModalType('close');
                        }}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium"
                      >
                        ปิดงบบัญชี (Close)
                      </button>
                    )}
                    {p.status === 'CLOSED' && (
                      <button
                        onClick={() => {
                          setActiveModalPeriod(p);
                          setModalType('reopen');
                        }}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium"
                      >
                        ปลดล็อก (Reopen)
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirmation Modal for Closing */}
      {modalType === 'close' && activeModalPeriod && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              ยืนยันการปิดงบบัญชี {activeModalPeriod.year}-{String(activeModalPeriod.month).padStart(2, '0')}
            </h3>
            <p className="text-sm text-gray-600">
              เมื่อปิดงบแล้ว ระบบจะ **ล็อกเอกสารทั้งหมด** (ใบแจ้งหนี้, สต็อกสินค้า, DF) ที่อยู่ในรอบบัญชีนี้ ไม่ให้แก้ไขหรือสร้างเพิ่มย้อนหลัง
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveModalPeriod(null);
                  setModalType(null);
                }}
                className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleClosePeriod}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium disabled:opacity-50"
              >
                {actionLoading ? 'กำลังปิดงบ…' : 'ยืนยันปิดงบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Reopening */}
      {modalType === 'reopen' && activeModalPeriod && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleReopenPeriod} className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              ปลดล็อกรอบบัญชี {activeModalPeriod.year}-{String(activeModalPeriod.month).padStart(2, '0')}
            </h3>
            <p className="text-xs text-amber-700 bg-amber-50 p-2 border border-amber-200 rounded">
              ⚠️ การปลดล็อกต้องระบุเหตุผลเพื่อเป็นหลักฐานตรวจสอบ (Audit Trail)
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">เหตุผลในการปลดล็อก</label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                required
                rows={3}
                placeholder="ระบุเหตุผลความจำเป็นในการปลดล็อก..."
                className="border rounded-md px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveModalPeriod(null);
                  setModalType(null);
                  setReopenReason('');
                }}
                className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={actionLoading || !reopenReason.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm font-medium disabled:opacity-50"
              >
                {actionLoading ? 'กำลังทำรายการ…' : 'ยืนยันปลดล็อก'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
