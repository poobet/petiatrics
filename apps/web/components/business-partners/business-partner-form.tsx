'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator, Tabs, TabsList, TabsTrigger, TabsContent } from '@petiatrics/ui';
import { apiClient } from '../../lib/api-client';
import ExtensionFields from './extension-fields';
import BpAlertBanner from './bp-alert-banner';
import {
  BusinessPartnerType,
  BusinessPartnerResponse,
  CreateBusinessPartnerPayload,
  TaxCodeResponse,
  UpdateBusinessPartnerPayload,
  BpGroupResponse,
} from '@petiatrics/types';
import {
  createBpSchema,
  editBpSchema,
  CreateBpFormValues,
  EditBpFormValues,
} from './bp-form-schema';
import ContactTab from './tabs/contact-tab';
import TaxAddressTab from './tabs/tax-address-tab';
import RolesCommercialTab from './tabs/roles-commercial-tab';
import FinancialsTab from './tabs/financials-tab';

interface BusinessPartnerFormProps {
  initial?: BusinessPartnerResponse;
}

const TAB_FIELDS: Record<string, (keyof CreateBpFormValues)[]> = {
  contact: ['phone', 'email', 'lineId', 'contacts'],
  tax: ['taxId', 'isHeadOffice', 'branchCode', 'addressLine1', 'subDistrict', 'district', 'province', 'zipcode', 'defaultVatCodeId', 'defaultWhtCodeId'],
  roles: ['activeRoles', 'discountGroupId', 'groupId', 'isMarketingOptIn', 'internalNotes', 'alertMessage'],
  financials: ['creditLimit', 'creditTermDays', 'creditHold', 'bankAccountName', 'bankAccountBranch', 'bankAccountNumber'],
};

function buildDefaultValues(initial?: BusinessPartnerResponse): Partial<CreateBpFormValues> {
  if (!initial) return {};
  return {
    name: initial.name,
    taxId: initial.taxId ?? '',
    isHeadOffice: initial.isHeadOffice,
    branchCode: initial.branchCode ?? '',
    addressLine1: initial.addressLine1 ?? '',
    subDistrict: initial.subDistrict ?? '',
    district: initial.district ?? '',
    province: initial.province ?? '',
    zipcode: initial.zipcode ?? '',
    defaultVatCodeId: initial.defaultVatCodeId ?? '',
    defaultWhtCodeId: initial.defaultWhtCodeId ?? '',
    phone: initial.phone ?? '',
    email: initial.email ?? '',
    lineId: initial.lineId ?? '',
    creditTermDays: initial.creditTermDays ?? undefined,
    creditLimit: initial.creditLimit ?? undefined,
    creditHold: initial.creditHold ?? false,
    discountGroupId: initial.discountGroupId ?? '',
    groupId: initial.groupId ?? null,
    isMarketingOptIn: initial.isMarketingOptIn ?? false,
    internalNotes: initial.internalNotes ?? '',
    alertMessage: initial.alertMessage ?? '',
    bankAccountName: initial.bankAccountName ?? '',
    bankAccountBranch: initial.bankAccountBranch ?? '',
    bankAccountNumber: initial.bankAccountNumber ?? '',
    activeRoles: initial.activeRoles ?? [],
    vet: initial.vet ? {
      licenseNumber: initial.vet.licenseNumber,
      specialty: initial.vet.specialty ?? '',
      defaultDfRate: initial.vet.defaultDfRate ?? undefined,
    } : undefined,
    contacts: (initial.contacts ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? '',
      lineId: c.lineId ?? '',
      position: c.position ?? '',
      isPrimary: c.isPrimary,
    })),
  };
}

export default function BusinessPartnerForm({ initial }: BusinessPartnerFormProps) {
  const t = useTranslations('businessPartners');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const isEdit = !!initial;

  const [taxCodes, setTaxCodes] = useState<TaxCodeResponse[]>([]);
  const [bpGroups, setBpGroups] = useState<BpGroupResponse[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schema: any = isEdit ? editBpSchema : createBpSchema;

  const methods = useForm<CreateBpFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      isHeadOffice: true,
      creditHold: false,
      activeRoles: [],
      contacts: [],
      ...buildDefaultValues(initial),
    },
  });

  const { register, handleSubmit, watch, formState: { errors } } = methods;
  const type = watch('type') ?? (initial?.type as BusinessPartnerType | undefined);

  useEffect(() => {
    Promise.all([
      apiClient.get<TaxCodeResponse[]>('/reference/tax-codes').catch(() => [] as TaxCodeResponse[]),
      apiClient.get<BpGroupResponse[]>('/reference/bp-groups').catch(() => [] as BpGroupResponse[]),
    ]).then(([codes, groups]) => {
      setTaxCodes(codes);
      setBpGroups(groups);
      setGroupsLoading(false);
    });
  }, []);

  const vatCodes = taxCodes.filter((tc) => tc.isVatType);
  const whtCodes = taxCodes.filter((tc) => !tc.isVatType);

  function hasTabErrors(tabKey: string): boolean {
    const fields = TAB_FIELDS[tabKey] ?? [];
    return fields.some((f) => !!errors[f]);
  }

  async function onSubmit(values: CreateBpFormValues | EditBpFormValues) {
    setSubmitting(true);
    setServerError(null);
    try {
      const payload: CreateBusinessPartnerPayload | UpdateBusinessPartnerPayload = {
        ...(!isEdit ? { type: (values as CreateBpFormValues).type } : {}),
        name: values.name,
        taxId: values.taxId ?? null,
        isHeadOffice: values.isHeadOffice,
        branchCode: values.branchCode ?? null,
        addressLine1: values.addressLine1 ?? null,
        subDistrict: values.subDistrict ?? null,
        district: values.district ?? null,
        province: values.province ?? null,
        zipcode: values.zipcode ?? null,
        defaultVatCodeId: values.defaultVatCodeId ?? null,
        defaultWhtCodeId: values.defaultWhtCodeId ?? null,
        phone: values.phone ?? null,
        email: values.email ?? null,
        lineId: values.lineId ?? null,
        creditTermDays: values.creditTermDays ?? undefined,
        creditLimit: values.creditLimit ?? null,
        creditHold: values.creditHold ?? false,
        discountGroupId: values.discountGroupId ?? null,
        bankAccountName: values.bankAccountName ?? null,
        bankAccountBranch: values.bankAccountBranch ?? null,
        bankAccountNumber: values.bankAccountNumber ?? null,
        activeRoles: values.activeRoles ?? [],
        vet: type === BusinessPartnerType.VET && values.vet?.licenseNumber
          ? {
              licenseNumber: values.vet.licenseNumber,
              specialty: values.vet.specialty ?? null,
              defaultDfRate: values.vet.defaultDfRate ?? null,
            }
          : null,
        contacts: (values.contacts ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone ?? null,
          email: c.email ?? null,
          lineId: c.lineId ?? null,
          position: c.position ?? null,
          isPrimary: c.isPrimary ?? false,
        })),
        isMarketingOptIn: values.isMarketingOptIn ?? false,
        internalNotes: values.internalNotes ?? null,
        alertMessage: values.alertMessage ?? null,
        ...(!isEdit ? { groupId: (values as CreateBpFormValues).groupId ?? null } : {}),
        supplier: null,
      };

      if (isEdit) {
        await apiClient.patch<BusinessPartnerResponse>(`/clinic/business-partners/${initial!.id}`, payload);
      } else {
        await apiClient.post<BusinessPartnerResponse>('/clinic/business-partners', payload);
      }

      router.push('/clinic/business-partners');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const allTypes = Object.values(BusinessPartnerType);

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit as Parameters<typeof handleSubmit>[0])} className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => router.back()} disabled={submitting} aria-label={tCommon('back')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? t('edit') : t('new')}
          </h1>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-5">
          <div className="space-y-1.5">
            <Label>{t('name')}</Label>
            <Input {...register('name')} placeholder="Business Partner Name" />
            {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label>{t('type')}</Label>
              <Select
                onValueChange={(v) => methods.setValue('type', v as BusinessPartnerType, { shouldValidate: true })}
                defaultValue={''}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tCommon('filter')} />
                </SelectTrigger>
                <SelectContent>
                  {allTypes.map((bpType) => (
                    <SelectItem key={bpType} value={bpType}>{t(`types.${bpType}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && <p className="text-destructive text-sm">{errors.type.message}</p>}
            </div>
          )}

          <Separator />

          {initial?.alertMessage && (
            <BpAlertBanner message={initial.alertMessage} />
          )}

          <Tabs defaultValue="contact">
            <TabsList className="w-full">
              <TabsTrigger value="contact" className="flex-1 gap-1.5">
                {t('tabs.contact')}
                {hasTabErrors('contact') && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
              </TabsTrigger>
              <TabsTrigger value="tax" className="flex-1 gap-1.5">
                {t('tabs.tax')}
                {hasTabErrors('tax') && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
              </TabsTrigger>
              <TabsTrigger value="roles" className="flex-1 gap-1.5">
                {t('tabs.roles')}
                {hasTabErrors('roles') && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
              </TabsTrigger>
              <TabsTrigger value="financials" className="flex-1 gap-1.5">
                {t('tabs.financials')}
                {hasTabErrors('financials') && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="contact" className="pt-4">
              <ContactTab />
            </TabsContent>
            <TabsContent value="tax" className="pt-4">
              <TaxAddressTab vatCodes={vatCodes} whtCodes={whtCodes} />
            </TabsContent>
            <TabsContent value="roles" className="pt-4">
              <RolesCommercialTab
                bpGroups={bpGroups}
                groupsLoading={groupsLoading}
                isEdit={isEdit}
                existingGroup={initial?.group ?? null}
                existingCode={initial?.code ?? null}
              />
            </TabsContent>
            <TabsContent value="financials" className="pt-4">
              <FinancialsTab />
            </TabsContent>
          </Tabs>

          {type === BusinessPartnerType.VET && (
            <>
              <Separator />
              <ExtensionFields type={type} />
            </>
          )}

          {serverError && <p className="text-destructive text-sm">{serverError}</p>}

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('save')}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
              {tCommon('cancel')}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
