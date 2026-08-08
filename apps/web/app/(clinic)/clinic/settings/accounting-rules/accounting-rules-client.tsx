'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  SlidersHorizontal,
  Plus,
  Search,
  ShieldAlert,
  Edit2,
  Trash2,
  Check,
  X,
  ArrowRight,
  RefreshCw,
  Tag,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Lock,
  Cog,
  UserCheck,
} from 'lucide-react';

interface SystemRule {
  id: string;
  clinicId?: string | null;
  name: string;
  description?: string | null;
  eventType: string;
  priority: number;
  conditions: Record<string, any>;
  action: {
    debitAccountCode: string;
    creditAccountCode: string;
  };
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  isBuiltIn?: boolean;
  ruleCategory?: 'HARD_RULE' | 'SYSTEM_DEFAULT' | 'CUSTOM';
}

// System Built-in Rules (Read-Only System Defaults & Hard Compliance Rules)
const BUILTIN_SYSTEM_RULES: SystemRule[] = [
  {
    id: 'system-hard-shrinkage',
    name: 'Shortage Deemed Sale Compliance (สินค้าขาดหายถือเป็นขายเพื่อภาษี)',
    description: 'ตามประมวลรัษฎากร (VAT & CIT) สินค้าขาดหายไม่มีเหตุผล (SHRINKAGE) ถูกถือเป็นการขาย บังคับลง Dr. 4110 / Cr. 1310 ในระดับ Domain Layer เสมอ',
    eventType: 'inventory.goods_issued',
    priority: 999,
    conditions: { fact: 'reasonCode', operator: 'equal', value: 'SHRINKAGE' },
    action: { debitAccountCode: '4110', creditAccountCode: '1310' },
    isActive: true,
    isBuiltIn: true,
    ruleCategory: 'HARD_RULE',
  },
  {
    id: 'system-default-grn',
    name: 'Default Goods Receipt Posting (รับสินค้าเข้าคลังมาตรฐาน)',
    description: 'การตั้งหนี้เจ้าหนี้การค้าและบันทึกมูลค่าสินค้ารวมคลังจากการรับสินค้าเข้าสต็อก',
    eventType: 'inventory.goods_receipt_completed',
    priority: 0,
    conditions: { fact: 'reasonCode', operator: 'equal', value: 'DEFAULT' },
    action: { debitAccountCode: '1310', creditAccountCode: '2110' },
    isActive: true,
    isBuiltIn: true,
    ruleCategory: 'SYSTEM_DEFAULT',
  },
  {
    id: 'system-default-issue',
    name: 'Default Goods Issue COGS Posting (ตัดจ่ายสินค้าเข้าต้นทุนขาย)',
    description: 'บันทึกต้นทุนขายสินค้า (COGS) และลดมูลค่าสินค้าคงเหลือจากการเบิกจ่ายสินค้าใช้งานปกติ',
    eventType: 'inventory.goods_issued',
    priority: 0,
    conditions: { fact: 'reasonCode', operator: 'equal', value: 'DEFAULT' },
    action: { debitAccountCode: '5110', creditAccountCode: '1310' },
    isActive: true,
    isBuiltIn: true,
    ruleCategory: 'SYSTEM_DEFAULT',
  },
  {
    id: 'system-default-tolerance-pass',
    name: '3-Way Matching Auto-Pass (ส่วนต่างเบิกจ่าย <= 100 บาท)',
    description: 'ส่วนต่างใบแจ้งหนี้ผู้ขายกับ PO/GR ไม่เกิน 100 บาท ระบบอนุมัติผ่านเงื่อนไข (PASS) ให้ตั้งฎีกาเบิกจ่ายอัตโนมัติ',
    eventType: 'procurement.three_way_matching',
    priority: 0,
    conditions: { fact: 'varianceAmountMinor', operator: 'lessThanInclusive', value: 10000 },
    action: { debitAccountCode: 'AUTO_PASS', creditAccountCode: 'DISBURSEMENT_OK' },
    isActive: true,
    isBuiltIn: true,
    ruleCategory: 'SYSTEM_DEFAULT',
  },
];

// Predefined GL Accounts for easy selection in dropdowns
const STANDARD_GL_ACCOUNTS = [
  { code: '1310', name: 'Inventory Asset (สินค้ารวมคลัง)', type: 'ASSET' },
  { code: '2110', name: 'Accounts Payable (เจ้าหนี้การค้า)', type: 'LIABILITY' },
  { code: '2170', name: 'Output VAT (ภาษีขาย)', type: 'LIABILITY' },
  { code: '4110', name: 'Revenue (รายได้จากการขาย/ถือเป็นขาย)', type: 'REVENUE' },
  { code: '5110', name: 'Cost of Goods Sold (ต้นทุนขาย COGS)', type: 'COGS' },
  { code: '5290', name: 'Write-down Loss LCNRV (ผลขาดทุนจากมูลค่าสินค้าหมดอายุ/ลดลง)', type: 'EXPENSE' },
  { code: '5291', name: 'Damaged Inventory Expense (ผลขาดทุนจากสินค้าชำรุด)', type: 'EXPENSE' },
  { code: '6000', name: 'General Operating Expense (ค่าใช้จ่ายดำเนินงานทั่วไป)', type: 'EXPENSE' },
];

const EVENT_TYPES = [
  { label: 'Goods Issued (ตัดจ่ายสินค้าออก)', value: 'inventory.goods_issued' },
  { label: 'Goods Receipt Completed (รับสินค้าเข้าสต็อก)', value: 'inventory.goods_receipt_completed' },
  { label: '3-Way Matching Variance (ส่วนต่างจับคู่เบิกจ่าย PO/GR/Invoice)', value: 'procurement.three_way_matching' },
];

export default function AccountingRulesClient() {
  const router = useRouter();
  const [customRules, setCustomRules] = useState<SystemRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL'); // ALL, SYSTEM, CUSTOM
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Delete Modal
  const [deletingRule, setDeletingRule] = useState<SystemRule | null>(null);

  useEffect(() => {
    fetchRules();
  }, []);

  async function fetchRules() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/accounting/system-rules');
      if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลกฎการลงบัญชีได้');
      const data = await res.json();
      const rawRules = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setCustomRules(rawRules.map((r: SystemRule) => ({ ...r, ruleCategory: 'CUSTOM' })));
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(rule: SystemRule) {
    if (rule.isBuiltIn) return;
    try {
      const res = await fetch(`/api/v1/accounting/system-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      if (!res.ok) throw new Error('ไม่สามารถเปลี่ยนสถานะได้');
      await fetchRules();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteRule() {
    if (!deletingRule || deletingRule.isBuiltIn) return;
    try {
      const res = await fetch(`/api/v1/accounting/system-rules/${deletingRule.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('ไม่สามารถลบกฎได้');
      setDeletingRule(null);
      setSuccessMsg('ลบกฎการลงบัญชีเรียบร้อยแล้ว');
      setTimeout(() => setSuccessMsg(''), 4000);
      await fetchRules();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Combine System Built-in rules + Custom Clinic rules
  const allCombinedRules = [...BUILTIN_SYSTEM_RULES, ...customRules];

  // Filter Rules
  const filteredRules = allCombinedRules.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesEvent = selectedEventType === 'ALL' || r.eventType === selectedEventType;
    const matchesStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'ACTIVE' && r.isActive) ||
      (selectedStatus === 'INACTIVE' && !r.isActive);
    const matchesCategory =
      selectedCategory === 'ALL' ||
      (selectedCategory === 'SYSTEM' && r.isBuiltIn) ||
      (selectedCategory === 'CUSTOM' && !r.isBuiltIn);

    return matchesSearch && matchesEvent && matchesStatus && matchesCategory;
  });

  return (
    <div className="p-6 w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dynamic Accounting Rules (กฎบันทึกบัญชีอัตโนมัติ)</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                กำหนดและจัดการกฎ Dynamic Rule Engine (Fact / Operator / Value) สำหรับประเมินและผูกผังบัญชีเดบิต-เครดิตอัตโนมัติ
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push('/clinic/settings/accounting-rules/new')}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all duration-150 space-x-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>สร้างกฎใหม่ (Create Custom Dynamic Rule)</span>
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-sm text-red-700">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-sm text-emerald-700">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Hard Rule Compliance Banner */}
      <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start space-x-3.5">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-sm text-amber-900">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base text-amber-950">Hard Rule Compliance Notice (กฎหมายบังคับภาษี VAT/CIT)</span>
              <span className="px-2 py-0.5 bg-amber-200 text-amber-950 rounded text-xs font-bold border border-amber-300">SYSTEM HARD RULE</span>
            </div>
            <p className="text-amber-800/90 leading-relaxed">
              ตามประมวลรัษฎากร รายการสินค้าขาดหายที่ไม่มีสาเหตุสมควร (Reason Code: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold">SHRINKAGE</code>) 
              ระบบจะบังคับบันทึกเป็น <strong className="text-amber-950">การขาย (Deemed Sale)</strong> โดยอัตโนมัติ: 
              <span className="inline-flex items-center mx-1 font-mono font-bold bg-amber-200/60 px-2 py-0.5 rounded text-amber-950">Dr. 4110 Revenue</span> ➔ 
              <span className="inline-flex items-center mx-1 font-mono font-bold bg-amber-200/60 px-2 py-0.5 rounded text-amber-950">Cr. 1310 Inventory Asset</span> 
              กฎนี้ถูกบังคับใช้ในระดับ Domain Layer เสมอ ไม่สามารถถูกเขียนทับด้วย Dynamic Rule ได้
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white border rounded-xl p-4 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อกฎ หรือคำอธิบาย..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">ประเภทกฎ: ทั้งหมด (All Rules)</option>
            <option value="SYSTEM">⚙️ กฎมาตรฐานระบบ (System Rules)</option>
            <option value="CUSTOM">✏️ กฎของคลินิก (Custom Rules)</option>
          </select>
          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">ทุกเหตุการณ์ (All Events)</option>
            {EVENT_TYPES.map((ev) => (
              <option key={ev.value} value={ev.value}>{ev.label}</option>
            ))}
          </select>
          <button
            onClick={fetchRules}
            title="โหลดข้อมูลใหม่"
            className="p-2 border rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Rules List Table */}
      <div className="bg-white border rounded-xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span>กำลังโหลดข้อมูลกฎการลงบัญชี...</span>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500 flex flex-col items-center justify-center space-y-2">
            <BookOpen className="w-8 h-8 text-gray-300" />
            <span className="font-medium text-gray-700">ไม่พบข้อมูลกฎการลงบัญชี</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-gray-50 border-b text-gray-600 uppercase text-xs font-semibold">
                <tr>
                  <th className="py-3.5 px-4 w-28 text-center">ประเภทกฎ</th>
                  <th className="py-3.5 px-4 w-20 text-center">Priority</th>
                  <th className="py-3.5 px-4">ชื่อกฎ & คำอธิบาย</th>
                  <th className="py-3.5 px-4">เหตุการณ์ (Event)</th>
                  <th className="py-3.5 px-4">เงื่อนไข (Dynamic Conditions Spec)</th>
                  <th className="py-3.5 px-4">การแมปบัญชี (GL Action)</th>
                  <th className="py-3.5 px-4 text-center">สถานะ</th>
                  <th className="py-3.5 px-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredRules.map((rule) => {
                  const condStr = JSON.stringify(rule.conditions);
                  const debitAcc = STANDARD_GL_ACCOUNTS.find((g) => g.code === rule.action?.debitAccountCode);
                  const creditAcc = STANDARD_GL_ACCOUNTS.find((g) => g.code === rule.action?.creditAccountCode);

                  return (
                    <tr
                      key={rule.id}
                      className={`transition-colors ${
                        rule.ruleCategory === 'HARD_RULE'
                          ? 'bg-amber-50/40 hover:bg-amber-50/80'
                          : rule.isBuiltIn
                          ? 'bg-slate-50/50 hover:bg-slate-50'
                          : 'hover:bg-gray-50/80'
                      }`}
                    >
                      {/* Rule Category Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {rule.ruleCategory === 'HARD_RULE' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[11px] font-bold">
                            <ShieldAlert className="w-3 h-3 text-amber-700 shrink-0" />
                            <span>Hard Rule</span>
                          </span>
                        ) : rule.isBuiltIn ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-[11px] font-semibold">
                            <Cog className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>System Rule</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-purple-100 text-purple-800 border border-purple-200 rounded-md text-[11px] font-semibold">
                            <UserCheck className="w-3 h-3 text-purple-600 shrink-0" />
                            <span>Custom Rule</span>
                          </span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4 text-center font-mono font-semibold">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            rule.priority >= 900
                              ? 'bg-amber-200 text-amber-950 font-bold'
                              : rule.priority > 0
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          #{rule.priority}
                        </span>
                      </td>

                      {/* Rule Name & Description */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 flex items-center space-x-1.5">
                          <span>{rule.name}</span>
                          {rule.isBuiltIn && (
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono font-normal">
                              Read-Only
                            </span>
                          )}
                        </div>
                        {rule.description && (
                          <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{rule.description}</div>
                        )}
                      </td>

                      {/* Event Type */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium border border-blue-200/60">
                          {rule.eventType}
                        </span>
                      </td>

                      {/* Dynamic Conditions Spec Display */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        {rule.conditions?.fact ? (
                          <div className="inline-flex items-center space-x-1 px-2.5 py-1 bg-purple-50 text-purple-900 rounded-md border border-purple-200">
                            <span className="font-bold text-purple-700">{rule.conditions.fact}</span>
                            <span className="text-purple-500 font-semibold">{rule.conditions.operator}</span>
                            <span className="font-bold text-emerald-700">{JSON.stringify(rule.conditions.value)}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 bg-purple-50 text-purple-700 rounded-md border border-purple-200/60 space-x-1">
                            <Tag className="w-3 h-3 text-purple-500" />
                            <span>{condStr}</span>
                          </span>
                        )}
                      </td>

                      {/* Action Account Mapping */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-800 rounded border border-emerald-200 font-mono font-semibold">
                            Dr. {rule.action?.debitAccountCode} ({debitAcc?.name.split(' ')[0] || rule.action?.debitAccountCode})
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="px-2 py-1 bg-rose-50 text-rose-800 rounded border border-rose-200 font-mono font-semibold">
                            Cr. {rule.action?.creditAccountCode} ({creditAcc?.name.split(' ')[0] || rule.action?.creditAccountCode})
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {rule.isBuiltIn ? (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold inline-flex items-center space-x-1">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Active (Built-in)</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(rule)}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                              rule.isActive
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {rule.isActive ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <X className="w-3.5 h-3.5 text-gray-400" />
                                <span>Disabled</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 text-right">
                        {rule.isBuiltIn ? (
                          <span className="text-xs text-gray-400 inline-flex items-center space-x-1 font-mono">
                            <Lock className="w-3 h-3" />
                            <span>System</span>
                          </span>
                        ) : (
                          <div className="space-x-1">
                            <button
                              onClick={() => router.push(`/clinic/settings/accounting-rules/${rule.id}/edit`)}
                              className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md transition-colors cursor-pointer"
                              title="แก้ไขกฎ (ไปยังหน้าแก้ไข)"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingRule(rule)}
                              className="p-1.5 hover:bg-red-50 text-red-600 rounded-md transition-colors cursor-pointer"
                              title="ลบกฎ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingRule && !deletingRule.isBuiltIn && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-lg text-gray-900">ยืนยันการลบกฎบัญชี</h3>
            </div>
            <p className="text-sm text-gray-600">
              คุณต้องการลบกฎ <strong className="text-gray-900">"{deletingRule.name}"</strong> ใช่หรือไม่? การดำเนินการนี้จะไม่สามารถย้อนคืนได้
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setDeletingRule(null)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDeleteRule}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium cursor-pointer"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
