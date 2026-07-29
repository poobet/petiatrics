import type { Metadata } from 'next';
import ModuleDocumentSequenceConfig from '../../../../../components/document-sequence/module-sequence-config';

export const metadata: Metadata = {
  title: 'Appointment Settings | Petiatrics',
  description: 'Configure appointment document sequence prefixes and numbering rules.',
};

export default function AppointmentSettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">ตั้งค่าระบบนัดหมาย</h1>
        <p className="text-sm text-muted-foreground mt-1">
          จัดการการตั้งค่าเอกสารและรหัสเลขที่สำหรับระบบการนัดหมาย
        </p>
      </div>

      <ModuleDocumentSequenceConfig
        module="APPOINTMENT"
        title="รหัสเอกสารนัดหมาย"
        description="กำหนดรูปแบบรหัสใบนัดหมายและเอกสารที่เกี่ยวข้อง"
      />
    </div>
  );
}
