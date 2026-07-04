'use client';

import type { ItemFormValues, ItemFormReferenceData } from '../item-form-types';
import { ItemType, DefaultVatType, WhtRate, DispensingCategory } from '@petiatrics/types';

interface Props {
  values: ItemFormValues;
  errors: Record<string, string>;
  refs: ItemFormReferenceData;
  onChange: (field: keyof ItemFormValues, value: unknown) => void;
}

export default function ComplianceTab({ values, errors, refs, onChange }: Props) {
  const isInventory = values.itemType === ItemType.INVENTORY;

  return (
    <div className="space-y-6">
      {/* ── Tax Defaults Section ── */}
      <div className="bg-gray-50 p-4 rounded-lg border space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Tax Profile</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="defaultVatType" className="block text-sm font-medium text-gray-700 mb-1">
              Default VAT Type <span className="text-red-500">*</span>
            </label>
            <select
              id="defaultVatType"
              value={values.defaultVatType}
              onChange={(e) => onChange('defaultVatType', e.target.value as DefaultVatType)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={DefaultVatType.VAT_7}>Standard 7% VAT (VAT_7)</option>
              <option value={DefaultVatType.VAT_EXEMPT}>Exempt Supply (VAT_EXEMPT)</option>
              <option value={DefaultVatType.NON_VAT}>Out of Scope (NON_VAT)</option>
            </select>
            {errors.defaultVatType && <p className="text-xs text-red-600 mt-0.5">{errors.defaultVatType}</p>}
          </div>

          <div>
            <label htmlFor="whtRate" className="block text-sm font-medium text-gray-700 mb-1">
              Withholding Tax (WHT) Rate <span className="text-red-500">*</span>
            </label>
            <select
              id="whtRate"
              value={values.whtRate}
              onChange={(e) => onChange('whtRate', e.target.value as WhtRate)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={WhtRate.WHT_0}>0% (WHT_0)</option>
              <option value={WhtRate.WHT_1}>1% - Transport / Delivery (WHT_1)</option>
              <option value={WhtRate.WHT_3}>3% - Services / Consulting (WHT_3)</option>
            </select>
            {errors.whtRate && <p className="text-xs text-red-600 mt-0.5">{errors.whtRate}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="defaultTaxCodeId" className="block text-sm font-medium text-gray-700 mb-1">
              Default Tax Code
            </label>
            <select
              id="defaultTaxCodeId"
              value={values.defaultTaxCodeId}
              onChange={(e) => onChange('defaultTaxCodeId', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {refs.taxCodes.map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {tc.code}{tc.name ? ` — ${tc.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center pt-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={values.isTaxInclusive}
                onChange={(e) => onChange('isTaxInclusive', e.target.checked)}
                className="rounded accent-blue-600 h-4 w-4"
              />
              Price is tax-inclusive (VAT already included in price)
            </label>
          </div>
        </div>
      </div>

      {/* ── Dispensing Compliance Section ── */}
      <div className="bg-gray-50 p-4 rounded-lg border space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Dispensing & FDA Compliance</h3>
        
        <div>
          <label htmlFor="dispensingCategory" className="block text-sm font-medium text-gray-700 mb-1">
            Dispensing Category <span className="text-red-500">*</span>
          </label>
          <select
            id="dispensingCategory"
            value={values.dispensingCategory}
            onChange={(e) => onChange('dispensingCategory', e.target.value as DispensingCategory)}
            className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={DispensingCategory.General_Retail}>General Retail (General_Retail)</option>
            <option value={DispensingCategory.Household_Remedy}>Household Remedy (Household_Remedy)</option>
            <option value={DispensingCategory.Dangerous_Drug}>Dangerous Drug - PIN Override Required (Dangerous_Drug)</option>
            <option value={DispensingCategory.Specially_Controlled_Drug}>Specially Controlled Drug - Prescription Match Required (Specially_Controlled_Drug)</option>
            <option value={DispensingCategory.Clinic_Use_Only}>Clinic Use Only - Hard Block OTC (Clinic_Use_Only)</option>
          </select>
          {errors.dispensingCategory && <p className="text-xs text-red-600 mt-0.5">{errors.dispensingCategory}</p>}
        </div>

        <div>
          <label htmlFor="genericName" className="block text-sm font-medium text-gray-700 mb-1">
            Generic Drug Name (active ingredients)
          </label>
          <input
            id="genericName"
            type="text"
            value={values.genericName}
            onChange={(e) => onChange('genericName', e.target.value)}
            placeholder="e.g. Amoxicillin, Metronidazole"
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={values.isControlledSubstance}
              onChange={(e) => onChange('isControlledSubstance', e.target.checked)}
              className="rounded accent-blue-600 h-4 w-4"
            />
            Is Controlled Substance
          </label>

          {isInventory && (
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={values.requiresBatchAndExpiryTracking}
                onChange={(e) => onChange('requiresBatchAndExpiryTracking', e.target.checked)}
                className="rounded accent-blue-600 h-4 w-4"
              />
              Requires Batch & Expiry Date Tracking (FEFO enforcement)
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
