'use client';

import type { ItemFormValues, ItemFormReferenceData } from '../item-form-types';
import { ItemType } from '@petiatrics/types';

interface Props {
  values: ItemFormValues;
  errors: Record<string, string>;
  refs: ItemFormReferenceData;
  onChange: (field: keyof ItemFormValues, value: unknown) => void;
  isEdit?: boolean;
}

export default function GeneralTab({ values, errors, refs, onChange, isEdit }: Props) {
  return (
    <div className="space-y-4">
      {/* Item Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Item Type <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-4">
          {Object.values(ItemType).map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="itemType"
                value={t}
                checked={values.itemType === t}
                disabled={isEdit}
                onChange={() => onChange('itemType', t)}
                className="accent-blue-600"
              />
              {t === ItemType.INVENTORY ? 'Stocked Good' : 'Service'}
            </label>
          ))}
        </div>
        {isEdit && <p className="text-xs text-gray-400 mt-1">Item type cannot be changed after creation.</p>}
      </div>

      {/* Code */}
      <div>
        <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
          Item Code <span className="text-red-500">*</span>
        </label>
        <input
          id="code"
          name="code"
          value={values.code}
          disabled={isEdit}
          onChange={(e) => onChange('code', e.target.value)}
          placeholder="e.g. MED-001"
          className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        {errors.code && <p className="text-xs text-red-600 mt-0.5">{errors.code}</p>}
        {isEdit && <p className="text-xs text-gray-400 mt-0.5">Code cannot be changed after creation.</p>}
      </div>

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Item Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          value={values.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="e.g. Amoxicillin 250mg"
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.name && <p className="text-xs text-red-600 mt-0.5">{errors.name}</p>}
      </div>

      {/* Generic Name */}
      <div>
        <label htmlFor="genericName" className="block text-sm font-medium text-gray-700 mb-1">
          Generic Name
        </label>
        <input
          id="genericName"
          name="genericName"
          value={values.genericName}
          onChange={(e) => onChange('genericName', e.target.value)}
          placeholder="e.g. Amoxicillin"
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Category */}
      <div>
        <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-1">
          Category <span className="text-red-500">*</span>
        </label>
        <select
          id="categoryId"
          value={values.categoryId}
          onChange={(e) => onChange('categoryId', e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select category…</option>
          {refs.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {errors.categoryId && <p className="text-xs text-red-600 mt-0.5">{errors.categoryId}</p>}
      </div>

      {/* Flags */}
      <div className="space-y-2 pt-1">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={values.isControlledSubstance}
            onChange={(e) => onChange('isControlledSubstance', e.target.checked)}
            className="rounded accent-blue-600"
          />
          Controlled Substance
        </label>
        {values.itemType === ItemType.INVENTORY && (
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={values.requiresBatchAndExpiryTracking}
              onChange={(e) => onChange('requiresBatchAndExpiryTracking', e.target.checked)}
              className="rounded accent-blue-600"
            />
            Requires Batch & Expiry Tracking
          </label>
        )}
      </div>

      {/* Identifiers: SKU & Barcode */}
      <div className="border-t pt-4 mt-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Identifiers</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1">
              SKU
            </label>
            <input
              id="sku"
              name="sku"
              value={values.sku}
              disabled={isEdit}
              readOnly={isEdit}
              onChange={(e) => onChange('sku', e.target.value)}
              placeholder="Auto-assigned on save"
              className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
            {isEdit && <p className="text-xs text-gray-400 mt-0.5">SKU is assigned on creation and cannot be changed.</p>}
          </div>
          <div>
            <label htmlFor="barcode" className="block text-sm font-medium text-gray-700 mb-1">
              Barcode
            </label>
            <input
              id="barcode"
              name="barcode"
              value={values.barcode}
              onChange={(e) => onChange('barcode', e.target.value)}
              placeholder="Scan or enter barcode"
              className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.barcode && <p className="text-xs text-red-600 mt-0.5">{errors.barcode}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
