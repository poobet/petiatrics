'use client';

import { useFormContext, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button, Input, Label } from '@petiatrics/ui';
import { Plus, Trash2 } from 'lucide-react';
import { CreateBpFormValues } from '../bp-form-schema';

export default function ContactTab() {
  const t = useTranslations('businessPartners');
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<CreateBpFormValues>();

  const { fields, append, remove } = useFieldArray({ control, name: 'contacts' });

  // Watch contacts to reactively update the primary contact display section
  const contacts = useWatch({ control, name: 'contacts' });
  const primaryContact = contacts?.find((c) => c.isPrimary) ?? null;

  function handleSetPrimary(index: number) {
    fields.forEach((_, i) => {
      setValue(`contacts.${i}.isPrimary`, i === index, { shouldValidate: true });
    });
  }

  return (
    <div className="space-y-6">
      {/* BP name field */}
      <div className="space-y-1.5">
        <Label>{t('name')}</Label>
        <Input {...register('name')} placeholder="Business Partner Name" />
        {errors.name && (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        )}
      </div>

      {/* Hidden BP-level contact fields (kept in form state) */}
      <input type="hidden" {...register('phone')} />
      <input type="hidden" {...register('email')} />
      <input type="hidden" {...register('lineId')} />

      {/* Primary contact display */}
      <div>
        <h3 className="text-sm font-medium mb-3">{t('contacts.primarySection')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('contacts.name')}</p>
            <p className="text-sm font-medium min-h-6">{primaryContact?.name || '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('contacts.phone')}</p>
            <p className="text-sm font-medium min-h-6">{primaryContact?.phone || '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('contacts.lineId')}</p>
            <p className="text-sm font-medium min-h-6">{primaryContact?.lineId || '—'}</p>
          </div>
        </div>
      </div>

      {/* Sub-contacts table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium">{t('contacts.secondarySection')}</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ name: '', phone: null, email: null, lineId: null, isPrimary: false })}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t('contacts.addRow')}
          </Button>
        </div>

        {errors.contacts?.root && (
          <p className="text-destructive mb-2 text-sm">{errors.contacts.root.message}</p>
        )}

        {fields.length === 0 ? (
          <p className="text-muted-foreground text-sm py-6 text-center border rounded-md">—</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-10">
                    ลำดับ
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {t('contacts.name')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {t('contacts.phone')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {t('contacts.lineId')}
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-24">
                    {t('contacts.markAsPrimary')}
                  </th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={field.id} className="border-t">
                    {/* Hidden fields — id is NOT registered to DOM; RHF keeps it in internal store from defaultValues */}
                    <td hidden>
                      <input type="hidden" {...register(`contacts.${index}.email`)} />
                      <input type="hidden" {...register(`contacts.${index}.position`)} />
                    </td>

                    {/* Sequence */}
                    <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>

                    {/* Name */}
                    <td className="px-3 py-2">
                      <Input
                        {...register(`contacts.${index}.name`)}
                        className="h-8 min-w-30"
                      />
                      {errors.contacts?.[index]?.name && (
                        <p className="text-destructive text-xs mt-0.5">
                          {errors.contacts[index]!.name!.message}
                        </p>
                      )}
                    </td>

                    {/* Phone */}
                    <td className="px-3 py-2">
                      <Input
                        {...register(`contacts.${index}.phone`)}
                        className="h-8 min-w-27.5"
                        placeholder="0812345678"
                      />
                    </td>

                    {/* LINE ID */}
                    <td className="px-3 py-2">
                      <Input
                        {...register(`contacts.${index}.lineId`)}
                        className="h-8 min-w-27.5"
                        placeholder="@lineid"
                      />
                    </td>

                    {/* Is Primary */}
                    <td className="px-3 py-2 text-center">
                      <Controller
                        control={control}
                        name={`contacts.${index}.isPrimary`}
                        render={({ field: f }) => (
                          <input
                            type="radio"
                            name="primaryContact"
                            checked={f.value ?? false}
                            onChange={() => handleSetPrimary(index)}
                            className="h-4 w-4 cursor-pointer accent-primary"
                            aria-label={t('contacts.markAsPrimary')}
                          />
                        )}
                      />
                    </td>

                    {/* Delete */}
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(index)}
                        className="h-8 w-8 p-0"
                        aria-label="ลบผู้ติดต่อ"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
