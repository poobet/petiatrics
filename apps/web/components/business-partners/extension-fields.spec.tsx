import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BusinessPartnerType } from '@petiatrics/types';
import ExtensionFields from './extension-fields';

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

const noop = () => {};

describe('ExtensionFields', () => {
  it('renders nothing for non-VET/SUPPLIER types', () => {
    const { container } = render(
      <ExtensionFields
        type={BusinessPartnerType.CUSTOMER}
        vet={{ licenseNumber: '', whtRate: '' }}
        supplier={{ taxId: '', creditTermDays: '' }}
        onVetChange={noop}
        onSupplierChange={noop}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders vet fields when type is VET', () => {
    render(
      <ExtensionFields
        type={BusinessPartnerType.VET}
        vet={{ licenseNumber: 'VET-001', whtRate: '3' }}
        supplier={{ taxId: '', creditTermDays: '' }}
        onVetChange={noop}
        onSupplierChange={noop}
      />,
    );
    expect(screen.getByTestId('vet-fields')).toBeDefined();
  });

  it('calls onVetChange when license input changes', () => {
    const onVetChange = vi.fn();
    render(
      <ExtensionFields
        type={BusinessPartnerType.VET}
        vet={{ licenseNumber: '', whtRate: '' }}
        supplier={{ taxId: '', creditTermDays: '' }}
        onVetChange={onVetChange}
        onSupplierChange={noop}
      />,
    );
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'VET-999' } });
    expect(onVetChange).toHaveBeenCalledWith({ licenseNumber: 'VET-999', whtRate: '' });
  });

  it('renders supplier fields when type is SUPPLIER', () => {
    render(
      <ExtensionFields
        type={BusinessPartnerType.SUPPLIER}
        vet={{ licenseNumber: '', whtRate: '' }}
        supplier={{ taxId: '0105562000000', creditTermDays: '30' }}
        onVetChange={noop}
        onSupplierChange={noop}
      />,
    );
    expect(screen.getByTestId('supplier-fields')).toBeDefined();
  });

  it('calls onSupplierChange when taxId input changes', () => {
    const onSupplierChange = vi.fn();
    render(
      <ExtensionFields
        type={BusinessPartnerType.SUPPLIER}
        vet={{ licenseNumber: '', whtRate: '' }}
        supplier={{ taxId: '', creditTermDays: '' }}
        onVetChange={noop}
        onSupplierChange={onSupplierChange}
      />,
    );
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: '0105562000001' } });
    expect(onSupplierChange).toHaveBeenCalledWith({ taxId: '0105562000001', creditTermDays: '' });
  });
});
