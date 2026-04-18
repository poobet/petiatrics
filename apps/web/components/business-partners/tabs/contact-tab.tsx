'use client';

import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from '@petiatrics/ui';
import { ContactPositionResponse } from '@petiatrics/types';
import { Plus, Trash2 } from 'lucide-react';
import { CreateBpFormValues } from '../bp-form-schema';

interface ContactTabProps {
  contactPositions: ContactPositionResponse[];
  positionsLoading: boolean;
}

export default function ContactTab({ contactPositions, positionsLoading }: ContactTabProps) {
  const t = useTranslations('businessPartners');
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<CreateBpFormValues>();

  const { fields, append, remove } = useFieldArray({ control, name: 'contacts' });

  function handleSetPrimary(index: number) {
    fields.forEach((_, i) => {
      setValue(`contacts.${i}.isPrimary`, i === index, { shouldValidate: true });
    });
  }

  return (
    <div className="space-y-6">
      {/* BP-level contact fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>{t('phone')}</Label>
          <Input {...register('phone')} placeholder="+66 2 000 0000" />
          {errors.phone && (
            <p className="text-destructive text-sm">{errors.phone.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>{t('email')}</Label>
          <Input {...register('email')} type="email" placeholder="contact@example.com" />
          {errors.email && (
            <p className="text-destructive text-sm">{String(errors.email.message)}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>{t('lineId')}</Label>
          <Input {...register('lineId')} placeholder="@lineid" />
        </div>
      </div>

      {/* Contact persons */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium">{t('contacts.title')}</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ name: '', isPrimary: false })}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t('contacts.add')}
          </Button>
        </div>

        {errors.contacts?.root && (
          <p className="text-destructive mb-2 text-sm">{errors.contacts.root.message}</p>
        )}

        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {t('contacts.person')} {index + 1}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t('contacts.name')}</Label>
                  <Input {...register(`contacts.${index}.name`)} />
                  {errors.contacts?.[index]?.name && (
                    <p className="text-destructive text-sm">
                      {errors.contacts[index]!.name!.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>{t('contacts.position')}</Label>
                  <Controller
                    control={control}
                    name={`contacts.${index}.positionId`}
                    render={({ field: f }) => (
                      <Select
                        value={f.value ?? ''}
                        onValueChange={(v) => f.onChange(v || null)}
                        disabled={positionsLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={positionsLoading ? t('loading') : t('contacts.selectPosition')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">{t('contacts.noPosition')}</SelectItem>
                          {contactPositions.map((pos) => (
                            <SelectItem key={pos.id} value={pos.id}>
                              {pos.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>{t('contacts.phone')}</Label>
                  <Input {...register(`contacts.${index}.phone`)} />
                </div>

                <div className="space-y-1.5">
                  <Label>{t('contacts.email')}</Label>
                  <Input {...register(`contacts.${index}.email`)} type="email" />
                  {errors.contacts?.[index]?.email && (
                    <p className="text-destructive text-sm">
                      {String(errors.contacts[index]!.email!.message)}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>{t('contacts.lineId')}</Label>
                  <Input {...register(`contacts.${index}.lineId`)} placeholder="@lineid" />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Controller
                  control={control}
                  name={`contacts.${index}.isPrimary`}
                  render={({ field: f }) => (
                    <Checkbox
                      id={`contacts-${index}-isPrimary`}
                      checked={f.value ?? false}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleSetPrimary(index);
                        } else {
                          f.onChange(false);
                        }
                      }}
                    />
                  )}
                />
                <Label htmlFor={`contacts-${index}-isPrimary`} className="cursor-pointer">
                  {t('contacts.isPrimary')}
                </Label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
