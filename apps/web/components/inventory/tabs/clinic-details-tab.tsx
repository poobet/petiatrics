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
      {values.itemType === ItemType.INVENTORY && (
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

      {/* Reorder Point (stocked goods only) */}
      {values.itemType === ItemType.INVENTORY && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="reorderPoint" className="block text-sm font-medium text-gray-700 mb-1">
              Reorder Point
            </label>
            <input
              id="reorderPoint"
              type="number"
              min="0"
              step="1"
              value={values.reorderPoint}
              onChange={(e) => onChange('reorderPoint', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.reorderPoint && <p className="text-xs text-red-600 mt-0.5">{errors.reorderPoint}</p>}
          </div>
          <div>
            <label htmlFor="minimumStock" className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Stock
            </label>
            <input
              id="minimumStock"
              type="number"
              min="0"
              step="1"
              value={values.minimumStock}
              onChange={(e) => onChange('minimumStock', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.minimumStock && <p className="text-xs text-red-600 mt-0.5">{errors.minimumStock}</p>}
          </div>
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
