'use client';

import type { ItemFormValues, ItemFormReferenceData } from '../item-form-types';
import { ItemType } from '@petiatrics/types';

interface Props {
  values: ItemFormValues;
  errors: Record<string, string>;
  refs: ItemFormReferenceData;
  onChange: (field: keyof ItemFormValues, value: unknown) => void;
}

export default function FinancialsTab({ values, errors, refs, onChange }: Props) {
  const isInventory = values.itemType === ItemType.INVENTORY;

  return (
    <div className="space-y-6">
      {/* ── Pricing Section ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* ── General Ledger (GL) Mapping Section ── */}
      <div className="bg-gray-50 p-4 rounded-lg border space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">General Ledger (GL) Mapping</h3>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="revenueAccountId" className="block text-sm font-medium text-gray-700 mb-1">
              Revenue GL Account
            </label>
            <select
              id="revenueAccountId"
              value={values.revenueAccountId}
              onChange={(e) => onChange('revenueAccountId', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None / Inherit from Category</option>
              {(refs.glAccounts || []).map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} — {acc.name} ({acc.symbol || (acc as any).type})
                </option>
              ))}
            </select>
          </div>

          {isInventory && (
            <>
              <div>
                <label htmlFor="cogsAccountId" className="block text-sm font-medium text-gray-700 mb-1">
                  COGS GL Account
                </label>
                <select
                  id="cogsAccountId"
                  value={values.cogsAccountId}
                  onChange={(e) => onChange('cogsAccountId', e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None / Inherit from Category</option>
                  {(refs.glAccounts || []).map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} — {acc.name} ({acc.symbol || (acc as any).type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="inventoryAssetAccountId" className="block text-sm font-medium text-gray-700 mb-1">
                  Inventory Asset GL Account
                </label>
                <select
                  id="inventoryAssetAccountId"
                  value={values.inventoryAssetAccountId}
                  onChange={(e) => onChange('inventoryAssetAccountId', e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None / Inherit from Category</option>
                  {(refs.glAccounts || []).map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} — {acc.name} ({acc.symbol || (acc as any).type})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
