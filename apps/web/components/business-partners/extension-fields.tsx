'use client';

import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import { Input } from '@petiatrics/ui';
import { Label } from '@petiatrics/ui';
import { BusinessPartnerType } from '@petiatrics/types';
import { CreateBpFormValues } from './bp-form-schema';

interface ExtensionFieldsProps {
  type: BusinessPartnerType | '';
}

export default function ExtensionFields({ type }: ExtensionFieldsProps) {
  const t = useTranslations('businessPartners');
  const {
    register,
    formState: { errors },
  } = useFormContext<CreateBpFormValues>();

  if (type === BusinessPartnerType.VET) {
    return (
      <div className="space-y-1.5" data-testid="vet-fields">
        <Label>{t('vet.licenseNumber')}</Label>
        <Input
          {...register('vet.licenseNumber')}
          placeholder="VET-0001"
        />
        {errors.vet?.licenseNumber && (
          <p className="text-destructive text-sm">{errors.vet.licenseNumber.message}</p>
        )}
      </div>
    );
  }

  return null;
}

