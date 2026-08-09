'use client';

import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Scale,
} from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { Money } from '@/components/ui/money';

export interface GLAccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
  isSystem?: boolean;
}

const journalLineSchema = z.object({
  glAccountId: z.string().min(1, 'กรุณาเลือกผังบัญชี'),
  debitBaht: z.number().min(0, 'จำนวนเงินต้องไม่ติดลบ'),
  creditBaht: z.number().min(0, 'จำนวนเงินต้องไม่ติดลบ'),
});

const manualJournalSchema = z.object({
  entryNo: z.string().min(1, 'กรุณาระบุเลขที่ใบสำคัญ'),
  description: z.string().min(3, 'กรุณากรอกคำอธิบายรายการอย่างน้อย 3 ตัวอักษร'),
  postedAt: z.string().optional(),
  lines: z
    .array(journalLineSchema)
    .min(2, 'ต้องระบุอย่างน้อย 2 รายการ (เดบิต และ เครดิต)'),
});

export type ManualJournalFormValues = z.infer<typeof manualJournalSchema>;

interface ManualJournalFormProps {
  glAccounts?: GLAccountOption[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ManualJournalForm({
  glAccounts: propGlAccounts,
  onSuccess,
  onCancel,
}: ManualJournalFormProps) {
  const [glAccounts, setGlAccounts] = useState<GLAccountOption[]>(propGlAccounts || []);
  const [loadingAccounts, setLoadingAccounts] = useState(!propGlAccounts);
  const [fetchingSequence, setFetchingSequence] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ManualJournalFormValues>({
    resolver: zodResolver(manualJournalSchema),
    defaultValues: {
      entryNo: '',
      description: '',
      postedAt: new Date().toISOString().split('T')[0],
      lines: [
        { glAccountId: '', debitBaht: 0, creditBaht: 0 },
        { glAccountId: '', debitBaht: 0, creditBaht: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  // Watch lines to compute real-time Dr/Cr totals
  const watchedLines = watch('lines') || [];

  // Calculate real-time totals in minor satang integers
  const totalDebitMinor = watchedLines.reduce((sum, line) => {
    const val = Number(line?.debitBaht) || 0;
    return sum + Math.round(val * 100);
  }, 0);

  const totalCreditMinor = watchedLines.reduce((sum, line) => {
    const val = Number(line?.creditBaht) || 0;
    return sum + Math.round(val * 100);
  }, 0);

  const varianceMinor = Math.abs(totalDebitMinor - totalCreditMinor);
  const isBalanced = totalDebitMinor === totalCreditMinor && totalDebitMinor > 0;

  // Load GL Accounts if not passed as prop
  useEffect(() => {
    if (!propGlAccounts) {
      setLoadingAccounts(true);
      apiClient
        .get<GLAccountOption[]>('/accounting/gl-accounts')
        .then((data) => {
          if (Array.isArray(data)) setGlAccounts(data);
        })
        .catch((err) => {
          console.error('Failed to fetch GL Accounts', err);
        })
        .finally(() => setLoadingAccounts(false));
    }
  }, [propGlAccounts]);

  // Fetch System Running Entry Number (e.g. JV2026-0001)
  const fetchNextRunningNumber = async () => {
    setFetchingSequence(true);
    try {
      const res = await apiClient.get<{ nextEntryNo: string }>('/accounting/journal-entries/next-number');
      if (res?.nextEntryNo) {
        setValue('entryNo', res.nextEntryNo);
      }
    } catch (err) {
      console.error('Failed to fetch next entry sequence', err);
      const fallbackNo = `JV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
      setValue('entryNo', fallbackNo);
    } finally {
      setFetchingSequence(false);
    }
  };

  useEffect(() => {
    fetchNextRunningNumber();
  }, []);

  const onSubmit = async (values: ManualJournalFormValues) => {
    setFormError(null);

    if (!isBalanced) {
      setFormError('ยอดรวมเดบิตและเครดิตต้องเท่ากัน และมากกว่า ฿0.00');
      return;
    }

    // Filter lines that have positive debit or credit
    const validLines = values.lines
      .filter((l) => l.glAccountId && (Number(l.debitBaht) > 0 || Number(l.creditBaht) > 0))
      .map((l) => ({
        glAccountId: l.glAccountId,
        debitMinor: Math.round((Number(l.debitBaht) || 0) * 100),
        creditMinor: Math.round((Number(l.creditBaht) || 0) * 100),
      }));

    if (validLines.length < 2) {
      setFormError('ต้องระบุอย่างน้อย 2 รายการบันทึกบัญชีที่ถูกต้อง');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/accounting/journal-entries', {
        entryNo: values.entryNo,
        description: values.description,
        postedAt: values.postedAt ? new Date(values.postedAt) : undefined,
        type: 'GENERAL',
        lines: validLines,
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Failed to post journal entry', err);
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError(err?.response?.data?.message || 'เกิดข้อผิดพลาดในการบันทึกสมุดรายวัน');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {formError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">ไม่สามารถบันทึกรายการได้</p>
            <p className="text-xs mt-0.5">{formError}</p>
          </div>
        </div>
      )}

      {/* Basic Entry Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            เลขที่ใบสำคัญ (System Running Entry No) *
          </label>
          <div className="relative">
            <input
              type="text"
              {...register('entryNo')}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 font-semibold text-blue-700"
              readOnly={fetchingSequence}
            />
            <button
              type="button"
              onClick={fetchNextRunningNumber}
              disabled={fetchingSequence}
              title="ดึงรหัสรันนิ่งใหม่จากระบบ"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 p-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${fetchingSequence ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {errors.entryNo && (
            <p className="text-xs text-rose-500 mt-1">{errors.entryNo.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            วันที่บันทึกบัญชี (Posting Date) *
          </label>
          <input
            type="date"
            {...register('postedAt')}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            คำอธิบายรายการ (Description) *
          </label>
          <input
            type="text"
            placeholder="เช่น บันทึกปรับปรุงค่าใช้จ่าย หรือปรับปรุงสต็อก"
            {...register('description')}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {errors.description && (
            <p className="text-xs text-rose-500 mt-1">{errors.description.message}</p>
          )}
        </div>
      </div>

      {/* Journal Lines Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-bold text-slate-900">
              รายการเดบิต-เครดิต (Double-Entry Lines)
            </h4>
          </div>
          <button
            type="button"
            onClick={() => append({ glAccountId: '', debitBaht: 0, creditBaht: 0 })}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> เพิ่มบรรทัด (Add Line)
          </button>
        </div>

        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3 w-12 text-center">#</th>
                <th className="px-4 py-3">ผังบัญชี (GL Account) *</th>
                <th className="px-4 py-3 text-right w-36">เดบิต (Debit ฿)</th>
                <th className="px-4 py-3 text-right w-36">เครดิต (Credit ฿)</th>
                <th className="px-4 py-3 w-12 text-center">ลบ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fields.map((field, idx) => (
                <tr key={field.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-center text-slate-400 font-mono font-medium">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      {...register(`lines.${idx}.glAccountId`)}
                      disabled={loadingAccounts}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">-- เลือกผังบัญชี (Select GL Account) --</option>
                      {glAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name} ({acc.type})
                        </option>
                      ))}
                    </select>
                    {errors.lines?.[idx]?.glAccountId && (
                      <p className="text-[10px] text-rose-500 mt-0.5">
                        {errors.lines[idx]?.glAccountId?.message}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...register(`lines.${idx}.debitBaht`, { valueAsNumber: true })}
                      onChange={(e) => {
                        const val = e.target.value;
                        setValue(`lines.${idx}.debitBaht`, val === '' ? 0 : parseFloat(val), { shouldValidate: true });
                        // Clear credit side if debit is populated
                        if (parseFloat(val) > 0) {
                          setValue(`lines.${idx}.creditBaht`, 0, { shouldValidate: true });
                        }
                      }}
                      className="w-full px-3 py-1.5 text-xs text-right font-mono font-bold text-emerald-600 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...register(`lines.${idx}.creditBaht`, { valueAsNumber: true })}
                      onChange={(e) => {
                        const val = e.target.value;
                        setValue(`lines.${idx}.creditBaht`, val === '' ? 0 : parseFloat(val), { shouldValidate: true });
                        // Clear debit side if credit is populated
                        if (parseFloat(val) > 0) {
                          setValue(`lines.${idx}.debitBaht`, 0, { shouldValidate: true });
                        }
                      }}
                      className="w-full px-3 py-1.5 text-xs text-right font-mono font-bold text-blue-600 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      disabled={fields.length <= 2}
                      className="text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 p-1 rounded-lg transition-colors"
                      title="ลบบรรทัด"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Live Totals & Double-Entry Status Footer */}
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={2} className="px-4 py-3 font-semibold text-slate-700 text-right">
                  ยอดรวมทั้งสิ้น (Grand Totals):
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700 text-sm">
                  <Money minor={totalDebitMinor} />
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-blue-700 text-sm">
                  <Money minor={totalCreditMinor} />
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Real-time Double-Entry Balance Verification Banner */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          isBalanced
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/80 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isBalanced ? (
              <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 bg-amber-500 text-white rounded-xl shadow-sm">
                <AlertCircle className="w-5 h-5" />
              </div>
            )}
            <div>
              <p className="font-bold text-sm">
                {isBalanced
                  ? 'งบดุลเดบิต-เครดิต สมบูรณ์ (Balanced Double-Entry)'
                  : 'ยอดรวมเดบิตและเครดิตยังไม่เท่ากัน (Unbalanced Entry)'}
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                {isBalanced
                  ? `ยอดรวมสมดุลเรียบร้อย: เดบิต ${totalDebitMinor / 100} บาท = เครดิต ${totalCreditMinor / 100} บาท`
                  : `ผลต่างสุทธิ (Variance): ${varianceMinor / 100} บาท (เดบิต: ${totalDebitMinor / 100} บาท, เครดิต: ${totalCreditMinor / 100} บาท)`}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span
              className={`inline-block px-3 py-1 text-xs font-bold rounded-lg border ${
                isBalanced
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}
            >
              {isBalanced ? '✓ พร้อมบันทึก' : '❌ ปุ่มบันทึกล็อก (Disabled)'}
            </span>
          </div>
        </div>
      </div>

      {/* Form Action Controls */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm"
          >
            ยกเลิก
          </button>
        )}
        <button
          type="submit"
          disabled={!isBalanced || submitting}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-md shadow-blue-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {submitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              กำลังบันทึกสมุดรายวัน...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              บันทึกรายการสมุดรายวัน (Post Entry)
            </>
          )}
        </button>
      </div>
    </form>
  );
}
