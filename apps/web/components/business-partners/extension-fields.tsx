'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@petiatrics/ui';
import { Label } from '@petiatrics/ui';
import { BusinessPartnerType } from '@petiatrics/types';

interface VetFields {
  licenseNumber: string;
  whtRate: string;
}

interface SupplierFields {
  taxId: string;
  creditTermDays: string;
}

interface ExtensionFieldsProps {
  type: BusinessPartnerType | '';
  vet: VetFields;
  supplier: SupplierFields;
  onVetChange: (fields: VetFields) => void;
  onSupplierChange: (fields: SupplierFields) => void;
}

export default function ExtensionFields({
  type,
  vet,
  supplier,
  onVetChange,
  onSupplierChange,
}: ExtensionFieldsProps) {
  const t = useTranslations('businessPartners');

  if (type === BusinessPartnerType.VET) {
    return (
      <>
        <div className="space-y-1.5" data-testid="vet-fields">
          <Label>{t('vet.licenseNumber')}</Label>
          <Input
            value={vet.licenseNumber}
            onChange={(e) => onVetChange({ ...vet, licenseNumber: e.target.value })}
            placeholder="VET-0001"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('vet.whtRate')}</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={vet.whtRate}
            onChange={(e) => onVetChange({ ...vet, whtRate: e.target.value })}
            placeholder="3"
          />
        </div>
      </>
    );
  }

  if (type === BusinessPartnerType.SUPPLIER) {
    return (
      <>
        <div className="space-y-1.5" data-testid="supplier-fields">
          <Label>{t('supplier.taxId')}</Label>
          <Input
            value={supplier.taxId}
            onChange={(e) => onSupplierChange({ ...supplier, taxId: e.target.value })}
            placeholder="0105562000000"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('supplier.creditTermDays')}</Label>
          <Input
            type="number"
            min="0"
            value={supplier.creditTermDays}
            onChange={(e) => onSupplierChange({ ...supplier, creditTermDays: e.target.value })}
            placeholder="30"
          />
        </div>
      </>
    );
  }

  return null;
}
