'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Search,
  ArrowLeft,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  Tag,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface AnalyticAccount {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export default function CostCentersPage() {
  const [costCenters, setCostCenters] = useState<AnalyticAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchCostCenters = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<AnalyticAccount[]>('/accounting/analytic-accounts');
      setCostCenters(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load cost centers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostCenters();
  }, []);

  const openCreateModal = () => {
    setCode('');
    setName('');
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setErrorMessage('กรุณาระบุรหัสศูนย์ต้นทุนและชื่อแผนก');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      await apiClient.post('/accounting/analytic-accounts', {
        code: code.trim(),
        name: name.trim(),
      });
      setIsModalOpen(false);
      fetchCostCenters();
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการบันทึกศูนย์ต้นทุน');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCenters = costCenters.filter(
    (cc) =>
      !searchQuery ||
      cc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cc.name.toLowerCase().includes(searchQuery.toLowerCase())
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
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              ศูนย์ต้นทุน & แผนก (Analytic Accounts / Cost Centers)
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              กำหนดแท็กแผนก (OPD, Surgery, Grooming, Hotel) เพื่อออกรายงานกำไรขาดทุนแยกตามแผนก (Departmental P&L)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCostCenters}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-xs"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl transition-all shadow-xs text-sm"
          >
            <Plus className="w-4 h-4" />
            เพิ่มศูนย์ต้นทุน (Add Cost Center)
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">ศูนย์ต้นทุนทั้งหมด</span>
            <span className="px-2.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-bold">
              {filteredCenters.length} รายการ
            </span>
          </div>

          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหารหัสศูนย์ต้นทุน หรือ ชื่อแผนก..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">รหัสศูนย์ต้นทุน (Code)</th>
                <th className="px-6 py-3.5">ชื่อแผนก / ฝ่าย (Department Name)</th>
                <th className="px-6 py-3.5 text-center">สถานะ (Status)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    กำลังโหลดข้อมูลศูนย์ต้นทุน...
                  </td>
                </tr>
              ) : filteredCenters.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-slate-400">
                    ยังไม่มีข้อมูลศูนย์ต้นทุน (คลิกปุ่ม "เพิ่มศูนย์ต้นทุน" เพื่อสร้างใหม่)
                  </td>
                </tr>
              ) : (
                filteredCenters.map((cc) => (
                  <tr key={cc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-blue-700">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg">
                        <Tag className="w-3.5 h-3.5" /> {cc.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {cc.name}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> ใช้งานอยู่
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900">เพิ่มศูนย์ต้นทุนใหม่</h3>
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
                  รหัสศูนย์ต้นทุน (Cost Center Code) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น DEPT-OPD, DEPT-SURGERY, DEPT-GROOMING"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อแผนก / ฝ่าย (Department Name) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น แผนกตรวจรักษาผู้ป่วยนอก (OPD)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
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
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-all"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  สร้างศูนย์ต้นทุน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
