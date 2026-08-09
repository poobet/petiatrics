'use client';

import React, { useEffect, useState } from 'react';
import {
  Layers,
  Search,
  Plus,
  Shield,
  Trash2,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
  X,
  Lock,
} from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';

interface GLAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  isSystem: boolean;
  isActive: boolean;
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Modal State for New User-Defined GL Account
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<string>('EXPENSE');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Deactivation confirmation modal state
  const [deactivatingAccount, setDeactivatingAccount] = useState<GLAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<GLAccount[]>('/accounting/gl-accounts');
      if (Array.isArray(data)) {
        setAccounts(data);
      }
    } catch (err) {
      console.error('Failed to load chart of accounts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Filter accounts by category, search term, and active status
  const filteredAccounts = accounts.filter((acc) => {
    const matchesCategory = selectedCategory === 'ALL' || acc.type === selectedCategory;
    const matchesSearch =
      !search ||
      acc.code.toLowerCase().includes(search.toLowerCase()) ||
      acc.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && acc.isActive) ||
      (statusFilter === 'INACTIVE' && !acc.isActive);

    return matchesCategory && matchesSearch && matchesStatus;
  });

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!newCode.trim()) {
      setModalError('กรุณาระบุรหัสบัญชี (Account Code)');
      return;
    }
    if (!newName.trim()) {
      setModalError('กรุณาระบุชื่อบัญชี (Account Name)');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/accounting/gl-accounts', {
        code: newCode.trim(),
        name: newName.trim(),
        type: newType,
      });

      setIsModalOpen(false);
      setNewCode('');
      setNewName('');
      setNewType('EXPENSE');
      fetchAccounts();
    } catch (err: any) {
      console.error('Failed to create account', err);
      if (err instanceof ApiError) {
        setModalError(err.message);
      } else {
        setModalError(err?.response?.data?.message || 'เกิดข้อผิดพลาดในการสร้างผังบัญชี');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivateAccount = async () => {
    if (!deactivatingAccount) return;
    if (deactivatingAccount.isSystem) {
      alert('บัญชีควบคุมระบบ (System Account) ไม่สามารถลบหรือปิดการใช้งานได้');
      return;
    }

    setDeleting(true);
    try {
      await apiClient.delete(`/accounting/gl-accounts/${deactivatingAccount.id}`);
      setDeactivatingAccount(null);
      fetchAccounts();
    } catch (err: any) {
      console.error('Failed to deactivate account', err);
      alert(err?.message || 'เกิดข้อผิดพลาดในการปิดใช้งานผังบัญชี');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              ผังบัญชี (Chart of Accounts - COA)
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              จัดการโครงสร้างผังบัญชีและการปกป้องบัญชีควบคุมระบบ (System Control Accounts)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAccounts}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-sm"
            title="รีเฟรชผังบัญชี"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-200"
          >
            <Plus className="w-4 h-4" />
            สร้างผังบัญชีใหม่ (Add Account)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-500">ผังบัญชีทั้งหมด</span>
          <div className="text-2xl font-bold text-slate-900">{accounts.length}</div>
          <p className="text-xs text-slate-400">บัญชีในระบบรวมทุกหมวดหมู่</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">บัญชีควบคุมระบบ (System)</span>
            <Shield className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">
            {accounts.filter((a) => a.isSystem).length}
          </div>
          <p className="text-xs text-amber-600/80">คุ้มครองพิเศษ ห้ามลบ/ปิดการใช้งาน</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-blue-600">บัญชีสร้างเพิ่มเติม (User-Defined)</span>
          <div className="text-2xl font-bold text-blue-700">
            {accounts.filter((a) => !a.isSystem).length}
          </div>
          <p className="text-xs text-slate-400">บัญชีที่กำหนดเองโดยผู้ใช้</p>
        </div>
      </div>

      {/* Table Container & Filter Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COGS'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat === 'ALL'
                  ? 'ทั้งหมด'
                  : cat === 'ASSET'
                  ? '1000 สินทรัพย์'
                  : cat === 'LIABILITY'
                  ? '2000 หนี้สิน'
                  : cat === 'EQUITY'
                  ? '3000 ส่วนของผู้ถือหุ้น'
                  : cat === 'REVENUE'
                  ? '4000 รายได้'
                  : cat === 'COGS'
                  ? '5000 ต้นทุนขาย'
                  : '6000 ค่าใช้จ่าย'}
              </button>
            ))}
          </div>

          {/* Search & Status Filter */}
          <div className="flex items-center gap-3">
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ หรือรหัสบัญชี..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ACTIVE">เปิดใช้งาน (Active)</option>
              <option value="INACTIVE">ปิดใช้งาน (Inactive)</option>
              <option value="ALL">สถานะทั้งหมด</option>
            </select>
          </div>
        </div>

        {/* COA Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5 w-32">รหัสบัญชี (Code)</th>
                <th className="px-6 py-3.5">ชื่อบัญชี (Account Name)</th>
                <th className="px-6 py-3.5 w-40">หมวดบัญชี (Type)</th>
                <th className="px-6 py-3.5 w-48">สถานะระบบ (System Status)</th>
                <th className="px-6 py-3.5 w-32 text-center">สถานะการใช้งาน</th>
                <th className="px-6 py-3.5 w-28 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    กำลังโหลดผังบัญชี...
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    ไม่พบข้อมูลผังบัญชีในเงื่อนไขที่ระบุ
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{acc.code}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{acc.name}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                          acc.type === 'ASSET'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : acc.type === 'LIABILITY'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : acc.type === 'EQUITY'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : acc.type === 'REVENUE'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {acc.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {acc.isSystem ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 rounded-lg shadow-2xs">
                          <Shield className="w-3.5 h-3.5 text-amber-600" />
                          <span>🛡️ บัญชีควบคุมระบบ</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          ผู้ใช้กำหนดเอง (User Defined)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {acc.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> ใช้งาน (Active)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          ปิดใช้งาน
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {acc.isSystem ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium cursor-not-allowed select-none px-2 py-1 bg-slate-100 rounded-lg"
                          title="บัญชีระบบถูกล็อก คุ้มครองความปลอดภัยระบบบัญชีคู่"
                        >
                          <Lock className="w-3.5 h-3.5" /> ถูกล็อก (Protected)
                        </span>
                      ) : (
                        acc.isActive && (
                          <button
                            onClick={() => setDeactivatingAccount(acc)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                            title="ปิดการใช้งานบัญชีนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> ปิดใช้งาน
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NEW GL ACCOUNT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900">สร้างผังบัญชีใหม่ (New GL Account)</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รหัสบัญชี (Account Code - 4-6 หลัก) *
                </label>
                <input
                  type="text"
                  placeholder="เช่น 5210 หรือ 6105"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อบัญชี (Account Name) *
                </label>
                <input
                  type="text"
                  placeholder="เช่น ค่าอุปกรณ์การแพทย์ หรือ ค่าการตลาด"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หมวดบัญชี (Account Type) *
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="ASSET">1000 - สินทรัพย์ (Asset)</option>
                  <option value="LIABILITY">2000 - หนี้สิน (Liability)</option>
                  <option value="EQUITY">3000 - ส่วนของผู้ถือหุ้น (Equity)</option>
                  <option value="REVENUE">4000 - รายได้ (Revenue)</option>
                  <option value="COGS">5000 - ต้นทุนขาย/บริการ (COGS)</option>
                  <option value="EXPENSE">6000 - ค่าใช้จ่าย (Expense)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2 rounded-xl transition-all shadow-sm"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      กำลังสร้าง...
                    </>
                  ) : (
                    'สร้างบัญชี'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEACTIVATION CONFIRMATION DIALOG */}
      {deactivatingAccount && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">ยืนยันปิดการใช้งานบัญชี</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              คุณต้องการปิดการใช้งานผังบัญชี{' '}
              <strong className="text-slate-900">
                {deactivatingAccount.code} - {deactivatingAccount.name}
              </strong>{' '}
              ใช่หรือไม่?
              <br />
              (รายการประวัติในสมุดรายวันจะยังถูกบันทึกไว้อย่างปลอดภัย)
            </p>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeactivatingAccount(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeactivateAccount}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    กำลังปิดใช้งาน...
                  </>
                ) : (
                  'ยืนยันปิดใช้งาน'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
