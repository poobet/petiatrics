'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSessionStore } from '@/lib/session-store';
import InventoryLocationsClient from '@/components/inventory/inventory-locations-client';
import ReasonCodesClient from '@/components/inventory/reason-codes-client';
import ItemCategorySettingsClient from '@/components/inventory/item-category-settings-client';
import ModuleDocumentSequenceConfig from '@/components/document-sequence/module-sequence-config';
import { Settings, MapPin, Tag, FileText, Layers } from 'lucide-react';

export default function InventorySettingsClient() {
  const activeBranch = useSessionStore((s) => s.activeBranch);
  const [activeTab, setActiveTab] = useState<'locations' | 'reason-codes' | 'categories' | 'sequence'>('locations');

  if (!activeBranch) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Inventory Settings</h1>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Select a branch from top navigation to configure inventory settings.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link href="/clinic/inventory" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        ← Back to Inventory
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-gray-700" />
            Inventory Settings (ตั้งค่าระบบคลังสินค้า)
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            จัดการคลังจัดเก็บ (Locations), รหัสเหตุผล (Reason Codes), หมวดหมู่สินค้า & GL และรหัสเอกสารคลังสินค้า ประจำสาขา: {activeBranch.name}
          </p>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="border-b mb-6 flex flex-wrap gap-6">
        <button
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'locations'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('locations')}
        >
          <MapPin className="w-4 h-4" />
          Locations (คลัง & พื้นที่จัดเก็บ)
        </button>
        <button
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'reason-codes'
              ? 'border-purple-600 text-purple-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('reason-codes')}
        >
          <Tag className="w-4 h-4" />
          Reason Codes (รหัสเหตุผล)
        </button>
        <button
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'categories'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('categories')}
        >
          <Layers className="w-4 h-4" />
          Item Categories & GL (หมวดหมู่สินค้า & ผูกบัญชี GL)
        </button>
        <button
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'sequence'
              ? 'border-emerald-600 text-emerald-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('sequence')}
        >
          <FileText className="w-4 h-4" />
          Document Sequencing (รหัสเอกสาร)
        </button>
      </div>

      {activeTab === 'locations' && <InventoryLocationsClient />}
      {activeTab === 'reason-codes' && <ReasonCodesClient />}
      {activeTab === 'categories' && <ItemCategorySettingsClient />}
      {activeTab === 'sequence' && (
        <ModuleDocumentSequenceConfig
          module="INVENTORY"
          title="รหัสเอกสารคลังสินค้า"
          description="กำหนดรูปแบบรหัสเอกสารการรับเข้า/เบิกจ่าย/ปรับสมดุลสินค้าคงคลัง"
        />
      )}
    </div>
  );
}
