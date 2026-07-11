import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BusinessPartnerType } from '@petiatrics/types';
import ExtensionFields from './extension-fields';
import { useForm, FormProvider } from 'react-hook-form';

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

const TestWrapper = ({ type, defaultValues }: { type: any, defaultValues?: any }) => {
  const methods = useForm({
    defaultValues: defaultValues || {
      vet: { licenseNumber: 'VET-001', specialty: '', defaultDfRate: undefined }
    }
  });
  return (
    <FormProvider {...methods}>
      <ExtensionFields type={type} />
    </FormProvider>
  );
};

describe('ExtensionFields', () => {
  it('renders nothing for non-VET types', () => {
    const { container } = render(
      <TestWrapper type={BusinessPartnerType.CUSTOMER} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders vet fields when type is VET', () => {
    render(
      <TestWrapper type={BusinessPartnerType.VET} />
    );
    expect(screen.getByTestId('vet-fields')).toBeInTheDocument();
  });

  it('renders license number input and allows typing', () => {
    render(
      <TestWrapper type={BusinessPartnerType.VET} />
    );
    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveValue('VET-001');
    fireEvent.change(inputs[0], { target: { value: 'VET-999' } });
    expect(inputs[0]).toHaveValue('VET-999');
  });

  it('renders nothing for SUPPLIER type (supplier fields are now core BP fields)', () => {
    const { container } = render(
      <TestWrapper type={BusinessPartnerType.SUPPLIER} />
    );
    expect(container.firstChild).toBeNull();
  });
});
