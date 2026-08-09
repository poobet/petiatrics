'use client';

import React, { useEffect, useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  Calendar,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Money } from '@/components/ui/money';
import { ManualJournalForm } from '@/components/accounting/manual-journal-form';

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

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // New Journal Entry Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchJournalEntries = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<JournalEntry[]>('/accounting/journal-entries');
      if (Array.isArray(data)) {
        setEntries(data);
      }
    } catch (err) {
      console.error('Failed to load journal entries', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournalEntries();
  }, []);

  // Filter journal entries by search term
  const filteredEntries = entries.filter((entry) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      entry.entryNo.toLowerCase().includes(s) ||
      entry.description.toLowerCase().includes(s) ||
      (entry.sourceRefId && entry.sourceRefId.toLowerCase().includes(s)) ||
      (entry.sourceRefType && entry.sourceRefType.toLowerCase().includes(s))
    );
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              สมุดรายวันทั่วไป (General Ledger Journal Entries)
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              รายการบันทึกสมุดรายวันและประวัติการโอนบัญชีคู่ (Audit Trail & Double-Entry Ledger)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchJournalEntries}
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
            บันทึกสมุดรายวัน (Create Journal Entry)
          </button>
        </div>
      </div>

      {/* Main Journal Data Table & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">รายการสมุดรายวันทั้งหมด</span>
            <span className="px-2.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-bold">
              {entries.length} รายการ
            </span>
          </div>

          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่, คำอธิบาย หรือเอกสารอ้างอิง..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

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
                <th className="px-6 py-3.5 text-center w-28">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    กำลังโหลดรายการสมุดรายวัน...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    ยังไม่มีรายการสมุดรายวันบันทึกอยู่ในระบบ
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const isExpanded = expandedEntryId === entry.id;
                  const isPosted = entry.status === 'POSTED' || entry.status === 'Posted';
                  const totalEntryAmount = entry.lines.reduce(
                    (sum, l) => sum + (l.debitMinor || 0),
                    0
                  );

                  return (
                    <React.Fragment key={entry.id}>
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
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-lg border ${
                              isPosted
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" /> {entry.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                          <Money minor={totalEntryAmount} />
                        </td>
                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          {/* Business Rule Enforcement: Once Posted, MUST NOT show Edit/Delete buttons */}
                          {isPosted ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium px-2 py-1 bg-slate-100 rounded-lg cursor-default"
                              title="รายการที่ผ่านบัญชี (Posted) แล้ว ล็อกเพื่อป้องกันการแก้ไขหรือลบตามมาตรฐานการบัญชี"
                            >
                              <Lock className="w-3 h-3 text-slate-400" /> อ่านอย่างเดียว
                            </span>
                          ) : (
                            <button
                              onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                              className="text-xs text-blue-600 font-semibold hover:underline"
                            >
                              รายละเอียด
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Detailed Journal Line Items */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={8} className="px-10 py-4">
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                              <div className="px-5 py-3 bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-200 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <FileText className="w-4 h-4 text-blue-600" />
                                  รายละเอียดรายการบันทึกคู่เดบิต-เครดิต ({entry.entryNo})
                                </span>
                                <span className="text-slate-500">{entry.lines.length} บรรทัด</span>
                              </div>
                              <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                                  <tr>
                                    <th className="px-5 py-2.5 w-32">รหัสบัญชี</th>
                                    <th className="px-5 py-2.5">ชื่อผังบัญชี</th>
                                    <th className="px-5 py-2.5 text-right w-40">เดบิต (Debit ฿)</th>
                                    <th className="px-5 py-2.5 text-right w-40">เครดิต (Credit ฿)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-mono">
                                  {entry.lines.map((line) => (
                                    <tr key={line.id} className="hover:bg-slate-50">
                                      <td className="px-5 py-2.5 font-bold text-slate-800">
                                        {line.glAccount?.code || '-'}
                                      </td>
                                      <td className="px-5 py-2.5 font-sans font-medium text-slate-900">
                                        {line.glAccount?.name || '-'}
                                      </td>
                                      <td className="px-5 py-2.5 text-right font-bold text-emerald-600">
                                        {line.debitMinor > 0 ? (
                                          <Money minor={line.debitMinor} />
                                        ) : (
                                          <span className="text-slate-300">-</span>
                                        )}
                                      </td>
                                      <td className="px-5 py-2.5 text-right font-bold text-blue-600">
                                        {line.creditMinor > 0 ? (
                                          <Money minor={line.creditMinor} />
                                        ) : (
                                          <span className="text-slate-300">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t border-slate-200 font-sans font-semibold text-slate-700">
                                  <tr>
                                    <td colSpan={2} className="px-5 py-2.5 text-right">
                                      รวมยอดเดบิตและเครดิต:
                                    </td>
                                    <td className="px-5 py-2.5 text-right font-mono text-emerald-700 font-bold">
                                      <Money minor={totalEntryAmount} />
                                    </td>
                                    <td className="px-5 py-2.5 text-right font-mono text-blue-700 font-bold">
                                      <Money minor={totalEntryAmount} />
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MANUAL JOURNAL ENTRY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900">บันทึกสมุดรายวันทั่วไป (Manual Journal Entry)</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <ManualJournalForm
                onSuccess={() => {
                  setIsModalOpen(false);
                  fetchJournalEntries();
                }}
                onCancel={() => setIsModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
