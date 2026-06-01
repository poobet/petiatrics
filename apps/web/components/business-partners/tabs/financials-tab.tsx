'use client';

import { useFormContext, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Input, Label, Switch } from '@petiatrics/ui';
import { CreateBpFormValues } from '../bp-form-schema';

export default function FinancialsTab() {
  const t = useTranslations('businessPartners');
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<CreateBpFormValues>();

  return (
    <div className="space-y-6">
      {/* Credit settings */}
      <div>
        <h3 className="mb-3 text-sm font-medium">{t('financials.credit')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>{t('creditLimit')}</Label>
            <Input
              {...register('creditLimit', { setValueAs: (v) => v === '' ? undefined : Number(v) })}
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
            />
            {errors.creditLimit && (
              <p className="text-destructive text-sm">{errors.creditLimit.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bp-creditTermDays">{t('creditTermDays')}</Label>
            <Input
              id="bp-creditTermDays"
              {...register('creditTermDays', { valueAsNumber: true })}
              type="number"
              min={0}
              step={1}
              placeholder="0"
            />
            {errors.creditTermDays && (
              <p className="text-destructive text-sm">{errors.creditTermDays.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t('creditHold')}</Label>
            <div className="flex h-10 items-center">
              <Controller
                control={control}
                name="creditHold"
                render={({ field: f }) => (
                  <Switch checked={f.value ?? false} onCheckedChange={f.onChange} />
                )}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bank account */}
      <div>
        <h3 className="mb-3 text-sm font-medium">{t('financials.bankAccount')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>{t('bankAccountName')}</Label>
            <Input {...register('bankAccountName')} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('bankAccountBranch')}</Label>
            <Input {...register('bankAccountBranch')} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('bankAccountNumber')}</Label>
            <Input {...register('bankAccountNumber')} />
          </div>
        </div>
      </div>
    </div>
  );
}
