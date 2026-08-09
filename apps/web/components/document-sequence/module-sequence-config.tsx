'use client';

import { useEffect, useState, useCallback } from 'react';
import { Settings2, Edit2, Plus, Trash2, CheckCircle, AlertCircle, Info, RefreshCw, Link as LinkIcon, Download } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@petiatrics/ui';
import { apiClient, ApiError } from '../../lib/api-client';

// ─── Types ─────────────────────────────────────────────────────────────────────

type DocumentModule =
  | 'PROCUREMENT'
  | 'BILLING'
  | 'APPOINTMENT'
  | 'INVENTORY'
  | 'CLINICAL'
  | 'ACCOUNTING'
  | 'GENERAL';

interface DocumentTypeDefinition {
  id: string;
  clinicId: string | null;
  code: string;
  label: string;
  module: DocumentModule;
  defaultTemplate: string;
  defaultResetInterval: 'YEARLY' | 'MONTHLY' | 'DAILY' | 'NEVER';
  scope: 'CLINIC' | 'BRANCH';
  isSystem: boolean;
  isActive: boolean;
}

interface DocumentSequenceConfig {
  id: string;
  clinicId: string;
  documentType: string;
  template: string;
  resetInterval: 'YEARLY' | 'MONTHLY' | 'DAILY' | 'NEVER';
  scope: 'CLINIC' | 'BRANCH';
}

interface SequenceInfo {
  documentType: string;
  label: string;
  module: DocumentModule;
  template: string;
  resetInterval: 'YEARLY' | 'MONTHLY' | 'DAILY' | 'NEVER';
  scope: 'CLINIC' | 'BRANCH';
  period: string;
  lastNumber: number;
  nextNumber: number;
  nextPreview: string;
  isOverride: boolean;
}

interface ModuleDocumentSequenceConfigProps {
  module: DocumentModule;
  title?: string;
  description?: string;
  className?: string;
}

// ─── Live Preview Helper ────────────────────────────────────────────────────────

function generatePreview(template: string, nextNum = 1): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const dd = now.getDate().toString().padStart(2, '0');

  return template
    .replace(/\{yyyy\}/g, yyyy)
    .replace(/\{yy\}/g, yyyy.slice(-2))
    .replace(/\{mm\}/g, mm)
    .replace(/\{dd\}/g, dd)
    .replace(/\{number:(\d+)\}/g, (_: string, w: string) => String(nextNum).padStart(parseInt(w, 10), '0'))
    .replace(/\{number\}/g, String(nextNum).padStart(4, '0'));
}

// ─── Module label map ───────────────────────────────────────────────────────────

const MODULE_LABELS: Record<DocumentModule, string> = {
  PROCUREMENT: 'จัดซื้อ',
  BILLING: 'การเงิน',
  APPOINTMENT: 'นัดหมาย',
  INVENTORY: 'คลังสินค้า',
  CLINICAL: 'เวชระเบียน',
  ACCOUNTING: 'ระบบบัญชี (GL)',
  GENERAL: 'ทั่วไป',
};

const RESET_INTERVAL_LABELS: Record<string, string> = {
  YEARLY: 'รีเซ็ตรายปี',
  MONTHLY: 'รีเซ็ตรายเดือน',
  DAILY: 'รีเซ็ตรายวัน',
  NEVER: 'ไม่รีเซ็ต',
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ModuleDocumentSequenceConfig({
  module,
  title,
  description,
  className = '',
}: ModuleDocumentSequenceConfigProps) {
  const [types, setTypes] = useState<DocumentTypeDefinition[]>([]);
  const [allMasterTypes, setAllMasterTypes] = useState<DocumentTypeDefinition[]>([]);
  const [configs, setConfigs] = useState<DocumentSequenceConfig[]>([]);
  const [sequences, setSequences] = useState<SequenceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: '',
    label: '',
    defaultTemplate: 'DOC-{yyyy}-{number:4}',
    defaultResetInterval: 'YEARLY' as 'YEARLY' | 'MONTHLY' | 'DAILY' | 'NEVER',
    scope: 'CLINIC' as 'CLINIC' | 'BRANCH',
  });

  // Import / Link from Single Source of Truth modal state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedImportCode, setSelectedImportCode] = useState('');
  const [importForm, setImportForm] = useState({
    template: '',
    resetInterval: 'YEARLY' as 'YEARLY' | 'MONTHLY' | 'DAILY' | 'NEVER',
    scope: 'CLINIC' as 'CLINIC' | 'BRANCH',
  });

  // Edit modal state
  const [editTarget, setEditTarget] = useState<DocumentTypeDefinition | null>(null);
  const [editForm, setEditForm] = useState({
    template: '',
    resetInterval: 'YEARLY' as 'YEARLY' | 'MONTHLY' | 'DAILY' | 'NEVER',
    scope: 'CLINIC' as 'CLINIC' | 'BRANCH',
  });

  // Delete modal state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [fetchedMasterTypes, fetchedConfigs, fetchedSequences] = await Promise.all([
        apiClient.get<DocumentTypeDefinition[]>('/document-sequence/types'),
        apiClient.get<DocumentSequenceConfig[]>('/document-sequence/configs'),
        apiClient.get<SequenceInfo[]>('/document-sequence/sequences'),
      ]);
      const allTypes = fetchedMasterTypes || [];
      const allConfigs = fetchedConfigs || [];
      setAllMasterTypes(allTypes);
      setConfigs(allConfigs);
      setSequences(fetchedSequences || []);

      // Filter types relevant to this module OR explicitly bound via config
      const moduleTypes = allTypes.filter((t) => {
        if (t.module === module) return true;
        // Also include if user created a sequence config override for this document type in this clinic
        const hasConfig = allConfigs.some((c) => c.documentType === t.code);
        return hasConfig;
      });

      setTypes(moduleTypes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function getConfigForType(code: string): DocumentSequenceConfig | undefined {
    return configs.find((c) => c.documentType === code);
  }

  function getEffectiveTemplate(type: DocumentTypeDefinition): string {
    return getConfigForType(type.code)?.template ?? type.defaultTemplate;
  }

  function getEffectiveResetInterval(type: DocumentTypeDefinition): string {
    return getConfigForType(type.code)?.resetInterval ?? type.defaultResetInterval;
  }

  function openEdit(type: DocumentTypeDefinition) {
    const cfg = getConfigForType(type.code);
    setEditForm({
      template: cfg?.template ?? type.defaultTemplate,
      resetInterval: cfg?.resetInterval ?? type.defaultResetInterval,
      scope: cfg?.scope ?? type.scope,
    });
    setEditTarget(type);
  }

  function openImportModal() {
    setError('');
    setSelectedImportCode('');
    setImportForm({
      template: '',
      resetInterval: 'YEARLY',
      scope: 'CLINIC',
    });
    setIsImportOpen(true);
  }

  function handleImportTypeSelect(code: string) {
    setSelectedImportCode(code);
    const targetType = allMasterTypes.find((t) => t.code === code);
    if (targetType) {
      const cfg = getConfigForType(code);
      setImportForm({
        template: cfg?.template ?? targetType.defaultTemplate,
        resetInterval: cfg?.resetInterval ?? targetType.defaultResetInterval,
        scope: cfg?.scope ?? targetType.scope,
      });
    }
  }

  async function handleImportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedImportCode) {
      setError('กรุณาเลือกประเภทเอกสารที่ต้องการดึงมาผูก');
      return;
    }
    setError('');
    setSuccess('');

    const targetType = allMasterTypes.find((t) => t.code === selectedImportCode);
    if (!targetType) return;

    if (!importForm.template.includes('{number')) {
      setError('รูปแบบต้องมี {number} หรือ {number:X} เช่น {number:4}');
      return;
    }

    try {
      // Save sequence config override to bind this document type to clinic module settings
      await apiClient.post('/document-sequence/configs', {
        documentType: selectedImportCode,
        template: importForm.template,
        resetInterval: importForm.resetInterval,
        scope: importForm.scope,
      });

      // If it's a custom type, optionally update its module assignment
      if (!targetType.isSystem) {
        await apiClient.patch(`/document-sequence/types/${targetType.id}`, {
          module,
        });
      }

      setSuccess(`ผูกประเภทเอกสาร ${targetType.label} (${targetType.code}) เข้ากับระบบ ${MODULE_LABELS[module]} สำเร็จ`);
      setIsImportOpen(false);
      fetchData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ผูกประเภทเอกสารไม่สำเร็จ');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!createForm.defaultTemplate.includes('{number')) {
      setError('รูปแบบต้องมี {number} หรือ {number:X} เช่น {number:4}');
      return;
    }

    try {
      await apiClient.post('/document-sequence/types', {
        code: createForm.code.toUpperCase().trim(),
        label: createForm.label.trim(),
        defaultTemplate: createForm.defaultTemplate.trim(),
        defaultResetInterval: createForm.defaultResetInterval,
        scope: createForm.scope,
        module,
      });
      setSuccess(`สร้างประเภทเอกสาร ${createForm.label} สำเร็จ และซิงค์ไปยังหน้าจัดการเอกสารหลักแล้ว`);
      setIsCreateOpen(false);
      setCreateForm({
        code: '',
        label: '',
        defaultTemplate: 'DOC-{yyyy}-{number:4}',
        defaultResetInterval: 'YEARLY',
        scope: 'CLINIC',
      });
      fetchData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'สร้างประเภทเอกสารไม่สำเร็จ');
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setError('');
    setSuccess('');

    if (!editForm.template.includes('{number')) {
      setError('รูปแบบต้องมี {number} หรือ {number:X} เช่น {number:4}');
      return;
    }

    try {
      await apiClient.post('/document-sequence/configs', {
        documentType: editTarget.code,
        template: editForm.template,
        resetInterval: editForm.resetInterval,
        scope: editForm.scope,
      });
      setSuccess(`บันทึกการตั้งค่า ${editTarget.label} สำเร็จ`);
      setEditTarget(null);
      fetchData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'บันทึกไม่สำเร็จ');
    }
  }

  async function handleDeleteCustomType(id: string) {
    setError('');
    setSuccess('');
    try {
      await apiClient.delete(`/document-sequence/types/${id}`);
      setSuccess('ลบประเภทเอกสารเรียบร้อยแล้ว');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ลบไม่สำเร็จ');
    }
  }

  const moduleTitle = title ?? `รหัสเอกสาร — ${MODULE_LABELS[module]}`;
  const moduleDesc =
    description ?? `กำหนดรูปแบบรหัสเอกสารสำหรับระบบ${MODULE_LABELS[module]}`;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="text-base font-semibold">{moduleTitle}</h3>
            <p className="text-sm text-muted-foreground">{moduleDesc}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={openImportModal}
            className="border-blue-200 text-blue-700 hover:bg-blue-50 flex items-center gap-1.5 text-xs font-semibold shadow-sm"
          >
            <Download className="h-3.5 w-3.5" /> 📥 ดึงผูกเอกสารจากคลังกลาง
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> เพิ่มประเภทเอกสาร
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Document Type Cards */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : types.length === 0 ? (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            ไม่พบประเภทเอกสารสำหรับระบบนี้
          </div>
          <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)} className="text-xs">
            + สร้างเอกสารใหม่
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {types.map((type) => {
            const cfg = getConfigForType(type.code);
            const effectiveTemplate = getEffectiveTemplate(type);
            const effectiveReset = getEffectiveResetInterval(type);
            const seqInfo = sequences.find((s) => s.documentType === type.code);
            const nextNum = seqInfo ? seqInfo.nextNumber : 1;
            const preview = seqInfo ? seqInfo.nextPreview : generatePreview(effectiveTemplate, nextNum);
            const lastNum = seqInfo ? seqInfo.lastNumber : 0;

            return (
              <div
                key={type.id}
                className="group relative rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
              >
                {/* Type badge row */}
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      {type.code}
                    </span>
                    {type.isSystem ? (
                      <Badge variant="secondary" className="text-[10px]">
                        ระบบ
                      </Badge>
                    ) : (
                      <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-[10px]">
                        กำหนดเอง
                      </Badge>
                    )}
                    {cfg && (
                      <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400">
                        มี Override
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => openEdit(type)}
                      title="แก้ไขการตั้งค่ารหัสเอกสาร"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                    </Button>
                    {!type.isSystem && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50"
                        onClick={() => setDeleteConfirmId(type.id)}
                        title="ลบประเภทเอกสาร"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Label */}
                <p className="mb-2 text-sm font-medium">{type.label}</p>

                {/* Template, Running Number & Preview */}
                <div className="space-y-1.5 border-t pt-2 mt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">รูปแบบ:</span>
                    <span className="font-mono font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">{effectiveTemplate}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">ลำดับล่าสุด:</span>
                    <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{lastNum}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">เลขถัดไป:</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{preview}</span>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {RESET_INTERVAL_LABELS[effectiveReset] ?? effectiveReset}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Import / Link from Single Source of Truth Modal */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-lg bg-white border rounded-xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-gray-900">
              <Download className="h-5 w-5 text-blue-600" />
              ดึงประเภทเอกสารจากคลังกลาง (Single Source of Truth) มาผูกกับ {MODULE_LABELS[module]}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              เลือกประเภทเอกสารที่มีอยู่ในระบบ (เช่น JV - สมุดรายวัน, INV - ใบแจ้งหนี้, CN, DN ฯลฯ) เพื่อดึงมาผูกและตั้งค่ารหัสเอกสารประจำโมดูลนี้
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleImportSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">เลือกประเภทเอกสารที่ต้องการผูก</Label>
              <Select value={selectedImportCode} onValueChange={handleImportTypeSelect}>
                <SelectTrigger className="border-gray-300">
                  <SelectValue placeholder="-- เลือกประเภทเอกสารจากคลังกลาง --" />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-md max-h-60 overflow-y-auto">
                  {allMasterTypes.map((t) => {
                    const isCurrentModule = t.module === module;
                    const hasConfig = configs.some((c) => c.documentType === t.code);
                    const isLinked = isCurrentModule || hasConfig;
                    return (
                      <SelectItem key={t.code} value={t.code}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span className="font-semibold text-gray-900 font-mono">{t.code}</span>
                          <span className="text-xs text-gray-600">{t.label}</span>
                          {isLinked ? (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">ผูกอยู่แล้ว</span>
                          ) : (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">คลังกลาง ({MODULE_LABELS[t.module ?? 'GENERAL'] ?? t.module})</span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedImportCode && (
              <div className="space-y-4 p-4 bg-slate-50 border rounded-lg animate-fade-in">
                <div className="space-y-1.5">
                  <Label htmlFor="imp-template" className="text-xs font-semibold text-gray-700">
                    รูปแบบรหัสรันนิ่ง (Sequence Template)
                  </Label>
                  <Input
                    id="imp-template"
                    value={importForm.template}
                    onChange={(e) => setImportForm({ ...importForm, template: e.target.value })}
                    placeholder="เช่น JV{yyyy}-{number:4}"
                    required
                    className="font-mono text-sm border-gray-300"
                  />
                  {importForm.template && (
                    <p className="text-[11px] text-gray-500">
                      พรีวิวตัวอย่าง:{' '}
                      <span className="font-mono font-bold text-blue-600">
                        {generatePreview(importForm.template)}
                      </span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="imp-reset" className="text-xs font-semibold text-gray-700">
                    รอบการรีเซ็ตตัวเลข
                  </Label>
                  <Select
                    value={importForm.resetInterval}
                    onValueChange={(val: any) => setImportForm({ ...importForm, resetInterval: val })}
                  >
                    <SelectTrigger id="imp-reset" className="border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border shadow-md">
                      <SelectItem value="YEARLY">รีเซ็ตรายปี (Yearly)</SelectItem>
                      <SelectItem value="MONTHLY">รีเซ็ตรายเดือน (Monthly)</SelectItem>
                      <SelectItem value="DAILY">รีเซ็ตรายวัน (Daily)</SelectItem>
                      <SelectItem value="NEVER">ไม่รีเซ็ต (Continuous)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="imp-scope" className="text-xs font-semibold text-gray-700">
                    ขอบเขตการรันนิ่ง (Scope)
                  </Label>
                  <Select
                    value={importForm.scope}
                    onValueChange={(val: any) => setImportForm({ ...importForm, scope: val })}
                  >
                    <SelectTrigger id="imp-scope" className="border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border shadow-md">
                      <SelectItem value="CLINIC">ระดับคลินิก (Clinic-Wide)</SelectItem>
                      <SelectItem value="BRANCH">ระดับสาขา (Per-Branch)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter className="pt-3 border-t flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsImportOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={!selectedImportCode} className="bg-blue-600 hover:bg-blue-700 text-white">
                ผูกเอกสารกับโมดูลนี้
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Custom Document Type Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md bg-white border rounded-xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-gray-900">
              <Plus className="h-5 w-5 text-blue-600" />
              เพิ่มประเภทเอกสารสำหรับระบบ {MODULE_LABELS[module]}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              สร้างรหัสเอกสารใหม่สำหรับระบบนี้ ข้อมูลจะถูกเชื่อมโยงไปยังหน้าตั้งค่าเอกสารรวมกลางโดยอัตโนมัติ
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="mod-create-code" className="text-xs font-semibold text-gray-700">
                รหัสเอกสาร (Code)
              </Label>
              <Input
                id="mod-create-code"
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                placeholder="เช่น BILL_RECEIPT"
                required
                className="font-mono uppercase text-sm border-gray-300"
              />
              <p className="text-[11px] text-gray-400">ใช้อักษรภาษาอังกฤษตัวพิมพ์ใหญ่ เช่น CUSTOM_INV</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mod-create-label" className="text-xs font-semibold text-gray-700">
                ชื่อเอกสาร (Display Label)
              </Label>
              <Input
                id="mod-create-label"
                value={createForm.label}
                onChange={(e) => setCreateForm({ ...createForm, label: e.target.value })}
                placeholder="เช่น ใบเสร็จรับเงินอย่างย่อ"
                required
                className="text-sm border-gray-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mod-create-template" className="text-xs font-semibold text-gray-700">
                รูปแบบรหัสเริ่มต้น (Default Template)
              </Label>
              <Input
                id="mod-create-template"
                value={createForm.defaultTemplate}
                onChange={(e) => setCreateForm({ ...createForm, defaultTemplate: e.target.value })}
                placeholder="เช่น RCT-{yyyy}-{number:4}"
                required
                className="font-mono text-sm border-gray-300"
              />
              {createForm.defaultTemplate && (
                <p className="text-[11px] text-gray-500">
                  ตัวอย่าง:{' '}
                  <span className="font-mono font-bold text-blue-600">
                    {generatePreview(createForm.defaultTemplate)}
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mod-create-reset" className="text-xs font-semibold text-gray-700">
                รอบการรีเซ็ตตัวเลข
              </Label>
              <Select
                value={createForm.defaultResetInterval}
                onValueChange={(val: any) => setCreateForm({ ...createForm, defaultResetInterval: val })}
              >
                <SelectTrigger id="mod-create-reset" className="border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-md">
                  <SelectItem value="YEARLY">รีเซ็ตรายปี (Yearly)</SelectItem>
                  <SelectItem value="MONTHLY">รีเซ็ตรายเดือน (Monthly)</SelectItem>
                  <SelectItem value="DAILY">รีเซ็ตรายวัน (Daily)</SelectItem>
                  <SelectItem value="NEVER">ไม่รีเซ็ต (Continuous)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mod-create-scope" className="text-xs font-semibold text-gray-700">
                ขอบเขตการรันนิ่ง (Scope)
              </Label>
              <Select
                value={createForm.scope}
                onValueChange={(val: any) => setCreateForm({ ...createForm, scope: val })}
              >
                <SelectTrigger id="mod-create-scope" className="border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-md">
                  <SelectItem value="CLINIC">ระดับคลินิก (Clinic-Wide)</SelectItem>
                  <SelectItem value="BRANCH">ระดับสาขา (Per-Branch)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-3 border-t flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                สร้างประเภทเอกสาร
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ตั้งค่ารหัสเอกสาร — {editTarget?.label}</DialogTitle>
            <DialogDescription>
              กำหนดรูปแบบรหัสเอกสารสำหรับคลินิกนี้ ค่าที่กำหนดจะ override ค่าเริ่มต้นของระบบ
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="mod-seq-template">รูปแบบ (Template)</Label>
              <Input
                id="mod-seq-template"
                value={editForm.template}
                onChange={(e) => setEditForm((f) => ({ ...f, template: e.target.value }))}
                placeholder="เช่น PO{yyyy}-{number:4}"
                className="font-mono"
                required
              />
              {editForm.template && (
                <p className="text-xs text-muted-foreground">
                  ตัวอย่าง:{' '}
                  <span className="font-mono font-semibold text-primary">
                    {generatePreview(editForm.template)}
                  </span>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                ตัวแปร: <code className="rounded bg-muted px-1">{'{yyyy}'}</code>{' '}
                <code className="rounded bg-muted px-1">{'{mm}'}</code>{' '}
                <code className="rounded bg-muted px-1">{'{dd}'}</code>{' '}
                <code className="rounded bg-muted px-1">{'{number:4}'}</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mod-seq-reset">รอบรีเซ็ตตัวเลข</Label>
              <Select
                value={editForm.resetInterval}
                onValueChange={(v) =>
                  setEditForm((f) => ({
                    ...f,
                    resetInterval: v as 'YEARLY' | 'MONTHLY' | 'DAILY' | 'NEVER',
                  }))
                }
              >
                <SelectTrigger id="mod-seq-reset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YEARLY">รีเซ็ตรายปี</SelectItem>
                  <SelectItem value="MONTHLY">รีเซ็ตรายเดือน</SelectItem>
                  <SelectItem value="DAILY">รีเซ็ตรายวัน</SelectItem>
                  <SelectItem value="NEVER">ไม่รีเซ็ต</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mod-seq-scope">ขอบเขต (Scope)</Label>
              <Select
                value={editForm.scope}
                onValueChange={(v) =>
                  setEditForm((f) => ({ ...f, scope: v as 'CLINIC' | 'BRANCH' }))
                }
              >
                <SelectTrigger id="mod-seq-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLINIC">ระดับคลินิก (Clinic)</SelectItem>
                  <SelectItem value="BRANCH">ระดับสาขา (Branch)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                ยกเลิก
              </Button>
              <Button type="submit">บันทึก</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-md bg-white border rounded-xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> ยืนยันการลบประเภทเอกสาร
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-2">
              คุณแน่ใจหรือไม่ว่าต้องการลบประเภทเอกสารนี้? ข้อมูลจะถูกปิดการใช้งานทั้งในหน้านี้และหน้าจัดการหลัก
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              ยกเลิก
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteConfirmId && handleDeleteCustomType(deleteConfirmId)}
            >
              ยืนยันการลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
