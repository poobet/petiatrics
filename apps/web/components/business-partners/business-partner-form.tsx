'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@petiatrics/ui';
import { Checkbox } from '@petiatrics/ui';
import { Input } from '@petiatrics/ui';
import { Label } from '@petiatrics/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@petiatrics/ui';
import { Separator } from '@petiatrics/ui';
import { Switch } from '@petiatrics/ui';
import { apiClient } from '../../lib/api-client';
import ExtensionFields, { VetFields } from './extension-fields';
import {
  BpRole,
  BusinessPartnerType,
  BusinessPartnerResponse,
  CreateBusinessPartnerPayload,
  TaxCodeResponse,
  UpdateBusinessPartnerPayload,
} from '@petiatrics/types';

interface BusinessPartnerFormProps {
  /** Populated when editing an existing BP; absent for create. */
  initial?: BusinessPartnerResponse;
}

const ALL_ROLES = Object.values(BpRole);

export default function BusinessPartnerForm({ initial }: BusinessPartnerFormProps) {
  const t = useTranslations('businessPartners');
  const tCommon = useTranslations('common');
  const router = useRouter();

  // ── Core Identity ────────────────────────────────────────────────────────
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<BusinessPartnerType | ''>(
    initial?.type ?? '',
  );

  // ── Thai Compliance ──────────────────────────────────────────────────────
  const [taxId, setTaxId] = useState(initial?.taxId ?? '');
  const [isHeadOffice, setIsHeadOffice] = useState(
    initial?.isHeadOffice ?? true,
  );
  const [branchCode, setBranchCode] = useState(initial?.branchCode ?? '');

  // ── Address ──────────────────────────────────────────────────────────────
  const [addressLine1, setAddressLine1] = useState(initial?.addressLine1 ?? '');
  const [subDistrict, setSubDistrict] = useState(initial?.subDistrict ?? '');
  const [district, setDistrict] = useState(initial?.district ?? '');
  const [province, setProvince] = useState(initial?.province ?? '');
  const [zipcode, setZipcode] = useState(initial?.zipcode ?? '');

  // ── Tax Defaults ─────────────────────────────────────────────────────────
  const [taxCodes, setTaxCodes] = useState<TaxCodeResponse[]>([]);
  const [defaultVatCodeId, setDefaultVatCodeId] = useState(
    initial?.defaultVatCodeId ?? '',
  );
  const [defaultWhtCodeId, setDefaultWhtCodeId] = useState(
    initial?.defaultWhtCodeId ?? '',
  );

  // ── Payment ──────────────────────────────────────────────────────────────
  const [creditTermDays, setCreditTermDays] = useState(
    initial?.creditTermDays != null ? String(initial.creditTermDays) : '',
  );

  // ── LN Roles ─────────────────────────────────────────────────────────────
  const [activeRoles, setActiveRoles] = useState<BpRole[]>(
    initial?.activeRoles ?? [],
  );

  // ── VET Extension ────────────────────────────────────────────────────────
  const [vet, setVet] = useState<VetFields>({
    licenseNumber: initial?.vet?.licenseNumber ?? '',
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient
      .get<TaxCodeResponse[]>('/reference/tax-codes')
      .then(setTaxCodes)
      .catch(() => {
        // Tax codes endpoint may not exist yet — silently degrade to empty list
        setTaxCodes([]);
      });
  }, []);

  const vatCodes = taxCodes.filter((tc) => tc.isVatType);
  const whtCodes = taxCodes.filter((tc) => !tc.isVatType);

  function toggleRole(role: BpRole) {
    setActiveRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  function isValid() {
    if (!name.trim()) return false;
    if (!type) return false;
    if (taxId.trim() && !/^\d{13}$/.test(taxId.trim())) return false;
    if (type === BusinessPartnerType.VET && !vet.licenseNumber.trim())
      return false;
    return true;
  }

  async function handleSubmit() {
    if (!isValid()) return;
    setSubmitting(true);
    try {
      const payload: CreateBusinessPartnerPayload | UpdateBusinessPartnerPayload =
        {
          name: name.trim(),
          ...(initial ? {} : { type: type as BusinessPartnerType }),
          taxId: taxId.trim() || null,
          isHeadOffice,
          branchCode: !isHeadOffice && branchCode.trim() ? branchCode.trim() : null,
          addressLine1: addressLine1.trim() || null,
          subDistrict: subDistrict.trim() || null,
          district: district.trim() || null,
          province: province.trim() || null,
          zipcode: zipcode.trim() || null,
          defaultVatCodeId: defaultVatCodeId || null,
          defaultWhtCodeId: defaultWhtCodeId || null,
          creditTermDays: creditTermDays ? parseInt(creditTermDays, 10) : undefined,
          activeRoles,
          vet:
            type === BusinessPartnerType.VET
              ? { licenseNumber: vet.licenseNumber.trim() }
              : null,
          supplier: null,
        };

      if (initial) {
        await apiClient.patch<BusinessPartnerResponse>(
          `/clinic/business-partners/${initial.id}`,
          payload,
        );
      } else {
        await apiClient.post<BusinessPartnerResponse>(
          '/clinic/business-partners',
          payload,
        );
      }

      router.push('/clinic/business-partners');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    router.back();
  }

  const isEdit = !!initial;
  const allTypes = Object.values(BusinessPartnerType);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={handleCancel} disabled={submitting} aria-label={tCommon('back')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? t('edit') : t('new')}
        </h1>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-5">
      {/* ── Core Identity ─────────────────────────────────────────────── */}
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

      <Separator />

      {/* ── Thai Compliance ───────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label>{t('taxId')}</Label>
        <Input
          value={taxId}
          onChange={(e) => setTaxId(e.target.value)}
          placeholder="0000000000000"
          maxLength={13}
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="isHeadOffice"
          checked={isHeadOffice}
          onCheckedChange={setIsHeadOffice}
        />
        <Label htmlFor="isHeadOffice">{t('isHeadOffice')}</Label>
      </div>

      {!isHeadOffice && (
        <div className="space-y-1.5">
          <Label>{t('branchCode')}</Label>
          <Input
            value={branchCode}
            onChange={(e) => setBranchCode(e.target.value)}
            placeholder="00001"
            maxLength={5}
          />
        </div>
      )}

      <Separator />

      {/* ── Address ───────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label>{t('addressLine1')}</Label>
        <Input
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t('subDistrict')}</Label>
          <Input
            value={subDistrict}
            onChange={(e) => setSubDistrict(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('district')}</Label>
          <Input
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('province')}</Label>
          <Input
            value={province}
            onChange={(e) => setProvince(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('zipcode')}</Label>
          <Input
            value={zipcode}
            onChange={(e) => setZipcode(e.target.value)}
            maxLength={5}
          />
        </div>
      </div>

      <Separator />

      {/* ── Tax Defaults ──────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>{t('defaultVatCode')}</Label>
          {defaultVatCodeId && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setDefaultVatCodeId('')}
            >
              {tCommon('clear')}
            </button>
          )}
        </div>
        <Select
          value={defaultVatCodeId}
          onValueChange={setDefaultVatCodeId}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('noTaxCode')} />
          </SelectTrigger>
          <SelectContent>
            {vatCodes.map((tc) => (
              <SelectItem key={tc.id} value={tc.id}>
                {tc.code} — {tc.description} ({tc.rate}%)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>{t('defaultWhtCode')}</Label>
          {defaultWhtCodeId && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setDefaultWhtCodeId('')}
            >
              {tCommon('clear')}
            </button>
          )}
        </div>
        <Select
          value={defaultWhtCodeId}
          onValueChange={setDefaultWhtCodeId}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('noTaxCode')} />
          </SelectTrigger>
          <SelectContent>
            {whtCodes.map((tc) => (
              <SelectItem key={tc.id} value={tc.id}>
                {tc.code} — {tc.description} ({tc.rate}%)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Payment ───────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label>{t('creditTermDays')}</Label>
        <Input
          type="number"
          min="0"
          value={creditTermDays}
          onChange={(e) => setCreditTermDays(e.target.value)}
          placeholder="30"
        />
      </div>

      <Separator />

      {/* ── LN Roles ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label>{t('activeRoles')}</Label>
        <div className="grid grid-cols-2 gap-2">
          {ALL_ROLES.map((role) => (
            <label
              key={role}
              className="flex items-center gap-2 cursor-pointer text-sm"
            >
              <Checkbox
                checked={activeRoles.includes(role)}
                onCheckedChange={() => toggleRole(role)}
              />
              {t(`roles.${role}`)}
            </label>
          ))}
        </div>
      </div>

      {/* ── VET Extension ─────────────────────────────────────────────── */}
      {type === BusinessPartnerType.VET && (
        <>
          <Separator />
          <ExtensionFields type={type} vet={vet} onVetChange={setVet} />
        </>
      )}

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div className="flex gap-2 pt-2">
        <Button
          className="flex-1"
          disabled={submitting || !isValid()}
          onClick={handleSubmit}
        >
          {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {tCommon('save')}
        </Button>
        <Button variant="outline" onClick={handleCancel} disabled={submitting}>
          {tCommon('cancel')}
        </Button>
      </div>
      </div>
    </div>
  );
}

