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
      <div className="space-y-4" data-testid="vet-fields">
        <div className="space-y-1.5">
          <Label>{t('vet.licenseNumber')}</Label>
          <Input
            {...register('vet.licenseNumber')}
            placeholder="VET-0001"
          />
          {errors.vet?.licenseNumber && (
            <p className="text-destructive text-sm">{errors.vet.licenseNumber.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>{t('vet.specialty')}</Label>
          <Input
            {...register('vet.specialty')}
            placeholder="e.g. Internal Medicine"
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t('vet.defaultDfRate')}</Label>
          <Input
            {...register('vet.defaultDfRate', { setValueAs: (v) => v === '' ? undefined : Number(v) })}
            type="number"
            step="0.01"
            min={0}
            max={100}
            placeholder="e.g. 35.00"
          />
          {errors.vet?.defaultDfRate && (
            <p className="text-destructive text-sm">{errors.vet.defaultDfRate.message}</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}

