'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@petiatrics/ui';
import { Label } from '@petiatrics/ui';
import { BusinessPartnerType } from '@petiatrics/types';

export interface VetFields {
  licenseNumber: string;
}

interface ExtensionFieldsProps {
  type: BusinessPartnerType | '';
  vet: VetFields;
  onVetChange: (fields: VetFields) => void;
}

export default function ExtensionFields({
  type,
  vet,
  onVetChange,
}: ExtensionFieldsProps) {
  const t = useTranslations('businessPartners');

  if (type === BusinessPartnerType.VET) {
    return (
      <div className="space-y-1.5" data-testid="vet-fields">
        <Label>{t('vet.licenseNumber')}</Label>
        <Input
          value={vet.licenseNumber}
          onChange={(e) => onVetChange({ licenseNumber: e.target.value })}
          placeholder="VET-0001"
        />
      </div>
    );
  }

  return null;
}

