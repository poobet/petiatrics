'use client';

import React, { useEffect, useState } from 'react';
import {
  Scale,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  Layers,
  Printer,
  Calendar,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Money } from '@/components/ui/money';

interface TrialBalanceRow {
  glAccountId: string;
  code: string;
  name: string;
  type: string;
  isSystem: boolean;
  debitMinor: number;
  creditMinor: number;
  balanceMinor: number;
}

export default function TrialBalanceReportPage() {
  const [report, setReport] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('CURRENT_YEAR');

  const fetchTrialBalance = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<TrialBalanceRow[]>('/accounting/trial-balance');
      if (Array.isArray(data)) {
        setReport(data);
      }
    } catch (err) {
      console.error('Failed to load trial balance report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrialBalance();
  }, []);

  // Compute grand totals
  const totalDebitMinor = report.reduce((sum, r) => sum + (r.debitMinor || 0), 0);
  const totalCreditMinor = report.reduce((sum, r) => sum + (r.creditMinor || 0), 0);
  const varianceMinor = Math.abs(totalDebitMinor - totalCreditMinor);
  const isBalanced = totalDebitMinor === totalCreditMinor;

  // Filter report rows by search and category
  const filteredReport = report.filter((row) => {
    const matchesCategory = selectedCategory === 'ALL' || row.type === selectedCategory;
    const matchesSearch =
      !search ||
      row.code.toLowerCase().includes(search.toLowerCase()) ||
      row.name.toLowerCase().includes(search.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              รายงานงบทดลอง (Trial Balance Report)
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              รายงานพิสูจน์ความถูกต้องของยอดรวมเดบิตและเครดิตตามหลักการบัญชีคู่ (Double-Entry Accounting)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" /> พิมพ์รายงาน (Print)
          </button>
          <button
            onClick={fetchTrialBalance}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-sm"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>ยอดรวมเดบิต (Total Dr)</span>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-mono font-bold rounded-md">
              Dr
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            <Money minor={totalDebitMinor} />
          </div>
          <p className="text-xs text-slate-400">เดบิตรวมทุกผังบัญชี</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>ยอดรวมเครดิต (Total Cr)</span>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono font-bold rounded-md">
              Cr
            </span>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            <Money minor={totalCreditMinor} />
          </div>
          <p className="text-xs text-slate-400">เครดิตรวมทุกผังบัญชี</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>ผลต่างงบทดลอง (Variance)</span>
            <Scale className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-800">
            <Money minor={varianceMinor} />
          </div>
          <div>
            {isBalanced ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> ดุลสมบูรณ์ 100%
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5" /> งบไม่สมดุล
              </span>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>ผังบัญชีที่มีการใช้งาน</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{report.length}</div>
          <p className="text-xs text-slate-400">จำนวนบัญชีในผังทั้งหมด</p>
        </div>
      </div>

      {/* Main Report Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Report Header Filter & Controls */}
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" /> หมวด:
            </span>
            {['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COGS'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
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

          {/* Search & Period Filter */}
          <div className="flex items-center gap-3">
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหารหัส หรือชื่อบัญชี..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-slate-700 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>รอบบัญชีประจำปี {new Date().getFullYear()}</span>
            </div>
          </div>
        </div>

        {/* Printable Official Report Title Header */}
        <div className="hidden print:block p-8 border-b border-slate-200 text-center space-y-1">
          <h2 className="text-xl font-bold text-slate-900">คลินิกเวชกรรมสัตว์ (Petiatrics Clinic)</h2>
          <h3 className="text-lg font-semibold text-slate-800">รายงานงบทดลอง (Trial Balance Report)</h3>
          <p className="text-xs text-slate-500">
            ณ วันที่ {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Trial Balance Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5 w-36">รหัสบัญชี (Code)</th>
                <th className="px-6 py-3.5">ชื่อบัญชี (Account Name)</th>
                <th className="px-6 py-3.5 w-40">หมวดบัญชี (Type)</th>
                <th className="px-6 py-3.5 text-right w-44">เดบิต (Debit ฿)</th>
                <th className="px-6 py-3.5 text-right w-44">เครดิต (Credit ฿)</th>
                <th className="px-6 py-3.5 text-right w-48">ยอดยกไปสุทธิ (Net Balance)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    กำลังประมวลผลคำนวณงบทดลอง...
                  </td>
                </tr>
              ) : filteredReport.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    ไม่พบรายการบัญชีในเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredReport.map((row) => (
                  <tr key={row.glAccountId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span>{row.code}</span>
                        {row.isSystem && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 font-sans print:hidden">
                            System
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">{row.name}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-0.5 text-xs font-bold rounded-md ${
                          row.type === 'ASSET'
                            ? 'bg-emerald-50 text-emerald-700'
                            : row.type === 'LIABILITY'
                            ? 'bg-amber-50 text-amber-700'
                            : row.type === 'EQUITY'
                            ? 'bg-purple-50 text-purple-700'
                            : row.type === 'REVENUE'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-emerald-600 font-medium">
                      {row.debitMinor > 0 ? (
                        <Money minor={row.debitMinor} />
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-blue-600 font-medium">
                      {row.creditMinor > 0 ? (
                        <Money minor={row.creditMinor} />
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                      <Money minor={Math.abs(row.balanceMinor)} />
                      <span className="text-xs text-slate-400 font-normal ml-1">
                        {row.balanceMinor > 0 ? '(Dr)' : row.balanceMinor < 0 ? '(Cr)' : ''}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Bottom Row Grand Totals Enforcement */}
            {!loading && report.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-right text-slate-700 font-semibold">
                    ยอดรวมงบทดลองทั้งสิ้น (Grand Totals):
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-emerald-700 text-base">
                    <Money minor={totalDebitMinor} />
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-blue-700 text-base">
                    <Money minor={totalCreditMinor} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isBalanced ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> งบดุลสมบูรณ์ 100%
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200">
                        <AlertCircle className="w-4 h-4 text-amber-600" /> ผลต่าง{' '}
                        <Money minor={varianceMinor} />
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
