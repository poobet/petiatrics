'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@petiatrics/ui';
import { Input } from '@petiatrics/ui';
import { Label } from '@petiatrics/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@petiatrics/ui';
import { Loader2 } from 'lucide-react';
import ExtensionFields from './extension-fields';
import {
  BusinessPartnerType,
  BusinessPartnerResponse,
  CreateBusinessPartnerPayload,
  UpdateBusinessPartnerPayload,
} from '@petiatrics/types';

interface BusinessPartnerFormProps {
  initial?: BusinessPartnerResponse;
  onSubmit: (
    payload: CreateBusinessPartnerPayload | UpdateBusinessPartnerPayload,
  ) => Promise<void>;
  onCancel: () => void;
}

export default function BusinessPartnerForm({
  initial,
  onSubmit,
  onCancel,
}: BusinessPartnerFormProps) {
  const t = useTranslations('businessPartners');
  const tCommon = useTranslations('common');

  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<BusinessPartnerType | ''>(
    initial?.type ?? '',
  );
  const [vet, setVet] = useState({
    licenseNumber: initial?.vet?.licenseNumber ?? '',
    whtRate: initial?.vet?.whtRate != null ? String(initial.vet.whtRate) : '',
  });
  const [supplier, setSupplier] = useState({
    taxId: initial?.supplier?.taxId ?? '',
    creditTermDays:
      initial?.supplier?.creditTermDays != null
        ? String(initial.supplier.creditTermDays)
        : '',
  });
  const [submitting, setSubmitting] = useState(false);

  function isValid() {
    if (!name.trim()) return false;
    if (!type) return false;
    if (type === BusinessPartnerType.VET && !vet.licenseNumber.trim()) return false;
    if (type === BusinessPartnerType.SUPPLIER) {
      if (!supplier.taxId.trim()) return false;
      if (!supplier.creditTermDays.trim()) return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (!isValid()) return;
    setSubmitting(true);
    try {
      const payload: CreateBusinessPartnerPayload | UpdateBusinessPartnerPayload = {
        name: name.trim(),
        ...(initial
          ? {}
          : { type: type as BusinessPartnerType }),
        vet:
          type === BusinessPartnerType.VET
            ? {
                licenseNumber: vet.licenseNumber.trim(),
                whtRate: vet.whtRate ? parseFloat(vet.whtRate) : undefined,
              }
            : null,
        supplier:
          type === BusinessPartnerType.SUPPLIER
            ? {
                taxId: supplier.taxId.trim(),
                creditTermDays: parseInt(supplier.creditTermDays, 10),
              }
            : null,
      };
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  }

  const isEdit = !!initial;
  const allTypes = Object.values(BusinessPartnerType);

  return (
    <div className="space-y-4 mt-2">
      <div className="space-y-1.5">
        <Label>{t('name')}</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Business Partner Name"
        />
      </div>

      {!isEdit && (
        <div className="space-y-1.5">
          <Label>{t('type')}</Label>
          <Select
            value={type}
            onValueChange={(v) => setType(v as BusinessPartnerType)}
          >
            <SelectTrigger>
              <SelectValue placeholder={tCommon('filter')} />
            </SelectTrigger>
            <SelectContent>
              {allTypes.map((bpType) => (
                <SelectItem key={bpType} value={bpType}>
                  {t(`types.${bpType}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <ExtensionFields
        type={type}
        vet={vet}
        supplier={supplier}
        onVetChange={setVet}
        onSupplierChange={setSupplier}
      />

      <div className="flex gap-2 pt-2">
        <Button
          className="flex-1"
          disabled={submitting || !isValid()}
          onClick={handleSubmit}
        >
          {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {tCommon('save')}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          {tCommon('cancel')}
        </Button>
      </div>
    </div>
  );
}
