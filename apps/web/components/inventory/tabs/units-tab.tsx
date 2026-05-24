'use client';

import type { ItemFormValues, ItemFormReferenceData } from '../item-form-types';
import type { ItemConversionFormValue } from '../item-form-types';

interface Props {
  values: ItemFormValues;
  errors: Record<string, string>;
  refs: ItemFormReferenceData;
  onChange: (field: keyof ItemFormValues, value: unknown) => void;
}

export default function UnitsTab({ values, errors, refs, onChange }: Props) {
  function handleConversionChange(index: number, field: keyof ItemConversionFormValue, value: unknown) {
    const updated = values.conversions.map((c, i) =>
      i === index ? { ...c, [field]: value } : c,
    );
    onChange('conversions', updated);
  }

  function addConversion() {
    onChange('conversions', [...values.conversions, { unitId: '', ratioToBase: '' }]);
  }

  function removeConversion(index: number) {
    onChange('conversions', values.conversions.filter((_, i) => i !== index));
  }

  const baseUnitName = refs.units.find((u) => u.id === values.baseUnitId)?.name ?? 'base unit';

  return (
    <div className="space-y-6">
      {/* Base unit */}
      <div>
        <label htmlFor="baseUnitId" className="block text-sm font-medium text-gray-700 mb-1">
          Base Unit <span className="text-red-500">*</span>
        </label>
        <select
          id="baseUnitId"
          value={values.baseUnitId}
          onChange={(e) => onChange('baseUnitId', e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select base unit…</option>
          {refs.units.map((u) => (
            <option key={u.id} value={u.id}>{u.name}{u.symbol ? ` (${u.symbol})` : ''}</option>
          ))}
        </select>
        {errors.baseUnitId && <p className="text-xs text-red-600 mt-0.5">{errors.baseUnitId}</p>}
      </div>

      {/* Alternate unit conversions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Alternate Unit Conversions
          </label>
          <button
            type="button"
            onClick={addConversion}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            + Add conversion
          </button>
        </div>

        {values.conversions.length === 0 && (
          <p className="text-xs text-gray-400">No alternate units configured.</p>
        )}

        {values.conversions.map((conv, idx) => (
          <div key={idx} className="flex items-end gap-2 mb-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-0.5 block">Unit</label>
              <select
                value={conv.unitId}
                onChange={(e) => handleConversionChange(idx, 'unitId', e.target.value)}
                className="w-full border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select unit…</option>
                {refs.units
                  .filter((u) => u.id !== values.baseUnitId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.name}{u.symbol ? ` (${u.symbol})` : ''}</option>
                  ))}
              </select>
              {errors[`conversions.${idx}.unitId`] && (
                <p className="text-xs text-red-600 mt-0.5">{errors[`conversions.${idx}.unitId`]}</p>
              )}
            </div>
            <div className="w-32">
              <label className="text-xs text-gray-500 mb-0.5 block">
                = ? {baseUnitName}
              </label>
              <input
                type="number"
                min="0.000001"
                step="any"
                value={conv.ratioToBase}
                onChange={(e) =>
                  handleConversionChange(idx, 'ratioToBase', e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="e.g. 12"
                className="w-full border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors[`conversions.${idx}.ratioToBase`] && (
                <p className="text-xs text-red-600 mt-0.5">{errors[`conversions.${idx}.ratioToBase`]}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeConversion(idx)}
              className="mb-0.5 text-red-400 hover:text-red-600 text-sm px-2"
              aria-label="Remove conversion"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
