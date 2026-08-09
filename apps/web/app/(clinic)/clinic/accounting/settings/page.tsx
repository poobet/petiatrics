import type { Metadata } from 'next';
import ModuleDocumentSequenceConfig from '@/components/document-sequence/module-sequence-config';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Accounting Settings | Petiatrics',
  description: 'Configure general ledger and journal entry document sequence rules.',
};

export default function AccountingSettingsPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <Link href="/clinic/accounting/journal" className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block">
          ← กลับสู่สมุดรายวันทั่วไป (Journal Entries)
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">ตั้งค่าระบบบัญชี (GL Settings)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          จัดการการตั้งค่ารหัสเอกสารใบสำคัญสมุดรายวันและกฎการบันทึกบัญชีของระบบ
        </p>
      </div>

      <ModuleDocumentSequenceConfig
        module="ACCOUNTING"
        title="รหัสเอกสารสมุดรายวัน (Journal Entry Sequencing)"
        description="กำหนดรูปแบบรหัสรันนิ่งเลขที่ใบสำคัญรายวันทั่วไป (JV) สำหรับระบบบัญชี"
      />
    </div>
  );
}
