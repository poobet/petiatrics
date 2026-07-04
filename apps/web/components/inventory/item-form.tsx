'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ItemFormValues, ItemFormReferenceData } from './item-form-types';
import { ITEM_FORM_DEFAULTS } from './item-form-types';
import { validateItemForm, toApiPayload } from './item-form-schema';
import type { ItemDetailResponse } from '@petiatrics/types';
import { DefaultVatType, WhtRate, DispensingCategory } from '@petiatrics/types';
import GeneralTab from './tabs/general-tab';
import UnitsTab from './tabs/units-tab';
import FinancialsTab from './tabs/financials-tab';
import ComplianceTab from './tabs/compliance-tab';
import ItemStockTab from './tabs/item-stock-tab';
import ClinicDetailsTab from './tabs/clinic-details-tab';
import AccessoriesTab from './tabs/accessories-tab';
import BranchSettingsTab from './tabs/branch-settings-tab';
import { apiClient, ApiError } from '../../lib/api-client';
import { usePermission } from '../../lib/use-permission';
import {
  Info,
  Scale,
  DollarSign,
  ShieldCheck,
  Package,
  Layers,
  FileSpreadsheet,
  GitBranch,
} from 'lucide-react';

type TabKey = 'general' | 'units' | 'financials' | 'compliance' | 'stock' | 'clinic' | 'accessories' | 'branchSettings';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'general', label: 'General Info', icon: Info },
  { key: 'units', label: 'UoM & Units', icon: Scale },
  { key: 'financials', label: 'Financials/GL', icon: DollarSign },
  { key: 'compliance', label: 'Compliance/Tax', icon: ShieldCheck },
  { key: 'stock', label: 'Stock Levels', icon: Package },
  { key: 'accessories', label: 'Accessories', icon: Layers },
  { key: 'clinic', label: 'Clinic Details', icon: FileSpreadsheet },
  { key: 'branchSettings', label: 'Branch Pricing', icon: GitBranch },
];

interface Props {
  refs: ItemFormReferenceData;
  /** Provide when editing an existing item */
  initial?: ItemDetailResponse;
}

function itemDetailToFormValues(item: any): ItemFormValues {
  return {
    code: item.code,
    name: item.name,
    itemType: item.itemType,
    categoryId: item.categoryId ?? '',
    baseUnitId: item.baseUnitId ?? '',
    genericName: item.genericName ?? '',
    isControlledSubstance: item.isControlledSubstance,
    requiresBatchAndExpiryTracking: item.requiresBatchAndExpiryTracking,
    standardCost: item.standardCost,
    baseSellingPrice: item.baseSellingPrice,
    isTaxInclusive: item.isTaxInclusive,
    defaultTaxCodeId: item.defaultTaxCodeId ?? '',
    defaultSupplierId: item.defaultSupplierId ?? '',
    defaultDoctorFee: item.defaultDoctorFee ?? '',
    reorderPoint: item.reorderPoint,
    minimumStock: item.minimumStock,
    sku: item.sku ?? '',
    barcode: item.barcode ?? '',
    conversions: (item.conversions ?? []).map((c: any) => ({
      unitId: c.unitId,
      ratioToBase: c.ratioToBase,
    })),
    accessories: (item.accessories ?? []).map((a: any) => ({
      childProductId: a.childProductId,
      name: a.name,
      code: a.code,
      sku: a.sku,
      itemType: a.itemType,
      quantityRatio: a.quantityRatio,
    })),
    defaultVatType: item.defaultVatType ?? DefaultVatType.VAT_7,
    whtRate: item.whtRate ?? WhtRate.WHT_0,
    dispensingCategory: item.dispensingCategory ?? DispensingCategory.General_Retail,
    revenueAccountId: item.revenueAccountId ?? '',
    cogsAccountId: item.cogsAccountId ?? '',
    inventoryAssetAccountId: item.inventoryAssetAccountId ?? '',
    branchSettings: (item.branchSettings ?? []).map((s: any) => ({
      branchId: s.branchId,
      isActive: s.isActive,
      retailPrice: Number(s.retailPrice),
      movingAverageCost: Number(s.movingAverageCost),
    })),
  };
}

export default function ItemForm({ refs, initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial;
  const canWrite = usePermission('INVENTORY:EDIT');
  const [mounted, setMounted] = useState(false);
  const [values, setValues] = useState<ItemFormValues>(
    initial ? itemDetailToFormValues(initial) : ITEM_FORM_DEFAULTS,
  );
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);

    apiClient
      .get<{ items: any[] }>('/identity/branches')
      .then((res) => {
        const allBranches = res.items || [];
        setBranches(allBranches);

        setValues((prev) => {
          const currentSettings = initial?.branchSettings ?? [];
          const merged = allBranches.map((branch) => {
            const existing = currentSettings.find((s: any) => s.branchId === branch.id);
            return {
              branchId: branch.id,
              isActive: existing ? existing.isActive : true,
              retailPrice: existing ? Number(existing.retailPrice) : 0,
              movingAverageCost: existing ? Number(existing.movingAverageCost) : 0,
            };
          });
          return { ...prev, branchSettings: merged };
        });
      })
      .catch((err) => console.error('Failed to load branches', err));
  }, [initial]);

  if (!mounted) return null;

  function handleChange(field: keyof ItemFormValues, value: unknown) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');

    const errs = validateItemForm(values);
    if (errs.length > 0) {
      const map: Record<string, string> = {};
      errs.forEach((e) => { map[e.field] = e.message; });
      setFieldErrors(map);
      return;
    }

    setSaving(true);
    try {
      const payload = toApiPayload(values);
      if (isEdit && initial) {
        const { code: _code, itemType: _itemType, ...updatePayload } = payload;
        await apiClient.patch(`/inventory/products/${initial.id}`, updatePayload);
      } else {
        await apiClient.post('/inventory/products', payload);
      }
      router.push('/clinic/inventory');
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong.';
      setSubmitError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {!canWrite && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-center gap-2">
          ⚠ You have read-only access to product master data.
        </div>
      )}
      
      {/* Navigation Tabs (Horizontal Top Bar for Premium ERP UX) */}
      <div className="flex w-full gap-1.5 p-1.5 bg-slate-50/70 rounded-2xl border border-slate-200/80">
        {TABS.filter((t) => {
          if ((t.key === 'stock' || t.key === 'accessories') && !isEdit) return false;
          if (t.key === 'branchSettings' && !isEdit) return false;
          return true;
        }).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === t.key
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${activeTab === t.key ? 'text-blue-600' : 'text-slate-400'}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm min-h-75">
        <div className="border-b border-slate-100 pb-4 mb-5">
          <h3 className="text-base font-semibold text-slate-800">
            {TABS.find(t => t.key === activeTab)?.label}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage specific details related to the item's {activeTab} profile.
          </p>
        </div>

        {activeTab === 'general' && (
          <GeneralTab values={values} errors={fieldErrors} refs={refs} onChange={handleChange} isEdit={isEdit} />
        )}
        {activeTab === 'units' && (
          <UnitsTab values={values} errors={fieldErrors} refs={refs} onChange={handleChange} />
        )}
        {activeTab === 'financials' && (
          <FinancialsTab values={values} errors={fieldErrors} refs={refs} onChange={handleChange} />
        )}
        {activeTab === 'compliance' && (
          <ComplianceTab values={values} errors={fieldErrors} refs={refs} onChange={handleChange} />
        )}
        {activeTab === 'stock' && (
          <ItemStockTab itemId={initial?.id} />
        )}
        {activeTab === 'accessories' && (
          <AccessoriesTab values={values} errors={fieldErrors} onChange={handleChange} currentProductId={initial?.id} />
        )}
        {activeTab === 'clinic' && (
          <ClinicDetailsTab values={values} errors={fieldErrors} refs={refs} onChange={handleChange} />
        )}
        {activeTab === 'branchSettings' && (
          <BranchSettingsTab
            values={values}
            onChange={handleChange}
            refs={{ ...refs, branches }}
            canEdit={canWrite}
          />
        )}
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          {submitError}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 text-sm border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
        >
          {canWrite ? 'Cancel' : 'Back'}
        </button>
        {canWrite && (
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2.5 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-60"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Item'}
          </button>
        )}
      </div>
    </form>
  );
}

