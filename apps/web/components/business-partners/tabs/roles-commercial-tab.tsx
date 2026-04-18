'use client';

import { useFormContext, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Checkbox, Input, Label } from '@petiatrics/ui';
import { BpRole } from '@petiatrics/types';
import { CreateBpFormValues } from '../bp-form-schema';

const ROLE_LABELS: Record<BpRole, string> = {
  [BpRole.AR_SOLD_TO]: 'AR Sold-To (ผู้ซื้อ)',
  [BpRole.AR_SHIP_TO]: 'AR Ship-To (ผู้รับสินค้า)',
  [BpRole.AR_INVOICE_TO]: 'AR Invoice-To (ผู้รับใบแจ้งหนี้)',
  [BpRole.AR_PAY_BY]: 'AR Pay-By (ผู้ชำระเงิน)',
  [BpRole.AP_BUY_FROM]: 'AP Buy-From (ผู้ขาย)',
  [BpRole.AP_SHIP_FROM]: 'AP Ship-From (ผู้จัดส่ง)',
  [BpRole.AP_INVOICE_FROM]: 'AP Invoice-From (ผู้ออกใบแจ้งหนี้)',
  [BpRole.AP_PAY_TO]: 'AP Pay-To (ผู้รับเงิน)',
};

const ALL_ROLES = Object.values(BpRole);

export default function RolesCommercialTab() {
  const t = useTranslations('businessPartners');
  const { control, register, watch } = useFormContext<CreateBpFormValues>();

  const activeRoles = watch('activeRoles') ?? [];

  return (
    <div className="space-y-6">
      {/* Roles */}
      <div>
        <h3 className="mb-3 text-sm font-medium">{t('roles.title')}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ALL_ROLES.map((role) => (
            <Controller
              key={role}
              control={control}
              name="activeRoles"
              render={({ field: f }) => {
                const checked = (f.value ?? []).includes(role);
                return (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`role-${role}`}
                      checked={checked}
                      onCheckedChange={(val) => {
                        const current: BpRole[] = f.value ?? [];
                        if (val) {
                          f.onChange([...current, role]);
                        } else {
                          f.onChange(current.filter((r) => r !== role));
                        }
                      }}
                    />
                    <Label htmlFor={`role-${role}`} className="cursor-pointer font-normal">
                      {ROLE_LABELS[role]}
                    </Label>
                  </div>
                );
              }}
            />
          ))}
        </div>
      </div>

      {/* Commercial */}
      <div>
        <h3 className="mb-3 text-sm font-medium">{t('commercial.title')}</h3>
        <div className="space-y-1.5 sm:w-1/2">
          <Label>{t('discountGroupId')}</Label>
          <Input {...register('discountGroupId')} placeholder={t('discountGroupId')} />
        </div>
      </div>
    </div>
  );
}
