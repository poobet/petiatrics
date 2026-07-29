'use client';

import { useEffect, useState, useCallback } from 'react';
import { Settings2, Edit2, CheckCircle, AlertCircle, Info, RefreshCw } from 'lucide-react';
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
  const [configs, setConfigs] = useState<DocumentSequenceConfig[]>([]);
  const [sequences, setSequences] = useState<SequenceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit modal state
  const [editTarget, setEditTarget] = useState<DocumentTypeDefinition | null>(null);
  const [editForm, setEditForm] = useState({
    template: '',
    resetInterval: 'YEARLY' as 'YEARLY' | 'MONTHLY' | 'DAILY' | 'NEVER',
    scope: 'CLINIC' as 'CLINIC' | 'BRANCH',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [fetchedTypes, fetchedConfigs, fetchedSequences] = await Promise.all([
        apiClient.get<DocumentTypeDefinition[]>(`/document-sequence/types?module=${module}`),
        apiClient.get<DocumentSequenceConfig[]>('/document-sequence/configs'),
        apiClient.get<SequenceInfo[]>(`/document-sequence/sequences?module=${module}`),
      ]);
      setTypes(fetchedTypes || []);
      setConfigs(fetchedConfigs || []);
      setSequences(fetchedSequences || []);
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

  const moduleTitle = title ?? `รหัสเอกสาร — ${MODULE_LABELS[module]}`;
  const moduleDesc =
    description ?? `กำหนดรูปแบบรหัสเอกสารสำหรับระบบ${MODULE_LABELS[module]}`;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="text-base font-semibold">{moduleTitle}</h3>
            <p className="text-sm text-muted-foreground">{moduleDesc}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
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
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0" />
          ไม่พบประเภทเอกสารสำหรับระบบนี้
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
                    {type.isSystem && (
                      <Badge variant="secondary" className="text-[10px]">
                        ระบบ
                      </Badge>
                    )}
                    {cfg && (
                      <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400">
                        กำหนดเอง
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => openEdit(type)}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
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
    </div>
  );
}
