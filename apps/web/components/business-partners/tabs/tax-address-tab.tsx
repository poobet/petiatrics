'use client';

import { useFormContext, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@petiatrics/ui';
import { TaxCodeResponse } from '@petiatrics/types';
import { CreateBpFormValues } from '../bp-form-schema';

interface TaxAddressTabProps {
  vatCodes: TaxCodeResponse[];
  whtCodes: TaxCodeResponse[];
}

export default function TaxAddressTab({ vatCodes, whtCodes }: TaxAddressTabProps) {
  const t = useTranslations('businessPartners');
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<CreateBpFormValues>();

  const isHeadOffice = watch('isHeadOffice');

  return (
    <div className="space-y-6">
      {/* Tax ID */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t('taxId')}</Label>
          <Input {...register('taxId')} placeholder="0000000000000" maxLength={13} />
          {errors.taxId && (
            <p className="text-destructive text-sm">{String(errors.taxId.message)}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>{t('isHeadOffice')}</Label>
          <div className="flex h-10 items-center">
            <Controller
              control={control}
              name="isHeadOffice"
              render={({ field: f }) => (
                <Switch
                  checked={f.value ?? true}
                  onCheckedChange={f.onChange}
                />
              )}
            />
          </div>
        </div>

        {isHeadOffice === false && (
          <div className="space-y-1.5">
            <Label>{t('branchCode')}</Label>
            <Input {...register('branchCode')} placeholder="00000" maxLength={5} />
            {errors.branchCode && (
              <p className="text-destructive text-sm">{String(errors.branchCode.message)}</p>
            )}
          </div>
        )}
      </div>

      {/* VAT / WHT */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t('defaultVatCode')}</Label>
          <Controller
            control={control}
            name="defaultVatCodeId"
            render={({ field: f }) => (
              <Select value={f.value ?? ''} onValueChange={(v) => f.onChange(v || null)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('none')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('none')}</SelectItem>
                  {vatCodes.map((tc) => (
                    <SelectItem key={tc.id} value={tc.id}>
                      {tc.name} ({tc.rate}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t('defaultWhtCode')}</Label>
          <Controller
            control={control}
            name="defaultWhtCodeId"
            render={({ field: f }) => (
              <Select value={f.value ?? ''} onValueChange={(v) => f.onChange(v || null)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('none')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('none')}</SelectItem>
                  {whtCodes.map((tc) => (
                    <SelectItem key={tc.id} value={tc.id}>
                      {tc.name} ({tc.rate}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">{t('address.title')}</h3>
        <div className="space-y-1.5">
          <Label>{t('address.line1')}</Label>
          <Input {...register('addressLine1')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>{t('address.subDistrict')}</Label>
            <Input {...register('subDistrict')} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('address.district')}</Label>
            <Input {...register('district')} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('address.province')}</Label>
            <Input {...register('province')} />
          </div>
        </div>
        <div className="space-y-1.5 sm:w-1/3">
          <Label>{t('address.zipcode')}</Label>
          <Input {...register('zipcode')} placeholder="00000" maxLength={5} />
          {errors.zipcode && (
            <p className="text-destructive text-sm">{String(errors.zipcode.message)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
