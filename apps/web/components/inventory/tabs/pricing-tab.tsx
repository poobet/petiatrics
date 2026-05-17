'use client';

import type { ItemFormValues, ItemFormReferenceData } from '../item-form-types';

interface Props {
  values: ItemFormValues;
  errors: Record<string, string>;
  refs: ItemFormReferenceData;
  onChange: (field: keyof ItemFormValues, value: unknown) => void;
}

export default function PricingTab({ values, errors, refs, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="standardCost" className="block text-sm font-medium text-gray-700 mb-1">
            Standard Cost (THB) <span className="text-red-500">*</span>
          </label>
          <input
            id="standardCost"
            type="number"
            min="0"
            step="0.01"
            value={values.standardCost}
            onChange={(e) =>
              onChange('standardCost', e.target.value === '' ? '' : Number(e.target.value))
            }
            placeholder="0.00"
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.standardCost && <p className="text-xs text-red-600 mt-0.5">{errors.standardCost}</p>}
        </div>
        <div>
          <label htmlFor="baseSellingPrice" className="block text-sm font-medium text-gray-700 mb-1">
            Base Selling Price (THB) <span className="text-red-500">*</span>
          </label>
          <input
            id="baseSellingPrice"
            type="number"
            min="0"
            step="0.01"
            value={values.baseSellingPrice}
            onChange={(e) =>
              onChange('baseSellingPrice', e.target.value === '' ? '' : Number(e.target.value))
            }
            placeholder="0.00"
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.baseSellingPrice && <p className="text-xs text-red-600 mt-0.5">{errors.baseSellingPrice}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="defaultTaxCodeId" className="block text-sm font-medium text-gray-700 mb-1">
          Default Tax Code
        </label>
        <select
          id="defaultTaxCodeId"
          value={values.defaultTaxCodeId}
          onChange={(e) => onChange('defaultTaxCodeId', e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">None</option>
          {refs.taxCodes.map((tc) => (
            <option key={tc.id} value={tc.id}>{tc.code}{tc.name ? ` — ${tc.name}` : ''}</option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={values.isTaxInclusive}
          onChange={(e) => onChange('isTaxInclusive', e.target.checked)}
          className="rounded accent-blue-600"
        />
        Price is tax-inclusive (VAT already included in selling price)
      </label>
    </div>
  );
}
