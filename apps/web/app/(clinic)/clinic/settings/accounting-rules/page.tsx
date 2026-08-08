'use client';

import { useState, useEffect } from 'react';
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
  ToggleLeft,
  ToggleRight,
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
  createdAt: string;
  updatedAt: string;
}

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
];

const REASON_CODE_OPTIONS = [
  { label: 'EXPIRED (สินค้าหมดอายุ)', value: 'EXPIRED' },
  { label: 'DAMAGED (สินค้าชำรุดเสียหาย)', value: 'DAMAGED' },
  { label: 'DEFECTIVE (สินค้ามีตำหนิ/คืนซัพพลายเออร์)', value: 'DEFECTIVE' },
  { label: 'RETURN (รับคืนจากลูกค้า/ส่งคืน)', value: 'RETURN' },
  { label: 'ADJUSTMENT (ปรับปรุงสต็อกทั่วไป)', value: 'ADJUSTMENT' },
];

export default function AccountingRulesPage() {
  const [rules, setRules] = useState<SystemRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<SystemRule | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formEventType, setFormEventType] = useState('inventory.goods_issued');
  const [formPriority, setFormPriority] = useState(10);
  const [formReasonCode, setFormReasonCode] = useState('EXPIRED');
  const [formOperator, setFormOperator] = useState('EQ'); // EQ, NE, IN
  const [formDebitCode, setFormDebitCode] = useState('5290');
  const [formCreditCode, setFormCreditCode] = useState('1310');
  const [formIsActive, setFormIsActive] = useState(true);

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
      setRules(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingRule(null);
    setFormName('');
    setFormDescription('');
    setFormEventType('inventory.goods_issued');
    setFormPriority(10);
    setFormReasonCode('EXPIRED');
    setFormOperator('EQ');
    setFormDebitCode('5290');
    setFormCreditCode('1310');
    setFormIsActive(true);
    setShowModal(true);
  }

  function openEditModal(rule: SystemRule) {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormDescription(rule.description || '');
    setFormEventType(rule.eventType);
    setFormPriority(rule.priority);
    setFormDebitCode(rule.action?.debitAccountCode || '5290');
    setFormCreditCode(rule.action?.creditAccountCode || '1310');
    setFormIsActive(rule.isActive);

    // Extract reasonCode condition
    const cond = rule.conditions || {};
    if (cond.reasonCode) {
      if (typeof cond.reasonCode === 'object' && cond.reasonCode.$in) {
        setFormOperator('IN');
        setFormReasonCode(cond.reasonCode.$in[0] || 'EXPIRED');
      } else if (typeof cond.reasonCode === 'object' && cond.reasonCode.$ne) {
        setFormOperator('NE');
        setFormReasonCode(cond.reasonCode.$ne || 'EXPIRED');
      } else {
        setFormOperator('EQ');
        setFormReasonCode(typeof cond.reasonCode === 'string' ? cond.reasonCode : 'EXPIRED');
      }
    } else {
      setFormOperator('EQ');
      setFormReasonCode('EXPIRED');
    }

    setShowModal(true);
  }

  async function handleSaveRule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Build conditions object
    let conditionsPayload: Record<string, any> = {};
    if (formOperator === 'EQ') {
      conditionsPayload = { reasonCode: formReasonCode };
    } else if (formOperator === 'NE') {
      conditionsPayload = { reasonCode: { $ne: formReasonCode } };
    } else if (formOperator === 'IN') {
      conditionsPayload = { reasonCode: { $in: [formReasonCode] } };
    }

    const payload = {
      name: formName,
      description: formDescription || undefined,
      eventType: formEventType,
      priority: Number(formPriority),
      conditions: conditionsPayload,
      action: {
        debitAccountCode: formDebitCode,
        creditAccountCode: formCreditCode,
      },
      isActive: formIsActive,
    };

    try {
      const url = editingRule
        ? `/api/v1/accounting/system-rules/${editingRule.id}`
        : '/api/v1/accounting/system-rules';
      const method = editingRule ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || errData.error?.message || 'บันทึกข้อมูลไม่สำเร็จ');
      }

      setShowModal(false);
      setSuccessMsg(editingRule ? 'แก้ไขกฎการลงบัญชีเรียบร้อยแล้ว' : 'สร้างกฎการลงบัญชีใหม่เรียบร้อยแล้ว');
      setTimeout(() => setSuccessMsg(''), 4000);
      await fetchRules();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(rule: SystemRule) {
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
    if (!deletingRule) return;
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

  // Filter Rules
  const filteredRules = rules.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesEvent = selectedEventType === 'ALL' || r.eventType === selectedEventType;
    const matchesStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'ACTIVE' && r.isActive) ||
      (selectedStatus === 'INACTIVE' && !r.isActive);
    return matchesSearch && matchesEvent && matchesStatus;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
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
                กำหนดกฎ JSON Rule Engine เพื่อระบุผังบัญชีเดบิตและเครดิตอัตโนมัติเมื่อเกิดกิจกรรมคลังสินค้า
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all duration-150 space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>สร้างกฎใหม่ (Create Rule)</span>
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
              <span className="font-bold text-base text-amber-950">Hard Rule Compliance Notice (ข้อกำหนดตามกฎหมายภาษี)</span>
              <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded text-xs font-semibold">Native Override</span>
            </div>
            <p className="text-amber-800/90 leading-relaxed">
              ตามประมวลรัษฎากร รายการสินค้าขาดหายที่ไม่มีสาเหตุสมควร (Reason Code: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold">SHRINKAGE</code>) 
              ระบบจะบังคับบันทึกเป็น <strong className="text-amber-950">การขาย (Deemed Sale)</strong> โดยอัตโนมัติ: 
              <span className="inline-flex items-center mx-1 font-mono font-bold bg-amber-200/60 px-2 py-0.5 rounded text-amber-950">Dr. 4110 Revenue</span> ➔ 
              <span className="inline-flex items-center mx-1 font-mono font-bold bg-amber-200/60 px-2 py-0.5 rounded text-amber-950">Cr. 1310 Inventory Asset</span> 
              กฎนี้ถูกบังคับใช้ในระดับ Domain Logic ไม่สามารถปิดการใช้งานหรือเขียนทับด้วย Dynamic Rule ได้
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white border rounded-xl p-4 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อกฎ หรือคำอธิบาย..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
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
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">ทุกสถานะ (All Status)</option>
            <option value="ACTIVE">เปิดใช้งาน (Active Only)</option>
            <option value="INACTIVE">ปิดใช้งาน (Inactive Only)</option>
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

      {/* Rules List */}
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
            <span className="text-xs text-gray-400">กดปุ่ม "+ สร้างกฎใหม่" เพื่อเพิ่มกฎสำหรับจับคู่ผังบัญชีอัตโนมัติ</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-gray-50 border-b text-gray-600 uppercase text-xs font-semibold">
                <tr>
                  <th className="py-3.5 px-4 w-20 text-center">Priority</th>
                  <th className="py-3.5 px-4">ชื่อกฎ & คำอธิบาย</th>
                  <th className="py-3.5 px-4">เหตุการณ์ (Event)</th>
                  <th className="py-3.5 px-4">เงื่อนไข (Condition)</th>
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
                    <tr key={rule.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono font-semibold">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-md text-xs">
                          #{rule.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{rule.name}</div>
                        {rule.description && (
                          <div className="text-xs text-gray-500 mt-0.5">{rule.description}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium border border-blue-200/60">
                          {rule.eventType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <span className="inline-flex items-center px-2 py-1 bg-purple-50 text-purple-700 rounded-md border border-purple-200/60 space-x-1">
                          <Tag className="w-3 h-3 text-purple-500" />
                          <span>{condStr}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-800 rounded border border-emerald-200 font-mono font-semibold">
                            Dr. {rule.action?.debitAccountCode} ({debitAcc?.name.split(' ')[0] || ''})
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="px-2 py-1 bg-rose-50 text-rose-800 rounded border border-rose-200 font-mono font-semibold">
                            Cr. {rule.action?.creditAccountCode} ({creditAcc?.name.split(' ')[0] || ''})
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(rule)}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
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
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1">
                        <button
                          onClick={() => openEditModal(rule)}
                          className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md transition-colors"
                          title="แก้ไขกฎ"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingRule(rule)}
                          className="p-1.5 hover:bg-red-50 text-red-600 rounded-md transition-colors"
                          title="ลบกฎ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create / Edit Rule */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 text-lg">
                {editingRule ? 'แก้ไขกฎการลงบัญชี (Edit Rule)' : 'สร้างกฎการลงบัญชีใหม่ (New Rule)'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ชื่อกฎ (Rule Name) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="เช่น Expired Inventory Loss Rule"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ลำดับความสำคัญ (Priority) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formPriority}
                    onChange={(e) => setFormPriority(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-gray-400">ตัวเลขยิ่งมาก ยิ่งถูกประเมินก่อน (เช่น 20 &gt; 10)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">คำอธิบายเพิ่มเติม (Description)</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="เช่น ลงบัญชีขาดทุนกรณีสินค้าหมดอายุตัดทิ้ง"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ประเภทเหตุการณ์ (Event Type) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formEventType}
                  onChange={(e) => setFormEventType(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {EVENT_TYPES.map((ev) => (
                    <option key={ev.value} value={ev.value}>{ev.label}</option>
                  ))}
                </select>
              </div>

              {/* Condition Section */}
              <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-xs text-purple-900 uppercase tracking-wider flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-purple-600" />
                  <span>เงื่อนไขการตรวจจับ (Condition Settings)</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">เงื่อนไข Operator</label>
                    <select
                      value={formOperator}
                      onChange={(e) => setFormOperator(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="EQ">Equals ($eq - เท่ากับ)</option>
                      <option value="NE">Not Equals ($ne - ไม่เท่ากับ)</option>
                      <option value="IN">In Array ($in - ตรงกับกลุ่ม)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">เหตุผลสินค้า (Reason Code)</label>
                    <select
                      value={formReasonCode}
                      onChange={(e) => setFormReasonCode(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-purple-500 font-mono"
                    >
                      {REASON_CODE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Accounts Section */}
              <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-xs text-blue-900 uppercase tracking-wider flex items-center space-x-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                  <span>ผังบัญชีเป้าหมาย (GL Action Mapping)</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-emerald-800 mb-1 font-semibold">
                      Debit Account (Dr. ฝั่งเดบิต)
                    </label>
                    <select
                      value={formDebitCode}
                      onChange={(e) => setFormDebitCode(e.target.value)}
                      className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500"
                    >
                      {STANDARD_GL_ACCOUNTS.map((acc) => (
                        <option key={acc.code} value={acc.code}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-rose-800 mb-1 font-semibold">
                      Credit Account (Cr. ฝั่งเครดิต)
                    </label>
                    <select
                      value={formCreditCode}
                      onChange={(e) => setFormCreditCode(e.target.value)}
                      className="w-full border border-rose-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-rose-500"
                    >
                      {STANDARD_GL_ACCOUNTS.map((acc) => (
                        <option key={acc.code} value={acc.code}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <label htmlFor="isActiveCheck" className="text-sm font-medium text-gray-700">
                  เปิดใช้งานกฎนี้ทันที (Active Rule)
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm disabled:opacity-50"
                >
                  {saving ? 'กำลังบันทึก...' : editingRule ? 'บันทึกการแก้ไข' : 'สร้างกฎใหม่'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingRule && (
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
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDeleteRule}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
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
