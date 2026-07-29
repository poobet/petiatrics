import type { Metadata } from 'next';
import ModuleDocumentSequenceConfig from '../../../../../components/document-sequence/module-sequence-config';

export const metadata: Metadata = {
  title: 'Billing Settings | Petiatrics',
  description: 'Configure billing and invoicing document sequence prefixes and numbering rules.',
};

export default function BillingSettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">ตั้งค่าระบบการเงิน</h1>
        <p className="text-sm text-muted-foreground mt-1">
          จัดการการตั้งค่าเอกสารและรหัสเลขที่สำหรับระบบการเงินและการชำระเงิน
        </p>
      </div>

      <ModuleDocumentSequenceConfig
        module="BILLING"
        title="รหัสเอกสารการเงิน"
        description="กำหนดรูปแบบรหัสเลขที่ใบแจ้งหนี้และเอกสารการชำระเงินของลูกค้า"
      />
    </div>
  );
}
