import { z } from 'zod';
import { BusinessPartnerType, BpRole } from '@petiatrics/types';

// ── Sub-schemas ──────────────────────────────────────────────────────────────

const bpContactSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().nullable().optional(),
  email: z
    .union([z.string().email('Invalid email'), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  lineId: z.string().nullable().optional(),
  positionId: z.string().uuid('Must be a valid UUID').nullable().optional(),
  isPrimary: z.boolean().optional().default(false),
});

const vetSchema = z.object({
  licenseNumber: z.string().min(1, 'License number is required'),
});

// ── Base schema (shared between create and edit) ─────────────────────────────

const baseBpSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    taxId: z
      .union([z.string().regex(/^\d{13}$/, 'Tax ID must be 13 digits'), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' || v === undefined ? null : v)),
    isHeadOffice: z.boolean().optional().default(true),
    branchCode: z
      .union([z.string().regex(/^\d{5}$/, 'Branch code must be 5 digits'), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' || v === undefined ? null : v)),
    addressLine1: z.string().nullable().optional(),
    subDistrict: z.string().nullable().optional(),
    district: z.string().nullable().optional(),
    province: z.string().nullable().optional(),
    zipcode: z
      .union([z.string().regex(/^\d{5}$/, 'Zipcode must be 5 digits'), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' || v === undefined ? null : v)),
    defaultVatCodeId: z.string().nullable().optional(),
    defaultWhtCodeId: z.string().nullable().optional(),
    // Communication
    phone: z.string().nullable().optional(),
    email: z
      .union([z.string().email('Invalid email'), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' || v === undefined ? null : v)),
    lineId: z.string().nullable().optional(),
    // Commercial
    creditTermDays: z
      .number()
      .int('Must be a whole number')
      .min(0, 'Must be 0 or more')
      .optional(),
    creditLimit: z.number().min(0, 'Must be 0 or more').nullable().optional(),
    creditHold: z.boolean().optional().default(false),
    discountGroupId: z.string().nullable().optional(),
    // Bank
    bankAccountName: z.string().nullable().optional(),
    bankAccountBranch: z.string().nullable().optional(),
    bankAccountNumber: z.string().nullable().optional(),
    // LN roles
    activeRoles: z.array(z.nativeEnum(BpRole)).optional().default([]),
    // Contacts
    contacts: z
      .array(bpContactSchema)
      .optional()
      .default([])
      .refine(
        (arr) => arr.filter((c) => c.isPrimary).length <= 1,
        'At most one contact can be marked as primary',
      ),
    // VET extension
    vet: vetSchema.nullable().optional(),
  });

// ── Create schema (type required) ────────────────────────────────────────────

export const createBpSchema = baseBpSchema
  .and(
    z.object({
      type: z.nativeEnum(BusinessPartnerType, { error: 'Type is required' }),
    }),
  )
  .superRefine((data, ctx) => {
    // VET type requires licenseNumber
    if (data.type === BusinessPartnerType.VET) {
      if (!data.vet?.licenseNumber) {
        ctx.addIssue({
          code: 'custom',
          message: 'License number is required for VET type',
          path: ['vet', 'licenseNumber'],
        });
      }
    }
  });

// ── Edit schema (type absent — fixed at creation time) ───────────────────────

export const editBpSchema = baseBpSchema;

// ── Inferred types ───────────────────────────────────────────────────────────

export type CreateBpFormValues = z.infer<typeof createBpSchema>;
export type EditBpFormValues = z.infer<typeof editBpSchema>;
export type BpContactFormValue = z.infer<typeof bpContactSchema>;
