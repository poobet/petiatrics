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

// ─── Free-form position ──────────────────────────────────────────────────────

describe('bpContactSchema — free-form position', () => {
  it('accepts a free-form string position', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.CUSTOMER,
      contacts: [{ name: 'Alice', position: 'Purchasing Manager', isPrimary: false }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contacts?.[0]?.position).toBe('Purchasing Manager');
    }
  });

  it('accepts null position', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.CUSTOMER,
      contacts: [{ name: 'Alice', position: null, isPrimary: false }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts omitted position', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.CUSTOMER,
      contacts: [{ name: 'Alice', isPrimary: false }],
    });
    expect(result.success).toBe(true);
  });
});

// ─── vetSchema specialty and defaultDfRate ───────────────────────────────────

describe('vetSchema — specialty and defaultDfRate', () => {
  const baseVet = { name: 'Test', type: BusinessPartnerType.VET, vet: { licenseNumber: 'V-001' } };

  it('accepts specialty string', () => {
    const result = createBpSchema.safeParse({ ...baseVet, vet: { licenseNumber: 'V-001', specialty: 'Cardiology' } });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.vet?.specialty).toBe('Cardiology');
  });

  it('accepts defaultDfRate = 0', () => {
    const result = createBpSchema.safeParse({ ...baseVet, vet: { licenseNumber: 'V-001', defaultDfRate: 0 } });
    expect(result.success).toBe(true);
  });

  it('accepts defaultDfRate = 100', () => {
    const result = createBpSchema.safeParse({ ...baseVet, vet: { licenseNumber: 'V-001', defaultDfRate: 100 } });
    expect(result.success).toBe(true);
  });

  it('rejects defaultDfRate < 0', () => {
    const result = createBpSchema.safeParse({ ...baseVet, vet: { licenseNumber: 'V-001', defaultDfRate: -1 } });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('defaultDfRate'))).toBe(true);
  });

  it('rejects defaultDfRate > 100', () => {
    const result = createBpSchema.safeParse({ ...baseVet, vet: { licenseNumber: 'V-001', defaultDfRate: 101 } });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('defaultDfRate'))).toBe(true);
  });
});

// ─── baseBpSchema CRM fields ─────────────────────────────────────────────────

describe('baseBpSchema — CRM fields', () => {
  it('accepts isMarketingOptIn boolean', () => {
    const result = createBpSchema.safeParse({
      name: 'Test', type: BusinessPartnerType.CUSTOMER, isMarketingOptIn: true,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isMarketingOptIn).toBe(true);
  });

  it('defaults isMarketingOptIn to false', () => {
    const result = createBpSchema.safeParse({ name: 'Test', type: BusinessPartnerType.CUSTOMER });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isMarketingOptIn).toBe(false);
  });

  it('accepts internalNotes string', () => {
    const result = createBpSchema.safeParse({
      name: 'Test', type: BusinessPartnerType.CUSTOMER, internalNotes: 'VIP — handle carefully',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.internalNotes).toBe('VIP — handle carefully');
  });

  it('accepts alertMessage string', () => {
    const result = createBpSchema.safeParse({
      name: 'Test', type: BusinessPartnerType.CUSTOMER, alertMessage: 'BLACKLISTED',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.alertMessage).toBe('BLACKLISTED');
  });

  it('accepts groupId as UUID', () => {
    const result = createBpSchema.safeParse({
      name: 'Test', type: BusinessPartnerType.CUSTOMER,
      groupId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.groupId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('rejects groupId that is not a UUID', () => {
    const result = createBpSchema.safeParse({
      name: 'Test', type: BusinessPartnerType.CUSTOMER, groupId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === 'groupId')).toBe(true);
  });
});
