import { describe, it, expect } from 'vitest';
import { createBpSchema, editBpSchema } from './bp-form-schema';
import { BusinessPartnerType } from '@petiatrics/types';

describe('createBpSchema', () => {
  it('rejects when name is empty', () => {
    const result = createBpSchema.safeParse({ name: '', type: BusinessPartnerType.CUSTOMER });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === 'name')).toBe(true);
  });

  it('rejects when type is missing', () => {
    const result = createBpSchema.safeParse({ name: 'Test BP' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === 'type')).toBe(true);
  });

  it('rejects taxId that is not 13 digits', () => {
    const result = createBpSchema.safeParse({
      name: 'Test', type: BusinessPartnerType.CUSTOMER, taxId: '12345',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === 'taxId')).toBe(true);
  });

  it('accepts taxId that is exactly 13 digits', () => {
    const result = createBpSchema.safeParse({
      name: 'Test', type: BusinessPartnerType.CUSTOMER, taxId: '1234567890123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = createBpSchema.safeParse({
      name: 'Test', type: BusinessPartnerType.CUSTOMER, email: 'not-an-email',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === 'email')).toBe(true);
  });

  it('rejects negative creditLimit', () => {
    const result = createBpSchema.safeParse({
      name: 'Test', type: BusinessPartnerType.CUSTOMER, creditLimit: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects float creditTermDays', () => {
    const result = createBpSchema.safeParse({
      name: 'Test', type: BusinessPartnerType.CUSTOMER, creditTermDays: 1.5,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === 'creditTermDays')).toBe(true);
  });

  it('rejects two isPrimary contacts', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.CUSTOMER,
      contacts: [
        { name: 'Alice', isPrimary: true },
        { name: 'Bob', isPrimary: true },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts one isPrimary contact', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.VET,
      vet: { licenseNumber: 'VET-001' },
      contacts: [
        { name: 'Alice', isPrimary: true },
        { name: 'Bob', isPrimary: false },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('requires vet.licenseNumber when type is VET', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.VET,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('licenseNumber'))).toBe(true);
  });

  it('accepts VET with licenseNumber', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.VET,
      vet: { licenseNumber: 'VET-001' },
    });
    expect(result.success).toBe(true);
  });
});

describe('editBpSchema', () => {
  it('accepts payload without type field', () => {
    const result = editBpSchema.safeParse({ name: 'Test' });
    expect(result.success).toBe(true);
  });

  it('rejects name as empty string', () => {
    const result = editBpSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});
