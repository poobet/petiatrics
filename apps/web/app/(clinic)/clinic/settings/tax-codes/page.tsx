'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Plus,
  Search,
  ArrowLeft,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  Percent,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface GLAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface TaxCode {
  id: string;
  code: string;
  name: string;
  rate: number;
  computationType: 'TAX_INCLUDED' | 'TAX_EXCLUDED';
  glAccountId?: string;
  glAccount?: GLAccount;
  isActive: boolean;
}

export default function TaxCodesPage() {
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<TaxCode | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [rate, setRate] = useState<number>(7);
  const [computationType, setComputationType] = useState<'TAX_INCLUDED' | 'TAX_EXCLUDED'>('TAX_INCLUDED');
  const [glAccountId, setGlAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [taxData, accData] = await Promise.all([
        apiClient.get<TaxCode[]>('/accounting/tax-codes'),
        apiClient.get<GLAccount[]>('/accounting/gl-accounts'),
      ]);
      setTaxCodes(Array.isArray(taxData) ? taxData : []);
      setGlAccounts(Array.isArray(accData) ? accData : []);
    } catch (err) {
      console.error('Failed to load tax codes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingCode(null);
    setCode('');
    setName('');
    setRate(7);
    setComputationType('TAX_INCLUDED');
    setGlAccountId('');
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const openEditModal = (tc: TaxCode) => {
    setEditingCode(tc);
    setCode(tc.code);
    setName(tc.name || tc.code);
    setRate(tc.rate);
    setComputationType(tc.computationType || 'TAX_INCLUDED');
    setGlAccountId(tc.glAccountId || '');
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMessage('กรุณาระบุรหัสภาษี (Tax Code)');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      if (editingCode) {
        await apiClient.put(`/accounting/tax-codes/${editingCode.id}`, {
          name: name.trim() || code.trim(),
          rate: Number(rate),
          computationType,
          glAccountId: glAccountId || null,
        });
      } else {
        await apiClient.post('/accounting/tax-codes', {
          code: code.trim(),
          name: name.trim() || code.trim(),
          rate: Number(rate),
          computationType,
          glAccountId: glAccountId || null,
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลภาษี');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCodes = taxCodes.filter(
    (tc) =>
      !searchQuery ||
      tc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/clinic/settings"
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              ตั้งค่าประเภทภาษี (Tax Configuration)
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              กำหนดอัตราภาษีมูลค่าเพิ่ม (VAT 7%, NON-VAT) และการแมปบัญชีภาษีตามกฎหมายสรรพากร
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-xs"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-xl transition-all shadow-xs text-sm"
          >
            <Plus className="w-4 h-4" />
            เพิ่มประเภทภาษี (Add Tax Code)
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">รหัสภาษีทั้งหมด</span>
            <span className="px-2.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-bold">
              {filteredCodes.length} รายการ
            </span>
          </div>

          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหารหัสภาษี หรือ ชื่อประเภทภาษี..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">รหัสภาษี (Code)</th>
                <th className="px-6 py-3.5">ชื่อประเภทภาษี (Tax Name)</th>
                <th className="px-6 py-3.5 text-center">อัตราภาษี (%)</th>
                <th className="px-6 py-3.5 text-center">ประเภทคำนวณ</th>
                <th className="px-6 py-3.5">ผังบัญชีภาษีที่เชื่อมโยง (GL Account)</th>
                <th className="px-6 py-3.5 text-center w-28">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    กำลังโหลดข้อมูลภาษี...
                  </td>
                </tr>
              ) : filteredCodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    ยังไม่มีข้อมูลประเภทภาษี
                  </td>
                </tr>
              ) : (
                filteredCodes.map((tc) => (
                  <tr key={tc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-emerald-700">
                      {tc.code}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {tc.name || tc.code}
                    </td>
                    <td className="px-6 py-4 text-center font-mono font-bold text-slate-900">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-lg">
                        <Percent className="w-3 h-3 text-emerald-600" /> {tc.rate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                        {tc.computationType === 'TAX_INCLUDED' ? 'รวมในราคา (VAT Inclusive)' : 'แยกนอกราคา (VAT Exclusive)'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {tc.glAccount ? (
                        <span className="font-mono text-xs text-slate-800">
                          <strong className="text-blue-600 font-bold">{tc.glAccount.code}</strong> - {tc.glAccount.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs font-italic">ไม่ระบุผังบัญชี</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => openEditModal(tc)}
                        className="text-xs text-blue-600 font-semibold hover:underline"
                      >
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900">
                  {editingCode ? 'แก้ไขประเภทภาษี' : 'เพิ่มประเภทภาษีใหม่'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {errorMessage}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  รหัสภาษี (Tax Code) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingCode}
                  placeholder="เช่น VAT_7, NON_VAT, WHT_3"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อประเภทภาษี (Tax Name) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ภาษีมูลค่าเพิ่ม 7% (VAT 7%)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    อัตราภาษี (%) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    max="100"
                    value={rate}
                    onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ประเภทคำนวณ
                  </label>
                  <select
                    value={computationType}
                    onChange={(e) => setComputationType(e.target.value as any)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="TAX_INCLUDED">รวมในราคา (Inclusive)</option>
                    <option value="TAX_EXCLUDED">แยกนอกราคา (Exclusive)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ผังบัญชีภาษีที่เชื่อมโยง (GL Account Mapping)
                </label>
                <select
                  value={glAccountId}
                  onChange={(e) => setGlAccountId(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                >
                  <option value="">-- ไม่เชื่อมโยงบัญชีภาษี --</option>
                  {glAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      [{acc.code}] {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-all"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {editingCode ? 'บันทึกการแก้ไข' : 'สร้างประเภทภาษี'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
