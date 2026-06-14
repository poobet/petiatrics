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

type TabKey = 'general' | 'units' | 'financials' | 'compliance' | 'stock' | 'clinic' | 'accessories' | 'branchSettings';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'units', label: 'Units' },
  { key: 'financials', label: 'Financials/GL' },
  { key: 'compliance', label: 'Compliance/Tax' },
  { key: 'stock', label: 'Stock' },
  { key: 'accessories', label: 'Accessories/Bundle' },
  { key: 'clinic', label: 'Clinic Details' },
  { key: 'branchSettings', label: 'Branch Pricing' },
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
  useEffect(() => setMounted(true), []);
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
    <form onSubmit={handleSubmit} noValidate>
      {!canWrite && (
        <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          ⚠ You have read-only access to product master data.
        </div>
      )}
      {/* Tab navigation */}
      <div className="flex gap-1 p-1 bg-gray-100/70 rounded-lg mb-6 overflow-x-auto whitespace-nowrap max-w-full scrollbar-none">
        {TABS.filter((t) => {
          if ((t.key === 'stock' || t.key === 'accessories') && !isEdit) return false;
          if (t.key === 'branchSettings' && (!isEdit || !canWrite)) return false;
          return true;
        }).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all shrink-0 ${
              activeTab === t.key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-75">
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
        {activeTab === 'branchSettings' && initial?.id && (
          <BranchSettingsTab productId={initial.id} />
        )}
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {submitError}
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          {canWrite ? 'Cancel' : 'Back'}
        </button>
        {canWrite && (
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Item'}
          </button>
        )}
      </div>
    </form>
  );
}
