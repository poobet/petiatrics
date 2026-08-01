import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Role, BusinessPartnerType, BusinessPartnerResponse } from '@petiatrics/types';
import BusinessPartnerTable from './business-partner-table';

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

function makeBp(overrides?: Partial<BusinessPartnerResponse>): BusinessPartnerResponse {
  return {
    id: 'bp-1',
    clinicId: 'clinic-1',
    type: BusinessPartnerType.CUSTOMER,
    name: 'Acme Corp',
    taxId: null,
    isHeadOffice: true,
    branchCode: null,
    addressLine1: null,
    subDistrict: null,
    district: null,
    province: null,
    zipcode: null,
    parentBpId: null,
    defaultVatCodeId: null,
    defaultWhtCodeId: null,
    defaultVatCode: null,
    defaultWhtCode: null,
    isVatRegistered: false,
    creditTermDays: 0,
    phone: null,
    email: null,
    lineId: null,
    creditLimit: null,
    creditHold: false,
    discountGroupId: null,
    groupId: null,
    code: null,
    isMarketingOptIn: false,
    internalNotes: null,
    alertMessage: null,
    group: null,
    bankAccountName: null,
    bankAccountBranch: null,
    bankAccountNumber: null,
    contacts: [],
    activeRoles: [],
    isActive: true,
    user: null,
    vet: null,
    supplier: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('BusinessPartnerTable', () => {
  it('shows empty state when no partners', () => {
    render(
      <BusinessPartnerTable
        partners={[]}
        canWrite={false}
        canDeactivate={false}
        busyId={null}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );
    expect(screen.getByText('businessPartners.noPartners')).toBeDefined();
  });

  it('renders partner rows with name and type', () => {
    render(
      <BusinessPartnerTable
        partners={[makeBp({ name: 'Vet Clinic', type: BusinessPartnerType.VET })]}
        canWrite={false}
        canDeactivate={false}
        busyId={null}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );
    expect(screen.getByText('Vet Clinic')).toBeDefined();
    expect(screen.getByText('businessPartners.types.VET')).toBeDefined();
  });

  it('hides action column when canWrite is false', () => {
    render(
      <BusinessPartnerTable
        partners={[makeBp()]}
        canWrite={false}
        canDeactivate={false}
        busyId={null}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows action button when canWrite is true', () => {
    render(
      <BusinessPartnerTable
        partners={[makeBp()]}
        canWrite={true}
        canDeactivate={false}
        busyId={null}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toBeDefined();
  });

  it('shows linked user email when present', () => {
    render(
      <BusinessPartnerTable
        partners={[
          makeBp({
            user: {
              id: 'u-1',
              name: 'Dr Vet',
              status: 'ACTIVE',
              role: Role.VET,
              email: 'vet@clinic.com',
              username: 'vet',
            },
          }),
        ]}
        canWrite={false}
        canDeactivate={false}
        busyId={null}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );
    expect(screen.getByText('vet@clinic.com')).toBeDefined();
  });
});
