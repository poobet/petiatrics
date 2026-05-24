'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ItemFormValues, ItemFormReferenceData } from './item-form-types';
import { ITEM_FORM_DEFAULTS } from './item-form-types';
import { validateItemForm, toApiPayload } from './item-form-schema';
import type { ItemDetailResponse } from '@petiatrics/types';
import GeneralTab from './tabs/general-tab';
import UnitsTab from './tabs/units-tab';
import PricingTab from './tabs/pricing-tab';
import ClinicDetailsTab from './tabs/clinic-details-tab';
import { apiClient, ApiError } from '../../lib/api-client';

type TabKey = 'general' | 'units' | 'pricing' | 'clinic';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'units', label: 'Units' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'clinic', label: 'Clinic Details' },
];

interface Props {
  refs: ItemFormReferenceData;
  /** Provide when editing an existing item */
  initial?: ItemDetailResponse;
}

function itemDetailToFormValues(item: ItemDetailResponse): ItemFormValues {
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
    conversions: (item.conversions ?? []).map((c) => ({
      unitId: c.unitId,
      ratioToBase: c.ratioToBase,
    })),
  };
}

export default function ItemForm({ refs, initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial;

  const [values, setValues] = useState<ItemFormValues>(
    initial ? itemDetailToFormValues(initial) : ITEM_FORM_DEFAULTS,
  );
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

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
      {/* Tab navigation */}
      <div className="border-b mb-6 flex gap-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[300px]">
        {activeTab === 'general' && (
          <GeneralTab values={values} errors={fieldErrors} refs={refs} onChange={handleChange} isEdit={isEdit} />
        )}
        {activeTab === 'units' && (
          <UnitsTab values={values} errors={fieldErrors} refs={refs} onChange={handleChange} />
        )}
        {activeTab === 'pricing' && (
          <PricingTab values={values} errors={fieldErrors} refs={refs} onChange={handleChange} />
        )}
        {activeTab === 'clinic' && (
          <ClinicDetailsTab values={values} errors={fieldErrors} refs={refs} onChange={handleChange} />
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
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Item'}
        </button>
      </div>
    </form>
  );
}
