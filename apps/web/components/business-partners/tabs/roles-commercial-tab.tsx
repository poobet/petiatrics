'use client';

import { useFormContext, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from '@petiatrics/ui';
import { BpRole, BpGroupResponse } from '@petiatrics/types';
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

interface RolesCommercialTabProps {
  bpGroups: BpGroupResponse[];
  groupsLoading: boolean;
  isEdit: boolean;
  /** When editing, the already-assigned group (read-only display). */
  existingGroup?: { id: string; name: string; prefix: string } | null;
  /** When editing, the already-assigned BP code (read-only display). */
  existingCode?: string | null;
}

export default function RolesCommercialTab({
  bpGroups,
  groupsLoading,
  isEdit,
  existingGroup,
  existingCode,
}: RolesCommercialTabProps) {
  const t = useTranslations('businessPartners');
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useFormContext<CreateBpFormValues>();

  const activeRoles = watch('activeRoles') ?? [];
  const watchedGroupId = watch('groupId');
  const previewGroup = bpGroups.find((g) => g.id === watchedGroupId);
  const previewCode = previewGroup
    ? `${previewGroup.prefix}${(previewGroup.currentSequence + 1).toString().padStart(4, '0')}`
    : null;

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('discountGroupId')}</Label>
            <Input {...register('discountGroupId')} placeholder={t('discountGroupId')} />
          </div>

          {/* BP Group — editable only on create */}
          <div className="space-y-1.5">
            <Label>{t('group')}</Label>
            {isEdit ? (
              <p className="text-muted-foreground mt-1 text-sm">
                {existingGroup ? existingGroup.name : t('noGroup')}
                {existingCode && (
                  <span className="ml-2 font-mono text-xs">({existingCode})</span>
                )}
              </p>
            ) : (
              <>
                <Controller
                  control={control}
                  name="groupId"
                  render={({ field: f }) => (
                    <Select
                      value={f.value ?? '__none__'}
                      onValueChange={(v) => f.onChange(v === '__none__' ? null : v)}
                      disabled={groupsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={groupsLoading ? t('loading') : t('noGroup')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t('noGroup')}</SelectItem>
                        {bpGroups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name} ({g.prefix})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.groupId && (
                  <p className="text-destructive text-sm">{String(errors.groupId.message)}</p>
                )}
                {previewCode && (
                  <p className="text-muted-foreground text-xs">
                    {t('nextCode', { code: previewCode })}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* CRM */}
      <div>
        <h3 className="mb-3 text-sm font-medium">CRM</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="isMarketingOptIn"
              render={({ field: f }) => (
                <Switch
                  id="isMarketingOptIn"
                  checked={f.value ?? false}
                  onCheckedChange={f.onChange}
                />
              )}
            />
            <Label htmlFor="isMarketingOptIn" className="cursor-pointer font-normal">
              {t('isMarketingOptIn')}
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="alertMessage">{t('alertMessage')}</Label>
            <Input
              id="alertMessage"
              {...register('alertMessage')}
              placeholder="e.g. VIP customer — handle with care"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="internalNotes">{t('internalNotes')}</Label>
            <textarea
              id="internalNotes"
              {...register('internalNotes')}
              rows={3}
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1"
              placeholder="Internal notes visible to staff only…"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
