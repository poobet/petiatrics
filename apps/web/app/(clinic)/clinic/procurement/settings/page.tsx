import type { Metadata } from 'next';
import ModuleDocumentSequenceConfig from '../../../../../components/document-sequence/module-sequence-config';

export const metadata: Metadata = {
  title: 'Procurement Settings | Petiatrics',
  description: 'Configure procurement document sequence prefixes and numbering rules.',
};

export default function ProcurementSettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">ตั้งค่าระบบจัดซื้อ</h1>
        <p className="text-sm text-muted-foreground mt-1">
          จัดการการตั้งค่าเอกสารและรหัสเลขที่สำหรับกระบวนการจัดซื้อ
        </p>
      </div>

      <ModuleDocumentSequenceConfig
        module="PROCUREMENT"
        title="รหัสเอกสารจัดซื้อ"
        description="กำหนดรูปแบบรหัสเอกสาร PO, ใบรับสินค้า, ใบแจ้งหนี้, และการชำระเงินซัพพลายเออร์"
      />
    </div>
  );
}
