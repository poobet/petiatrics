'use client';

import type { ItemFormValues, ItemAccessoryFormValue } from '../item-form-types';
import ItemSearchCombobox from '../item-search-combobox';
import { ItemType } from '@petiatrics/types';

interface Props {
  values: ItemFormValues;
  errors: Record<string, string>;
  onChange: (field: keyof ItemFormValues, value: unknown) => void;
  currentProductId?: string;
}

export default function AccessoriesTab({ values, errors, onChange, currentProductId }: Props) {
  function handleAccessoryChange(index: number, field: keyof ItemAccessoryFormValue, value: unknown) {
    const updated = values.accessories.map((a, i) =>
      i === index ? { ...a, [field]: value } : a,
    );
    onChange('accessories', updated);
  }

  function addAccessory(item: { id: string; name: string; sku: string | null; itemType: string; code?: string }) {
    // 1. Prevent adding itself
    if (item.id === currentProductId) {
      alert("An item cannot be added as its own accessory/bundle component.");
      return;
    }
    // 2. Prevent adding duplicates
    if (values.accessories.some((a) => a.childProductId === item.id)) {
      alert("This accessory is already added to the list.");
      return;
    }

    const newAccessory: ItemAccessoryFormValue = {
      childProductId: item.id,
      name: item.name,
      code: item.code ?? '',
      sku: item.sku ?? '',
      itemType: item.itemType as ItemType,
      quantityRatio: 1, // default multiplier
    };
    onChange('accessories', [...values.accessories, newAccessory]);
  }

  function removeAccessory(index: number) {
    onChange('accessories', values.accessories.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Accessories / Bundled Items</h3>
        <p className="text-sm text-gray-500 mt-1">
          Define items that should be automatically added when this item is selected in visit records or invoices.
        </p>
      </div>

      {/* Add accessory input */}
      <div className="bg-gray-50 p-4 rounded-lg border">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search and Add Accessory Item
        </label>
        <ItemSearchCombobox
          placeholder="Type product or service name to add…"
          itemType="" // empty string searches both INVENTORY and SERVICE
          onSelect={(item) => addAccessory(item)}
        />
      </div>

      {/* Accessory List */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Configured Accessories / Components
        </label>

        {values.accessories.length === 0 && (
          <p className="text-sm text-gray-400 italic">No accessories configured. Use the search box above to add items.</p>
        )}

        {values.accessories.length > 0 && (
          <div className="border rounded-md overflow-hidden bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/4">
                    Code / SKU
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/2">
                    Name / Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/4">
                    Multiplier Ratio
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {values.accessories.map((acc, idx) => (
                  <tr key={acc.childProductId}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      <div>{acc.code || 'N/A'}</div>
                      {acc.sku && <div className="text-xs text-gray-400">SKU: {acc.sku}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium">{acc.name}</div>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${
                        acc.itemType === ItemType.SERVICE ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {acc.itemType === ItemType.SERVICE ? 'Service' : 'Stocked Good'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0.001"
                          step="any"
                          value={acc.quantityRatio}
                          onChange={(e) =>
                            handleAccessoryChange(idx, 'quantityRatio', e.target.value === '' ? '' : Number(e.target.value))
                          }
                          placeholder="e.g. 1.0"
                          className="w-24 border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      {errors[`accessories.${idx}.quantityRatio`] && (
                        <p className="text-xs text-red-600 mt-1">{errors[`accessories.${idx}.quantityRatio`]}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        type="button"
                        onClick={() => removeAccessory(idx)}
                        className="text-red-600 hover:text-red-900 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        aria-label="Remove accessory"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
