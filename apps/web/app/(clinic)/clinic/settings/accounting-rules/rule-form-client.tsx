'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Sliders,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Check,
  FileText,
  Sparkles,
  ShieldCheck,
  ZapOff,
  Zap,
} from 'lucide-react';

interface RuleFormClientProps {
  ruleId?: string; // If provided, we are editing an existing rule
}

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

const REASON_CODE_OPTIONS = [
  { label: 'EXPIRED (สินค้าหมดอายุ)', value: 'EXPIRED' },
  { label: 'DAMAGED (สินค้าชำรุดเสียหาย)', value: 'DAMAGED' },
  { label: 'DEFECTIVE (สินค้ามีตำหนิ/คืนซัพพลายเออร์)', value: 'DEFECTIVE' },
  { label: 'RETURN (รับคืนจากลูกค้า/ส่งคืน)', value: 'RETURN' },
  { label: 'ADJUSTMENT (ปรับปรุงสต็อกทั่วไป)', value: 'ADJUSTMENT' },
  { label: 'VARIANCE_LE_100 (ส่วนต่าง variance <= 100 บาท -> Auto PASS)', value: 'VARIANCE_LE_100' },
  { label: 'VARIANCE_GT_100 (ส่วนต่าง variance > 100 บาท -> PENDING_REVIEW)', value: 'VARIANCE_GT_100' },
];

const DYNAMIC_FACT_SUGGESTIONS = [
  { label: 'varianceAmountMinor (ส่วนต่างยอดเงิน - สตางค์)', value: 'varianceAmountMinor' },
  { label: 'reasonCode (รหัสเหตุผลตัดจ่าย/รับสินค้า)', value: 'reasonCode' },
  { label: 'quantity (จำนวนสินค้า)', value: 'quantity' },
  { label: 'totalAmountMinor (มูลค่ารวม - สตางค์)', value: 'totalAmountMinor' },
  { label: 'unitPriceMinor (ราคาต่อหน่วย - สตางค์)', value: 'unitPriceMinor' },
];

const OPERATOR_OPTIONS = [
  { label: '<= lessThanInclusive (น้อยกว่าหรือเท่ากับ)', value: 'lessThanInclusive' },
  { label: '> greaterThan (มากกว่า)', value: 'greaterThan' },
  { label: '>= greaterThanInclusive (มากกว่าหรือเท่ากับ)', value: 'greaterThanInclusive' },
  { label: '< lessThan (น้อยกว่า)', value: 'lessThan' },
  { label: '== equal (เท่ากับ)', value: 'equal' },
  { label: '!= notEqual (ไม่เท่ากับ)', value: 'notEqual' },
  { label: 'IN in (อยู่ในกลุ่ม array)', value: 'in' },
];

export default function RuleFormClient({ ruleId }: RuleFormClientProps) {
  const router = useRouter();
  const isEditing = Boolean(ruleId);

  // Wizard Step State (1: Basic Info, 2: Condition Builder, 3: GL Mapping & Review)
  const [currentStep, setCurrentStep] = useState<number>(1);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Step 1: Basic Info Form State
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formEventType, setFormEventType] = useState('inventory.goods_issued');
  const [formPriority, setFormPriority] = useState(10);

  // Step 2: Condition Mode (PRESET vs DYNAMIC)
  const [conditionMode, setConditionMode] = useState<'PRESET' | 'DYNAMIC'>('DYNAMIC');
  const [formReasonCode, setFormReasonCode] = useState('EXPIRED');
  const [formFactKey, setFormFactKey] = useState('varianceAmountMinor');
  const [formOperator, setFormOperator] = useState('lessThanInclusive');
  const [formValue, setFormValue] = useState<string>('10000');
  const [formValueType, setFormValueType] = useState<'NUMBER' | 'STRING'>('NUMBER');

  // Step 3: GL Action Accounts & Execution Control Mode
  const [formDebitCode, setFormDebitCode] = useState('5290');
  const [formCreditCode, setFormCreditCode] = useState('1310');
  
  // Execution Control: MANUAL_REVIEW (Default - ไม่ลงอัตโนมัติ) vs AUTO_POST (ลงอัตโนมัติ)
  const [formExecutionMode, setFormExecutionMode] = useState<'MANUAL_REVIEW' | 'AUTO_POST'>('MANUAL_REVIEW');
  const [formIsActive, setFormIsActive] = useState(true);

  // Use a ref to prevent double-fetch in React StrictMode (dev) and on spurious re-renders.
  // Only [ruleId] as dep — isEditing is purely derived from ruleId so adding it would
  // cause a second fire when the parent re-renders.
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (ruleId && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchRuleData(ruleId);
    }
  }, [ruleId]);

  async function fetchRuleData(id: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/accounting/system-rules/${id}`);
      if (!res.ok) throw new Error('ไม่สามารถโหลดข้อมูลกฎการลงบัญชีได้');
      const data = await res.json();
      const rule = data?.data || data;

      setFormName(rule.name || '');
      setFormDescription(rule.description || '');
      setFormEventType(rule.eventType || 'inventory.goods_issued');
      setFormPriority(rule.priority || 10);
      setFormDebitCode(rule.action?.debitAccountCode || '5290');
      setFormCreditCode(rule.action?.creditAccountCode || '1310');
      setFormIsActive(rule.isActive !== undefined ? rule.isActive : true);

      if (rule.action?.autoPost === true && rule.action?.requireApproval === false) {
        setFormExecutionMode('AUTO_POST');
      } else {
        setFormExecutionMode('MANUAL_REVIEW');
      }

      const cond = rule.conditions || {};
      if (cond.fact && cond.operator !== undefined && cond.value !== undefined) {
        setConditionMode('DYNAMIC');
        setFormFactKey(String(cond.fact));
        setFormOperator(String(cond.operator));
        setFormValue(String(cond.value));
        setFormValueType(typeof cond.value === 'number' ? 'NUMBER' : 'STRING');
      } else if (cond.varianceAmountMinor) {
        setConditionMode('DYNAMIC');
        setFormFactKey('varianceAmountMinor');
        if (cond.varianceAmountMinor.$lte) {
          setFormOperator('lessThanInclusive');
          setFormValue(String(cond.varianceAmountMinor.$lte));
        } else if (cond.varianceAmountMinor.$gt) {
          setFormOperator('greaterThan');
          setFormValue(String(cond.varianceAmountMinor.$gt));
        }
        setFormValueType('NUMBER');
      } else if (cond.reasonCode) {
        setConditionMode('PRESET');
        setFormReasonCode(typeof cond.reasonCode === 'string' ? cond.reasonCode : 'EXPIRED');
      } else {
        setConditionMode('DYNAMIC');
        setFormFactKey('reasonCode');
        setFormOperator('equal');
        setFormValue('EXPIRED');
        setFormValueType('STRING');
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  }

  function handleNextStep() {
    setError('');
    if (currentStep === 1) {
      if (!formName.trim()) {
        setError('กรุณากรอกชื่อกฎ (Rule Name)');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (conditionMode === 'DYNAMIC') {
        if (!formFactKey.trim()) {
          setError('กรุณาระบุฟิลด์ที่ต้องการตรวจจับ (Fact Key)');
          return;
        }
        if (!formValue.trim()) {
          setError('กรุณาระบุค่าที่ต้องการเปรียบเทียบ (Value)');
          return;
        }
      }
      setCurrentStep(3);
    }
  }

  function handlePrevStep() {
    setError('');
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }

  // FORM AUTO-SUBMIT GUARD: Block Enter keypress on inputs
  function handleKeyDownBlockEnter(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // EXPLICIT SAVE HANDLER — Only triggered when the user clicks the Save button at Step 3.
  // The `currentStep !== 3` guard is the primary firewall; the button itself is also
  // conditionally rendered only on Step 3 and uses type="button" to bypass form submit.
  async function handleSaveRule(e?: React.MouseEvent<HTMLButtonElement>) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Hard guard: reject any invocation that is NOT a deliberate Step-3 button click.
    if (currentStep !== 3 || saving) return;

    setSaving(true);
    setError('');

    let conditionsPayload: Record<string, any> = {};

    if (conditionMode === 'DYNAMIC') {
      const parsedValue = formValueType === 'NUMBER' ? Number(formValue) : formValue;
      conditionsPayload = {
        fact: formFactKey,
        operator: formOperator,
        value: parsedValue,
      };
    } else {
      if (formReasonCode === 'VARIANCE_LE_100') {
        conditionsPayload = { fact: 'varianceAmountMinor', operator: 'lessThanInclusive', value: 10000 };
      } else if (formReasonCode === 'VARIANCE_GT_100') {
        conditionsPayload = { fact: 'varianceAmountMinor', operator: 'greaterThan', value: 10000 };
      } else {
        conditionsPayload = { fact: 'reasonCode', operator: 'equal', value: formReasonCode };
      }
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
        autoPost: formExecutionMode === 'AUTO_POST',
        requireApproval: formExecutionMode === 'MANUAL_REVIEW',
        status: formExecutionMode === 'MANUAL_REVIEW' ? 'PENDING_REVIEW' : 'MATCHED',
      },
      isActive: formIsActive,
    };

    try {
      const url = isEditing
        ? `/api/v1/accounting/system-rules/${ruleId}`
        : '/api/v1/accounting/system-rules';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || errData.error?.message || 'บันทึกข้อมูลไม่สำเร็จ');
      }

      setSuccessMsg(isEditing ? 'แก้ไขกฎเรียบร้อยแล้ว กำลังกลับ...' : 'สร้างกฎใหม่เรียบร้อยแล้ว กำลังกลับ...');
      setTimeout(() => {
        router.push('/clinic/settings/accounting-rules');
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-gray-500 flex flex-col items-center justify-center space-y-2">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span>กำลังโหลดข้อมูลกฎ...</span>
      </div>
    );
  }

  return (
    <div className="p-6 w-full max-w-4xl mx-auto space-y-6">
      {/* Header & Back Button */}
      <div className="flex items-center justify-between border-b pb-5">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => router.push('/clinic/settings/accounting-rules')}
            className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors cursor-pointer"
            title="ย้อนกลับไปหน้ารายการกฎ"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
              <span>Settings</span>
              <span>/</span>
              <span>Accounting Rules</span>
              <span>/</span>
              <span className="text-gray-900">{isEditing ? 'Edit Rule Wizard' : 'Create Rule Wizard'}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'แก้ไขกฎ Dynamic Accounting Rule (Step-by-Step Wizard)' : 'สร้างกฎ Dynamic Accounting Rule ใหม่ (Step-by-Step Wizard)'}
            </h1>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-sm text-red-700">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-600">
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

      {/* ── 3-STEP WIZARD STEPPER BAR ── */}
      <div className="bg-white border rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between relative">
          {/* Step 1 Indicator */}
          <div className="flex items-center space-x-3 z-10">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                currentStep === 1
                  ? 'bg-blue-600 text-white shadow-md ring-4 ring-blue-100'
                  : currentStep > 1
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {currentStep > 1 ? <Check className="w-5 h-5" /> : '1'}
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 1</div>
              <div className={`text-sm font-bold ${currentStep === 1 ? 'text-blue-600' : 'text-gray-900'}`}>
                ข้อมูลพื้นฐานกฎ
              </div>
            </div>
          </div>

          <div className={`flex-1 h-1 mx-4 rounded-full transition-all ${currentStep > 1 ? 'bg-emerald-500' : 'bg-gray-200'}`} />

          {/* Step 2 Indicator */}
          <div className="flex items-center space-x-3 z-10">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                currentStep === 2
                  ? 'bg-purple-600 text-white shadow-md ring-4 ring-purple-100'
                  : currentStep > 2
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {currentStep > 2 ? <Check className="w-5 h-5" /> : '2'}
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 2</div>
              <div className={`text-sm font-bold ${currentStep === 2 ? 'text-purple-600' : 'text-gray-900'}`}>
                Dynamic Rule Spec
              </div>
            </div>
          </div>

          <div className={`flex-1 h-1 mx-4 rounded-full transition-all ${currentStep > 2 ? 'bg-emerald-500' : 'bg-gray-200'}`} />

          {/* Step 3 Indicator */}
          <div className="flex items-center space-x-3 z-10">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                currentStep === 3
                  ? 'bg-emerald-600 text-white shadow-md ring-4 ring-emerald-100'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              3
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 3</div>
              <div className={`text-sm font-bold ${currentStep === 3 ? 'text-emerald-600' : 'text-gray-900'}`}>
                GL Action & Review
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── WIZARD CONTENT PANEL (NOT a <form> — prevents Edge/browser implicit form submission) ── */}
      <div
        className="bg-white border rounded-2xl shadow-xs p-8 space-y-6"
      >
        {/* ── STEP 1: BASIC INFORMATION ── */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center space-x-2 border-b pb-3 text-blue-900">
              <FileText className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold">1. ข้อมูลพื้นฐานกฎ (Basic Rule Profile)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ชื่อกฎ (Rule Name) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  onKeyDown={handleKeyDownBlockEnter}
                  placeholder="เช่น Custom Variance Rule <= 500 THB"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ลำดับความสำคัญ (Priority) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={formPriority}
                  onChange={(e) => setFormPriority(Number(e.target.value))}
                  onKeyDown={handleKeyDownBlockEnter}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">ตัวเลขยิ่งมาก ยิ่งถูกประเมินก่อน (เช่น 20 &gt; 10)</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">คำอธิบายเพิ่มเติม (Description)</label>
              <input
                type="text"
                autoComplete="off"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                onKeyDown={handleKeyDownBlockEnter}
                placeholder="เช่น ส่วนต่างเบิกจ่ายยืดหยุ่นไม่เกิน 500 บาทสำหรับสาขาใหญ่"
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ประเภทเหตุการณ์ (Event Context) <span className="text-red-500">*</span>
              </label>
              <select
                value={formEventType}
                onChange={(e) => setFormEventType(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {EVENT_TYPES.map((ev) => (
                  <option key={ev.value} value={ev.value}>{ev.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── STEP 2: DYNAMIC CONDITION BUILDER ── */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2 text-purple-900">
                <Sliders className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-bold">2. ตัวสร้างเงื่อนไขกฎ (Dynamic Condition Builder)</h3>
              </div>
              <div className="flex items-center bg-purple-100/80 p-1 rounded-xl border border-purple-200 text-xs">
                <button
                  type="button"
                  onClick={() => setConditionMode('DYNAMIC')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    conditionMode === 'DYNAMIC'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-purple-800 hover:text-purple-950'
                  }`}
                >
                  ⚙️ Dynamic Builder
                </button>
                <button
                  type="button"
                  onClick={() => setConditionMode('PRESET')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    conditionMode === 'PRESET'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-purple-800 hover:text-purple-950'
                  }`}
                >
                  ⚡ Preset เหตุผล
                </button>
              </div>
            </div>

            {conditionMode === 'DYNAMIC' ? (
              <div className="bg-purple-50/60 border border-purple-200/80 rounded-2xl p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Fact Key Input */}
                  <div>
                    <label className="block text-xs font-semibold text-purple-900 mb-1">
                      1. ฟิลด์ที่ต้องการตรวจจับ (Fact Key)
                    </label>
                    <input
                      type="text"
                      autoComplete="off"
                      value={formFactKey}
                      onChange={(e) => setFormFactKey(e.target.value)}
                      onKeyDown={handleKeyDownBlockEnter}
                      placeholder="เช่น varianceAmountMinor, quantity..."
                      className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-white font-mono focus:ring-2 focus:ring-purple-500"
                    />
                    <div className="mt-1.5">
                      <select
                        onChange={(e) => {
                          if (e.target.value) setFormFactKey(e.target.value);
                        }}
                        defaultValue=""
                        className="w-full text-xs text-purple-700 bg-purple-100/60 border border-purple-200 rounded-lg px-2 py-1.5"
                      >
                        <option value="" disabled>-- เลือกจากฟิลด์แนะนำ --</option>
                        {DYNAMIC_FACT_SUGGESTIONS.map((fact) => (
                          <option key={fact.value} value={fact.value}>{fact.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Operator Input */}
                  <div>
                    <label className="block text-xs font-semibold text-purple-900 mb-1">
                      2. เงื่อนไขเปรียบเทียบ (Operator)
                    </label>
                    <select
                      value={formOperator}
                      onChange={(e) => setFormOperator(e.target.value)}
                      className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-white font-mono focus:ring-2 focus:ring-purple-500"
                    >
                      {OPERATOR_OPTIONS.map((op) => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Value Input */}
                  <div>
                    <label className="block text-xs font-semibold text-purple-900 mb-1">
                      3. ค่าที่ต้องการเปรียบเทียบ (Value)
                    </label>
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        autoComplete="off"
                        value={formValue}
                        onChange={(e) => setFormValue(e.target.value)}
                        onKeyDown={handleKeyDownBlockEnter}
                        placeholder="ใส่ค่าอิสระ เช่น 10000 (100 บาท), 50000 (500 บาท)..."
                        className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-white font-mono focus:ring-2 focus:ring-purple-500"
                      />
                      <div className="flex items-center justify-between text-xs text-purple-900">
                        <span>ประเภทข้อมูล:</span>
                        <div className="space-x-3">
                          <label className="inline-flex items-center space-x-1 cursor-pointer">
                            <input
                              type="radio"
                              name="valTypeWizard"
                              checked={formValueType === 'NUMBER'}
                              onChange={() => setFormValueType('NUMBER')}
                            />
                            <span>ตัวเลข (Number)</span>
                          </label>
                          <label className="inline-flex items-center space-x-1 cursor-pointer">
                            <input
                              type="radio"
                              name="valTypeWizard"
                              checked={formValueType === 'STRING'}
                              onChange={() => setFormValueType('STRING')}
                            />
                            <span>ข้อความ (String)</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview JSON Spec */}
                <div className="bg-purple-950 text-purple-100 rounded-xl p-4 text-xs font-mono flex items-center justify-between">
                  <span>JSON Condition Spec ที่ถูกสร้าง:</span>
                  <code className="text-amber-300 font-bold text-sm">
                    {JSON.stringify({
                      fact: formFactKey,
                      operator: formOperator,
                      value: formValueType === 'NUMBER' ? Number(formValue) : formValue,
                    })}
                  </code>
                </div>
              </div>
            ) : (
              <div className="bg-purple-50/60 border border-purple-200/80 rounded-2xl p-6 space-y-2">
                <label className="block text-xs font-semibold text-purple-900 mb-1">เลือกเหตุผลสินค้ามาตรฐาน</label>
                <select
                  value={formReasonCode}
                  onChange={(e) => setFormReasonCode(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-purple-500 font-mono"
                >
                  {REASON_CODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: GL MAPPING & REVIEW SUMMARY ── */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center space-x-2 border-b pb-3 text-emerald-900">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold">3. การผูกผังบัญชีและโหมดการบันทึก (GL Action & Execution Control)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-emerald-900 mb-1">
                  Debit Account (Dr. ฝั่งเดบิต) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formDebitCode}
                  onChange={(e) => setFormDebitCode(e.target.value)}
                  className="w-full border border-emerald-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 font-mono"
                >
                  {STANDARD_GL_ACCOUNTS.map((acc) => (
                    <option key={acc.code} value={acc.code}>
                      {acc.code} - {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-rose-900 mb-1">
                  Credit Account (Cr. ฝั่งเครดิต) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formCreditCode}
                  onChange={(e) => setFormCreditCode(e.target.value)}
                  className="w-full border border-rose-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-rose-500 font-mono"
                >
                  {STANDARD_GL_ACCOUNTS.map((acc) => (
                    <option key={acc.code} value={acc.code}>
                      {acc.code} - {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action Execution Mode (Manual Review vs Auto Post) */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center space-x-2 text-amber-950 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-amber-700" />
                <span>โหมดการดำเนินการเมื่อตรงตามเงื่อนไข (Action Execution Mode)</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  onClick={() => setFormExecutionMode('MANUAL_REVIEW')}
                  className={`flex items-start space-x-3 p-4 border rounded-xl cursor-pointer transition-all ${
                    formExecutionMode === 'MANUAL_REVIEW'
                      ? 'bg-amber-100/90 border-amber-400 ring-2 ring-amber-400'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="executionModeRadio"
                    checked={formExecutionMode === 'MANUAL_REVIEW'}
                    onChange={() => setFormExecutionMode('MANUAL_REVIEW')}
                    className="mt-1 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <div className="flex items-center space-x-1.5 font-bold text-sm text-amber-950">
                      <ZapOff className="w-4 h-4 text-amber-700" />
                      <span>ไม่บันทึกอัตโนมัติ (Require Manual Review)</span>
                    </div>
                    <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                      เมื่อตรงเงื่อนไข ระบบจะไม่อนุมัติหรือลงบัญชีทันที แต่จะตั้งสถานะเป็น <strong className="text-amber-950 font-mono">PENDING_REVIEW</strong> เพื่อให้ผู้บริหารคลินิกตรวจสอบและอนุมัติด้วยตนเอง
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setFormExecutionMode('AUTO_POST')}
                  className={`flex items-start space-x-3 p-4 border rounded-xl cursor-pointer transition-all ${
                    formExecutionMode === 'AUTO_POST'
                      ? 'bg-emerald-100/90 border-emerald-400 ring-2 ring-emerald-400'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="executionModeRadio"
                    checked={formExecutionMode === 'AUTO_POST'}
                    onChange={() => setFormExecutionMode('AUTO_POST')}
                    className="mt-1 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="flex items-center space-x-1.5 font-bold text-sm text-emerald-950">
                      <Zap className="w-4 h-4 text-emerald-700" />
                      <span>บันทึกอัตโนมัติทันที (Auto Immediate Post)</span>
                    </div>
                    <p className="text-xs text-emerald-800/90 mt-1 leading-relaxed">
                      ระบบจะอนุมัติและผ่านรายการลงเดบิต/เครดิตสมุดบัญชีทันทีเมื่อเหตุการณ์เกิดขึ้น
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 pt-2">
              <input
                type="checkbox"
                id="isActiveWizardCheck"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
              />
              <label htmlFor="isActiveWizardCheck" className="text-sm font-medium text-gray-800 cursor-pointer">
                เปิดใช้งานกฎนี้ทันที (Active Rule)
              </label>
            </div>

            {/* Final Rule Summary Review Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm border-b border-slate-200 pb-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>สรุปข้อมูลกฎการลงบัญชีที่กำลังจะบันทึก (Rule Summary)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">ชื่อกฎ:</span>{' '}
                  <strong className="text-slate-900">{formName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Priority:</span>{' '}
                  <strong className="text-slate-900">#{formPriority}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Event Context:</span>{' '}
                  <span className="bg-blue-100 text-blue-800 font-mono px-2 py-0.5 rounded">{formEventType}</span>
                </div>
                <div>
                  <span className="text-slate-500">การดำเนินการ:</span>{' '}
                  {formExecutionMode === 'MANUAL_REVIEW' ? (
                    <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded">🛡️ ไม่ลงอัตโนมัติ (ติด PENDING_REVIEW รออนุมัติ)</span>
                  ) : (
                    <span className="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded">⚡ ลงบัญชีอัตโนมัติทันที</span>
                  )}
                </div>
                <div className="md:col-span-2">
                  <span className="text-slate-500">GL Action:</span>{' '}
                  <span className="text-emerald-700 font-mono font-bold">Dr. {formDebitCode}</span> ➔{' '}
                  <span className="text-rose-700 font-mono font-bold">Cr. {formCreditCode}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── WIZARD STEPPER NAVIGATION BUTTONS ── */}
        <div className="flex items-center justify-between pt-6 border-t">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrevStep}
              className="inline-flex items-center space-x-2 px-5 py-2.5 border rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ย้อนกลับ (Previous Step)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push('/clinic/settings/accounting-rules')}
              className="px-5 py-2.5 border rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
          )}

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-sm transition-all cursor-pointer"
            >
              <span>ถัดไป (Next Step)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveRule}
              disabled={saving}
              className="inline-flex items-center space-x-2 px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'กำลังบันทึก...' : isEditing ? 'บันทึกการแก้ไขกฎ' : 'ยืนยันสร้างกฎใหม่'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
