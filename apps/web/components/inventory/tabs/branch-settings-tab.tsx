'use client';

import type { ItemFormValues, ItemFormReferenceData } from '../item-form-types';

interface Props {
  values: ItemFormValues;
  onChange: (field: keyof ItemFormValues, value: unknown) => void;
  refs: ItemFormReferenceData & { branches?: any[] };
  canEdit: boolean;
}

export default function BranchSettingsTab({ values, onChange, refs, canEdit }: Props) {
  const branches = refs.branches || [];

  function handleBranchChange(
    branchId: string,
    field: 'isActive' | 'retailPrice' | 'movingAverageCost',
    value: unknown,
  ) {
    const updated = (values.branchSettings || []).map((s) => {
      if (s.branchId === branchId) {
        return { ...s, [field]: value };
      }
      return s;
    });
    onChange('branchSettings', updated);
  }

  if (branches.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">No branches configured for this clinic.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Configure per-branch retail prices and stock activation for this product.
        Leave retail price at 0 to use the base selling price.
      </p>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-4 py-3 font-semibold text-gray-600">Branch</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Active</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Retail Price (THB)</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Moving Avg Cost (THB)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(values.branchSettings || []).map((setting) => {
              const branch = branches.find((b) => b.id === setting.branchId);
              return (
                <tr key={setting.branchId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {branch?.name ?? setting.branchId}
                  </td>
                  <td className="px-4 py-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id={`branch-active-${setting.branchId}`}
                        type="checkbox"
                        checked={setting.isActive}
                        onChange={(e) => handleBranchChange(setting.branchId, 'isActive', e.target.checked)}
                        disabled={!canEdit}
                        className="sr-only peer"
                      />
                      <div className={`w-9 h-5 rounded-full peer peer-checked:bg-blue-600 bg-gray-200 peer-disabled:opacity-50 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full`} />
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      id={`branch-retail-${setting.branchId}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={setting.retailPrice}
                      onChange={(e) =>
                        handleBranchChange(
                          setting.branchId,
                          'retailPrice',
                          e.target.value === '' ? '' : Number(e.target.value),
                        )
                      }
                      disabled={!canEdit}
                      className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      id={`branch-mac-${setting.branchId}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={setting.movingAverageCost}
                      onChange={(e) =>
                        handleBranchChange(
                          setting.branchId,
                          'movingAverageCost',
                          e.target.value === '' ? '' : Number(e.target.value),
                        )
                      }
                      disabled={!canEdit}
                      className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
