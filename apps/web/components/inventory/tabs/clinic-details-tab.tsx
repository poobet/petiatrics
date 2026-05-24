'use client';

import type { ItemFormValues, ItemFormReferenceData } from '../item-form-types';
import { ItemType } from '@petiatrics/types';

interface Props {
  values: ItemFormValues;
  errors: Record<string, string>;
  refs: ItemFormReferenceData;
  onChange: (field: keyof ItemFormValues, value: unknown) => void;
}

export default function ClinicDetailsTab({ values, errors, refs, onChange }: Props) {
  return (
    <div className="space-y-4">
      {/* Default Supplier (stocked goods only) */}
      {values.itemType === ItemType.STOCKED_GOOD && (
        <div>
          <label htmlFor="defaultSupplierId" className="block text-sm font-medium text-gray-700 mb-1">
            Default Supplier
          </label>
          <select
            id="defaultSupplierId"
            value={values.defaultSupplierId}
            onChange={(e) => onChange('defaultSupplierId', e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">None</option>
            {refs.suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Reorder Threshold (stocked goods only) */}
      {values.itemType === ItemType.STOCKED_GOOD && (
        <div>
          <label htmlFor="reorderThreshold" className="block text-sm font-medium text-gray-700 mb-1">
            Reorder Threshold
          </label>
          <input
            id="reorderThreshold"
            type="number"
            min="0"
            step="1"
            value={values.reorderThreshold}
            onChange={(e) => onChange('reorderThreshold', e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.reorderThreshold && <p className="text-xs text-red-600 mt-0.5">{errors.reorderThreshold}</p>}
        </div>
      )}

      {/* Default Doctor Fee (services only) */}
      {values.itemType === ItemType.SERVICE && (
        <div>
          <label htmlFor="defaultDoctorFee" className="block text-sm font-medium text-gray-700 mb-1">
            Default Doctor Fee (THB)
          </label>
          <input
            id="defaultDoctorFee"
            type="number"
            min="0"
            step="0.01"
            value={values.defaultDoctorFee}
            onChange={(e) => onChange('defaultDoctorFee', e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="0.00"
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}
