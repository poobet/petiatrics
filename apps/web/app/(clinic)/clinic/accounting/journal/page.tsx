'use client';

import { useState, useEffect } from 'react';
import {
  BookOpen,
  FileText,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Scale,
  Layers,
  Calendar,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  SlidersHorizontal,
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

interface JournalLine {
  id: string;
  glAccountId: string;
  debitMinor: number;
  creditMinor: number;
  glAccount?: {
    code: string;
    name: string;
    type: string;
  };
}

interface JournalEntry {
  id: string;
  clinicId: string;
  entryNo: string;
  type: string;
  description: string;
  sourceRefType?: string;
  sourceRefId?: string;
  postedAt: string;
  status: string;
  lines: JournalLine[];
}

interface GLAccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

export default function AccountingJournalPage() {
  const [activeTab, setActiveTab] = useState<'trial-balance' | 'journal-entries'>('trial-balance');
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [glAccounts, setGlAccounts] = useState<GLAccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Expanded journal entry row ID
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // New Journal Entry Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryNo, setEntryNo] = useState(`JV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [description, setDescription] = useState('');
  const [newLines, setNewLines] = useState<
    { glAccountId: string; debitBaht: string; creditBaht: string }[]
  >([
    { glAccountId: '', debitBaht: '', creditBaht: '' },
    { glAccountId: '', debitBaht: '', creditBaht: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tbData, jeData, accData] = await Promise.all([
        apiClient.get<TrialBalanceRow[]>('/accounting/trial-balance').catch(() => []),
        apiClient.get<JournalEntry[]>('/accounting/journal-entries').catch(() => []),
        apiClient.get<GLAccountOption[]>('/accounting/gl-accounts').catch(() => []),
      ]);

      setTrialBalance(Array.isArray(tbData) ? tbData : []);
      setJournalEntries(Array.isArray(jeData) ? jeData : []);
      setGlAccounts(Array.isArray(accData) ? accData : []);
    } catch (err) {
      console.error('Failed to load accounting data', err);
    } finally {
      setLoading(false);
    }
  };

  // Trial Balance totals
  const totalDebitMinor = trialBalance.reduce((sum, row) => sum + (row.debitMinor || 0), 0);
  const totalCreditMinor = trialBalance.reduce((sum, row) => sum + (row.creditMinor || 0), 0);
  const isTrialBalanceBalanced = totalDebitMinor === totalCreditMinor;

  // Filtered trial balance
  const filteredTrialBalance = trialBalance.filter((row) => {
    const matchesCategory = selectedCategory === 'ALL' || row.type === selectedCategory;
    const matchesSearch =
      !search ||
      row.code.toLowerCase().includes(search.toLowerCase()) ||
      row.name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Filtered journal entries
  const filteredJournalEntries = journalEntries.filter((entry) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      entry.entryNo.toLowerCase().includes(s) ||
      entry.description.toLowerCase().includes(s) ||
      (entry.sourceRefId && entry.sourceRefId.toLowerCase().includes(s))
    );
  });

  // New line calculations for creation modal
  const calcLineDebitMinor = (val: string) => Math.round((parseFloat(val) || 0) * 100);
  const calcLineCreditMinor = (val: string) => Math.round((parseFloat(val) || 0) * 100);

  const modalTotalDebitMinor = newLines.reduce(
    (sum, line) => sum + calcLineDebitMinor(line.debitBaht),
    0
  );
  const modalTotalCreditMinor = newLines.reduce(
    (sum, line) => sum + calcLineCreditMinor(line.creditBaht),
    0
  );
  const isModalBalanced =
    modalTotalDebitMinor === modalTotalCreditMinor && modalTotalDebitMinor > 0;

  const handleAddLine = () => {
    setNewLines([...newLines, { glAccountId: '', debitBaht: '', creditBaht: '' }]);
  };

  const handleRemoveLine = (index: number) => {
    if (newLines.length <= 2) return;
    setNewLines(newLines.filter((_, i) => i !== index));
  };

  const handleCreateJournalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!description.trim()) {
      setModalError('กรุณากรอกคำอธิบายรายการ (Description)');
      return;
    }

    if (!isModalBalanced) {
      setModalError(
        `ยอดรวมเดบิตและเครดิตต้องเท่ากัน และมากกว่า ฿0.00 (ยอดรวมเดบิต: ฿${(modalTotalDebitMinor / 100).toLocaleString()}, ยอดรวมเครดิต: ฿${(modalTotalCreditMinor / 100).toLocaleString()})`
      );
      return;
    }

    // Check all lines have glAccountId
    for (let i = 0; i < newLines.length; i++) {
      const line = newLines[i];
      const dr = calcLineDebitMinor(line.debitBaht);
      const cr = calcLineCreditMinor(line.creditBaht);
      if ((dr > 0 || cr > 0) && !line.glAccountId) {
        setModalError(`กรุณาเลือกผังบัญชีสำหรับรายการที่ ${i + 1}`);
        return;
      }
    }

    const payloadLines = newLines
      .filter((l) => l.glAccountId && (calcLineDebitMinor(l.debitBaht) > 0 || calcLineCreditMinor(l.creditBaht) > 0))
      .map((l) => ({
        glAccountId: l.glAccountId,
        debitMinor: calcLineDebitMinor(l.debitBaht),
        creditMinor: calcLineCreditMinor(l.creditBaht),
      }));

    if (payloadLines.length < 2) {
      setModalError('ต้องมีอย่างน้อย 2 รายการบันทึกบัญชีที่สมบูรณ์');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/accounting/journal-entries', {
        entryNo,
        description,
        type: 'GENERAL',
        lines: payloadLines,
      });

      setIsModalOpen(false);
      setDescription('');
      setNewLines([
        { glAccountId: '', debitBaht: '', creditBaht: '' },
        { glAccountId: '', debitBaht: '', creditBaht: '' },
      ]);
      setEntryNo(
        `JV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`
      );
      fetchData();
    } catch (err: any) {
      setModalError(err?.response?.data?.message || 'เกิดข้อผิดพลาดในการบันทึกสมุดรายวัน');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                สมุดรายวันทั่วไป & งบทดลอง (General Ledger & Trial Balance)
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                ระบบรายงานการลงบัญชีคู่และงบทดลองสมดุลอัตโนมัติ (Automated Double-Entry Accounting)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-sm"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-200"
          >
            <Plus className="w-4 h-4" />
            บันทึกสมุดรายวัน (Journal Entry)
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>ยอดรวมเดบิต (Total Dr)</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">Dr</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            <Money minor={totalDebitMinor} />
          </div>
          <p className="text-xs text-slate-400">เดบิตรวมทุกบัญชีที่บันทึกรายการ</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>ยอดรวมเครดิต (Total Cr)</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">Cr</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            <Money minor={totalCreditMinor} />
          </div>
          <p className="text-xs text-slate-400">เครดิตรวมทุกบัญชีที่บันทึกรายการ</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>ผลต่างงบทดลอง (Trial Balance Variance)</span>
            <Scale className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-800">
            <Money minor={totalDebitMinor - totalCreditMinor} />
          </div>
          <div className="flex items-center gap-1.5">
            {isTrialBalanceBalanced ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> ดุลสมบูรณ์ 100%
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5" /> งบไม่สมดุล
              </span>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>จำนวนบัญชีที่เปิดใช้งาน</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{trialBalance.length}</div>
          <p className="text-xs text-slate-400">บัญชีผังทั้งหมดในระบบ (Chart of Accounts)</p>
        </div>
      </div>

      {/* Tabs & Controls Header */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="border-b border-slate-200 px-6 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('trial-balance')}
              className={`pb-4 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'trial-balance'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Scale className="w-4 h-4" />
              งบทดลอง (Trial Balance)
              <span className="ml-1 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-medium">
                {trialBalance.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('journal-entries')}
              className={`pb-4 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'journal-entries'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              รายการสมุดรายวัน (Journal Entries)
              <span className="ml-1 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-medium">
                {journalEntries.length}
              </span>
            </button>
          </div>

          {/* Search bar */}
          <div className="pb-4 flex items-center gap-3">
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  activeTab === 'trial-balance'
                    ? 'ค้นหาชื่อ หรือรหัสบัญชี...'
                    : 'ค้นหาระบุเลขที่ หรือคำอธิบาย...'
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* TAB 1: TRIAL BALANCE */}
        {activeTab === 'trial-balance' && (
          <div>
            {/* Filter categories */}
            <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 mr-2">
                <SlidersHorizontal className="w-3.5 h-3.5" /> หมวดหมู่:
              </span>
              {['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COGS'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
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

            {/* Trial Balance Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">รหัสบัญชี (Code)</th>
                    <th className="px-6 py-3.5">ชื่อบัญชี (Account Name)</th>
                    <th className="px-6 py-3.5">หมวดบัญชี (Type)</th>
                    <th className="px-6 py-3.5 text-right">เดบิต (Debit)</th>
                    <th className="px-6 py-3.5 text-right">เครดิต (Credit)</th>
                    <th className="px-6 py-3.5 text-right">ยอดยกไป (Net Balance)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        กำลังโหลดข้อมูลผังบัญชีและงบทดลอง...
                      </td>
                    </tr>
                  ) : filteredTrialBalance.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        ไม่พบบัญชีในหมวดหมู่ที่เลือก
                      </td>
                    </tr>
                  ) : (
                    filteredTrialBalance.map((row) => (
                      <tr key={row.glAccountId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-slate-800">
                          <div className="flex items-center gap-2">
                            <span>{row.code}</span>
                            {row.isSystem && (
                              <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                                System
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900">{row.name}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-md ${
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
                          {row.debitMinor > 0 ? <Money minor={row.debitMinor} /> : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-blue-600 font-medium">
                          {row.creditMinor > 0 ? <Money minor={row.creditMinor} /> : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-semibold text-slate-900">
                          <Money minor={Math.abs(row.balanceMinor)} />
                          <span className="text-xs text-slate-400 ml-1">
                            {row.balanceMinor > 0 ? '(Dr)' : row.balanceMinor < 0 ? '(Cr)' : ''}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {/* Footer Totals */}
                {!loading && trialBalance.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-right text-slate-700 font-semibold">
                        ยอดรวมงบทดลองทั้งสิ้น (Grand Total):
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-emerald-700 text-base">
                        <Money minor={totalDebitMinor} />
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-blue-700 text-base">
                        <Money minor={totalCreditMinor} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isTrialBalanceBalanced ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                            <CheckCircle2 className="w-4 h-4" /> ดุลสมบูรณ์
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg">
                            <AlertCircle className="w-4 h-4" /> ไม่สมดุล
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: JOURNAL ENTRIES */}
        {activeTab === 'journal-entries' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="w-10 px-4 py-3.5"></th>
                  <th className="px-6 py-3.5">เลขที่ใบสำคัญ (Entry No)</th>
                  <th className="px-6 py-3.5">วันที่บันทึก (Posting Date)</th>
                  <th className="px-6 py-3.5">คำอธิบายรายการ (Description)</th>
                  <th className="px-6 py-3.5">อ้างอิงเอกสาร (Source Ref)</th>
                  <th className="px-6 py-3.5 text-center">สถานะ (Status)</th>
                  <th className="px-6 py-3.5 text-right">จำนวนเงินรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                      กำลังโหลดรายการสมุดรายวัน...
                    </td>
                  </tr>
                ) : filteredJournalEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      ยังไม่มีรายการสมุดรายวันบันทึกอยู่ในระบบ
                    </td>
                  </tr>
                ) : (
                  filteredJournalEntries.map((entry) => {
                    const isExpanded = expandedEntryId === entry.id;
                    const totalEntryAmount = entry.lines.reduce(
                      (sum, l) => sum + (l.debitMinor || 0),
                      0
                    );

                    return (
                      <tbody key={entry.id} className="divide-y divide-slate-100">
                        <tr
                          onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-4 text-slate-400">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-blue-600" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-blue-700">
                            {entry.entryNo}
                          </td>
                          <td className="px-6 py-4 text-slate-600 text-xs">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {new Date(entry.postedAt).toLocaleDateString('th-TH', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-900">{entry.description}</td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">
                            {entry.sourceRefType ? (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                                {entry.sourceRefType}: {entry.sourceRefId || '-'}
                              </span>
                            ) : (
                              <span className="text-slate-400">บันทึกมือ (Manual)</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                              {entry.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                            <Money minor={totalEntryAmount} />
                          </td>
                        </tr>

                        {/* Detailed journal line items */}
                        {isExpanded && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={7} className="px-10 py-4">
                              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="px-4 py-2 bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-200 flex justify-between">
                                  <span>รายละเอียดเดบิต-เครดิต (Journal Lines Detail)</span>
                                  <span>{entry.lines.length} รายการ</span>
                                </div>
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                    <tr>
                                      <th className="px-4 py-2">รหัสบัญชี</th>
                                      <th className="px-4 py-2">ชื่อบัญชี</th>
                                      <th className="px-4 py-2 text-right">เดบิต (Dr)</th>
                                      <th className="px-4 py-2 text-right">เครดิต (Cr)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-mono">
                                    {entry.lines.map((line) => (
                                      <tr key={line.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 font-bold text-slate-700">
                                          {line.glAccount?.code}
                                        </td>
                                        <td className="px-4 py-2 font-sans font-medium text-slate-900">
                                          {line.glAccount?.name}
                                        </td>
                                        <td className="px-4 py-2 text-right font-bold text-emerald-600">
                                          {line.debitMinor > 0 ? <Money minor={line.debitMinor} /> : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right font-bold text-blue-600">
                                          {line.creditMinor > 0 ? <Money minor={line.creditMinor} /> : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE MANUAL JOURNAL ENTRY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900">บันทึกสมุดรายวันทั่วไป (New Journal Entry)</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateJournalEntry} className="p-6 space-y-5">
              {modalError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เลขที่ใบสำคัญ (Entry No) *
                  </label>
                  <input
                    type="text"
                    value={entryNo}
                    onChange={(e) => setEntryNo(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    คำอธิบายรายการ (Description) *
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ปรับปรุงรายการค่าใช้จ่ายประจำเดือน"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Journal Lines Inputs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    รายการบัญชีเดบิต-เครดิต (Journal Lines) *
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มรายการ
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {newLines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="flex-1">
                        <select
                          value={line.glAccountId}
                          onChange={(e) => {
                            const updated = [...newLines];
                            updated[idx].glAccountId = e.target.value;
                            setNewLines(updated);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">-- เลือกผังบัญชี --</option>
                          {glAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name} ({acc.type})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="เดบิต (฿)"
                          value={line.debitBaht}
                          onChange={(e) => {
                            const updated = [...newLines];
                            updated[idx].debitBaht = e.target.value;
                            if (e.target.value) updated[idx].creditBaht = '';
                            setNewLines(updated);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs text-right border border-slate-200 rounded-lg bg-white font-mono text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="เครดิต (฿)"
                          value={line.creditBaht}
                          onChange={(e) => {
                            const updated = [...newLines];
                            updated[idx].creditBaht = e.target.value;
                            if (e.target.value) updated[idx].debitBaht = '';
                            setNewLines(updated);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs text-right border border-slate-200 rounded-lg bg-white font-mono text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        disabled={newLines.length <= 2}
                        className="text-slate-400 hover:text-rose-600 disabled:opacity-30 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Modal Live Summary */}
                <div className="mt-3 p-3 bg-slate-100 rounded-xl flex items-center justify-between text-xs font-mono border border-slate-200">
                  <div>
                    <span>รวมเดบิต: </span>
                    <span className="font-bold text-emerald-600">
                      ฿{(modalTotalDebitMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span>รวมเครดิต: </span>
                    <span className="font-bold text-blue-600">
                      ฿{(modalTotalCreditMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    {isModalBalanced ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-200/60 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3.5 h-3.5" /> ดุลสมบูรณ์
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded">
                        <AlertCircle className="w-3.5 h-3.5" /> ไม่สมดุล
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting || !isModalBalanced}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-all shadow-sm shadow-blue-200"
                >
                  {submitting ? 'กำลังบันทึก...' : 'บันทึกรายการสมุดรายวัน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
