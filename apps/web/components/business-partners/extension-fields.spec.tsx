import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BusinessPartnerType } from '@petiatrics/types';
import ExtensionFields from './extension-fields';

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

const noop = () => {};

describe('ExtensionFields', () => {
  it('renders nothing for non-VET types', () => {
    const { container } = render(
      <ExtensionFields
        type={BusinessPartnerType.CUSTOMER}
        vet={{ licenseNumber: '' }}
        onVetChange={noop}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders vet fields when type is VET', () => {
    render(
      <ExtensionFields
        type={BusinessPartnerType.VET}
        vet={{ licenseNumber: 'VET-001' }}
        onVetChange={noop}
      />,
    );
    expect(screen.getByTestId('vet-fields')).toBeDefined();
  });

  it('calls onVetChange when license input changes', () => {
    const onVetChange = vi.fn();
    render(
      <ExtensionFields
        type={BusinessPartnerType.VET}
        vet={{ licenseNumber: '' }}
        onVetChange={onVetChange}
      />,
    );
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'VET-999' } });
    expect(onVetChange).toHaveBeenCalledWith({ licenseNumber: 'VET-999' });
  });

  it('renders nothing for SUPPLIER type (supplier fields are now core BP fields)', () => {
    const { container } = render(
      <ExtensionFields
        type={BusinessPartnerType.SUPPLIER}
        vet={{ licenseNumber: '' }}
        onVetChange={noop}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
