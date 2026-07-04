'use client';

import type { ItemFormValues, ItemFormReferenceData } from '../item-form-types';
import { ItemType } from '@petiatrics/types';
import {
  Boxes,
  Stethoscope,
  ScrollText,
  Check,
  Lock,
  AlertCircle
} from 'lucide-react';

interface Props {
  values: ItemFormValues;
  errors: Record<string, string>;
  refs: ItemFormReferenceData;
  onChange: (field: keyof ItemFormValues, value: unknown) => void;
  isEdit?: boolean;
}

export default function GeneralTab({ values, errors, refs, onChange, isEdit }: Props) {
  return (
    <div className="space-y-6">
      {/* Item Type - Card-based premium selector */}
      <div className="bg-slate-50/30 p-5 rounded-2xl border border-slate-200/60">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Item Type <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* STOCKED GOOD */}
          <div
            onClick={() => !isEdit && onChange('itemType', ItemType.INVENTORY)}
            className={`relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all select-none ${
              !isEdit ? 'cursor-pointer hover:border-blue-400' : ''
            } ${
              values.itemType === ItemType.INVENTORY
                ? 'border-blue-500 bg-blue-50/10 shadow-sm'
                : 'border-slate-200 bg-slate-50/50 opacity-60'
            }`}
          >
            <div className={`mt-0.5 rounded-lg p-1.5 ${values.itemType === ItemType.INVENTORY ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Stocked Good</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Physical items with quantity tracking</p>
            </div>
            {values.itemType === ItemType.INVENTORY && (
              <span className="absolute top-2.5 right-2.5 bg-blue-600 text-white rounded-full p-0.5">
                <Check className="w-3 h-3" />
              </span>
            )}
            {isEdit && values.itemType !== ItemType.INVENTORY && (
              <span className="absolute top-2.5 right-2.5 text-slate-400">
                <Lock className="w-3.5 h-3.5" />
              </span>
            )}
          </div>

          {/* SERVICE */}
          <div
            onClick={() => !isEdit && onChange('itemType', ItemType.SERVICE)}
            className={`relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all select-none ${
              !isEdit ? 'cursor-pointer hover:border-blue-400' : ''
            } ${
              values.itemType === ItemType.SERVICE
                ? 'border-blue-500 bg-blue-50/10 shadow-sm'
                : 'border-slate-200 bg-slate-50/50 opacity-60'
            }`}
          >
            <div className={`mt-0.5 rounded-lg p-1.5 ${values.itemType === ItemType.SERVICE ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Service</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Consultations, fees & veterinary procedures</p>
            </div>
            {values.itemType === ItemType.SERVICE && (
              <span className="absolute top-2.5 right-2.5 bg-blue-600 text-white rounded-full p-0.5">
                <Check className="w-3 h-3" />
              </span>
            )}
            {isEdit && values.itemType !== ItemType.SERVICE && (
              <span className="absolute top-2.5 right-2.5 text-slate-400">
                <Lock className="w-3.5 h-3.5" />
              </span>
            )}
          </div>

          {/* CONSUMABLE */}
          <div
            onClick={() => !isEdit && onChange('itemType', ItemType.CONSUMABLE)}
            className={`relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all select-none ${
              !isEdit ? 'cursor-pointer hover:border-blue-400' : ''
            } ${
              values.itemType === ItemType.CONSUMABLE
                ? 'border-blue-500 bg-blue-50/10 shadow-sm'
                : 'border-slate-200 bg-slate-50/50 opacity-60'
            }`}
          >
            <div className={`mt-0.5 rounded-lg p-1.5 ${values.itemType === ItemType.CONSUMABLE ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Consumable</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Internal clinic supplies, not for resale</p>
            </div>
            {values.itemType === ItemType.CONSUMABLE && (
              <span className="absolute top-2.5 right-2.5 bg-blue-600 text-white rounded-full p-0.5">
                <Check className="w-3 h-3" />
              </span>
            )}
            {isEdit && values.itemType !== ItemType.CONSUMABLE && (
              <span className="absolute top-2.5 right-2.5 text-slate-400">
                <Lock className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </div>
        {isEdit && (
          <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            Item type cannot be changed after creation.
          </p>
        )}
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {/* Code */}
        <div>
          <label htmlFor="code" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Item Code <span className="text-red-500">*</span>
          </label>
          <input
            id="code"
            name="code"
            value={values.code}
            disabled={isEdit}
            onChange={(e) => onChange('code', e.target.value)}
            placeholder="e.g. MED-001"
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400 transition-all"
          />
          {errors.code && <p className="text-xs text-red-600 mt-1">{errors.code}</p>}
          {isEdit && (
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              Code cannot be changed after creation.
            </p>
          )}
        </div>

        {/* Category */}
        <div>
          <label htmlFor="categoryId" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            id="categoryId"
            value={values.categoryId}
            onChange={(e) => onChange('categoryId', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          >
            <option value="">Select category…</option>
            {refs.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.categoryId && <p className="text-xs text-red-600 mt-1">{errors.categoryId}</p>}
        </div>

        {/* Name */}
        <div className="md:col-span-2">
          <label htmlFor="name" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Item Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            value={values.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="e.g. Amoxicillin 250mg"
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>

        {/* Generic Name */}
        <div>
          <label htmlFor="genericName" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Generic Name
          </label>
          <input
            id="genericName"
            name="genericName"
            value={values.genericName}
            onChange={(e) => onChange('genericName', e.target.value)}
            placeholder="e.g. Amoxicillin"
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Flags */}
      <div className="flex flex-col gap-3 pt-5 border-t border-slate-100">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={values.isControlledSubstance}
            onChange={(e) => onChange('isControlledSubstance', e.target.checked)}
            className="rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
          />
          <div>
            <span className="text-sm font-medium text-slate-800">Controlled Substance</span>
            <span className="block text-xs text-slate-400">Strictly regulated pharmaceutical requiring audit records</span>
          </div>
        </label>
        
        {values.itemType === ItemType.INVENTORY && (
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={values.requiresBatchAndExpiryTracking}
              onChange={(e) => onChange('requiresBatchAndExpiryTracking', e.target.checked)}
              className="rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <div>
              <span className="text-sm font-medium text-slate-800">Requires Batch & Expiry Date Tracking</span>
              <span className="block text-xs text-slate-400">Enforces FEFO (First-Expiry-First-Out) dispensing compliance</span>
            </div>
          </label>
        )}
      </div>

      {/* Identifiers: SKU & Barcode */}
      <div className="border-t border-slate-100 pt-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Identifiers</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <label htmlFor="sku" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
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
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400 transition-all"
            />
            {isEdit && (
              <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                SKU is assigned on creation and cannot be changed.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="barcode" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Barcode
            </label>
            <input
              id="barcode"
              name="barcode"
              value={values.barcode}
              onChange={(e) => onChange('barcode', e.target.value)}
              placeholder="Scan or enter barcode"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {errors.barcode && <p className="text-xs text-red-600 mt-1">{errors.barcode}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
