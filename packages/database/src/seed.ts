/**
 * Petiatrics Seed Script
 * Run: npm run db:seed (from packages/database)
 * Requires: DATABASE_URL and MONGO_URI env variables
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PetProfileSchema } from '../mongo/pet-profile.schema';
import { VisitRecordSchema } from '../mongo/visit-record.schema';
import { VaccinationRecordSchema } from '../mongo/vaccination-record.schema';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [
    'VIEW_PATIENTS', 'EDIT_PATIENTS', 'MANAGE_VISITS', 'MANAGE_VACCINATIONS',
    'VIEW_INVENTORY', 'MANAGE_INVENTORY', 'VIEW_BILLING', 'MANAGE_BILLING', 'MANAGE_SETTINGS'
  ],
  CLINIC_OWNER: [
    'VIEW_PATIENTS', 'EDIT_PATIENTS', 'MANAGE_VISITS', 'MANAGE_VACCINATIONS',
    'VIEW_INVENTORY', 'MANAGE_INVENTORY', 'VIEW_BILLING', 'MANAGE_BILLING', 'MANAGE_SETTINGS'
  ],
  VET: [
    'VIEW_PATIENTS', 'EDIT_PATIENTS', 'MANAGE_VISITS', 'MANAGE_VACCINATIONS', 'VIEW_INVENTORY'
  ],
  ASSISTANT: [
    'VIEW_PATIENTS', 'VIEW_INVENTORY', 'VIEW_BILLING'
  ],
  STAFF: [
    'VIEW_PATIENTS', 'VIEW_INVENTORY', 'VIEW_BILLING'
  ],
  CASHIER: [
    'VIEW_PATIENTS', 'VIEW_INVENTORY', 'VIEW_BILLING', 'MANAGE_BILLING'
  ],
  CUSTOMER: []
};

dotenv.config({
  path: path.resolve(process.cwd(), '../../.env'),
});

const prisma = new PrismaClient();
let mongoose: any;
let PetProfile: any;
let VisitRecord: any;
let VaccinationRecord: any;

async function initMongoose() {
  const mongooseModule = await import('mongoose');
  mongoose = (mongooseModule as any).default ?? mongooseModule;

  PetProfile =
    mongoose.models['PetProfile'] ?? mongoose.model('PetProfile', PetProfileSchema);
  VisitRecord =
    mongoose.models['VisitRecord'] ?? mongoose.model('VisitRecord', VisitRecordSchema);
  VaccinationRecord =
    mongoose.models['VaccinationRecord'] ??
    mongoose.model('VaccinationRecord', VaccinationRecordSchema);
}

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

async function main() {
  await initMongoose();
  const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/petiatrics';
  await mongoose.connect(MONGO_URI);
  console.log('✓ MongoDB connected');

  // ── 0. TaxCode — global RD-compliant reference data ───────────────────────
  //
  // TaxCode is NOT tenant-owned. It is seeded once and shared across all
  // clinics. All upserts are keyed on the unique `code` field so re-runs
  // are idempotent and do not duplicate rows.
  //
  // VAT codes: isVatType = true, type = "VAT"
  // WHT codes: isVatType = false, type = "WHT"
  // Zero-rated: isZeroRated = true (0% VAT for exports/exempt supplies)
  const taxCodes = [
    // ── VAT (Valued Added Tax) ────────────────────────────────────────────
    {
      code: 'VAT7',
      description: 'Standard VAT 7%',
      rate: 7.0,
      isVatType: true,
      isZeroRated: false,
      type: 'VAT',
    },
    {
      code: 'VAT0',
      description: 'Zero-rated VAT (exports / exempt supplies)',
      rate: 0.0,
      isVatType: true,
      isZeroRated: true,
      type: 'VAT',
    },
    // ── WHT (Withholding Tax — Section 3 Ter, RD) ─────────────────────────
    {
      code: 'WHT1',
      description: 'Withholding Tax 1% (transport, delivery)',
      rate: 1.0,
      isVatType: false,
      isZeroRated: false,
      type: 'WHT',
    },
    {
      code: 'WHT3',
      description: 'Withholding Tax 3% (services, consulting)',
      rate: 3.0,
      isVatType: false,
      isZeroRated: false,
      type: 'WHT',
    },
    {
      code: 'WHT5',
      description: 'Withholding Tax 5% (rent, professional fees)',
      rate: 5.0,
      isVatType: false,
      isZeroRated: false,
      type: 'WHT',
    },
    {
      code: 'WHT15',
      description: 'Withholding Tax 15% (interest, dividends)',
      rate: 15.0,
      isVatType: false,
      isZeroRated: false,
      type: 'WHT',
    },
  ];

  for (const tc of taxCodes) {
    await prisma.taxCode.upsert({
      where: { code: tc.code },
      update: {
        description: tc.description,
        rate: tc.rate,
        isVatType: tc.isVatType,
        isZeroRated: tc.isZeroRated,
        type: tc.type,
        isActive: true,
      },
      create: {
        code: tc.code,
        description: tc.description,
        rate: tc.rate,
        isVatType: tc.isVatType,
        isZeroRated: tc.isZeroRated,
        type: tc.type,
        isActive: true,
      },
    });
    console.log(`✓ TaxCode: ${tc.code} (${tc.description})`);
  }

  // ── 1b. GLAccount — global chart of accounts (006-item-master ERP) ─────────
  const glAccounts = [
    // Revenue accounts
    { code: '4000', name: 'Medicine Revenue',      type: 'REVENUE' as const },
    { code: '4001', name: 'Retail Revenue',         type: 'REVENUE' as const },
    { code: '4002', name: 'Service Revenue',         type: 'REVENUE' as const },
    { code: '4003', name: 'Laboratory Revenue',      type: 'REVENUE' as const },
    { code: '4004', name: 'Procedure Revenue',       type: 'REVENUE' as const },
    { code: '4005', name: 'Consultation Revenue',    type: 'REVENUE' as const },
    // COGS accounts
    { code: '5000', name: 'Medicine COGS',           type: 'COGS' as const },
    { code: '5001', name: 'Retail COGS',             type: 'COGS' as const },
    // Asset accounts
    { code: '1100', name: 'Inventory Asset',         type: 'ASSET' as const },
    // Expense accounts
    { code: '6000', name: 'General Operating Expense', type: 'EXPENSE' as const },
  ];

  const glIds: Record<string, string> = {};
  for (const gl of glAccounts) {
    const record = await prisma.gLAccount.upsert({
      where: { code: gl.code },
      update: { name: gl.name, type: gl.type, isActive: true },
      create: { code: gl.code, name: gl.name, type: gl.type, isActive: true },
    });
    glIds[gl.code] = record.id;
    console.log(`✓ GLAccount: ${gl.code} (${gl.name})`);
  }

  // ── 1c. ItemCategory — global reference, no clinicId (006-item-master) ──
  const itemCategories = [
    { code: 'MEDICINE',     name: 'Medicine',      revenueGlCode: '4000', expenseGlCode: '5000' },
    { code: 'RETAIL',       name: 'Retail',         revenueGlCode: '4001', expenseGlCode: '5001' },
    { code: 'SERVICE',      name: 'Service',         revenueGlCode: '4002', expenseGlCode: null },
    { code: 'LABORATORY',   name: 'Laboratory',      revenueGlCode: '4003', expenseGlCode: null },
    { code: 'PROCEDURE',    name: 'Procedure',       revenueGlCode: '4004', expenseGlCode: null },
    { code: 'CONSULTATION', name: 'Consultation',    revenueGlCode: '4005', expenseGlCode: null },
  ];

  const categoryIds: Record<string, string> = {};
  for (const cat of itemCategories) {
    const record = await prisma.itemCategory.upsert({
      where: { code: cat.code },
      update: {
        name: cat.name,
        isActive: true,
        revenueGlAccountId: cat.revenueGlCode ? glIds[cat.revenueGlCode] : null,
        expenseGlAccountId: cat.expenseGlCode ? glIds[cat.expenseGlCode] : null,
      },
      create: {
        code: cat.code,
        name: cat.name,
        isActive: true,
        revenueGlAccountId: cat.revenueGlCode ? glIds[cat.revenueGlCode] : null,
        expenseGlAccountId: cat.expenseGlCode ? glIds[cat.expenseGlCode] : null,
      },
    });
    categoryIds[cat.code] = record.id;
    console.log(`✓ ItemCategory: ${cat.code} → ${record.id}`);
  }

  // ── 1c. UnitOfMeasure — global reference, no clinicId (006-item-master) ──
  const unitsOfMeasure = [
    { name: 'Piece',   symbol: 'pc' },
    { name: 'Box',     symbol: 'bx' },
    { name: 'Bottle',  symbol: 'btl' },
    { name: 'Vial',    symbol: 'vl' },
    { name: 'Visit',   symbol: 'visit' },
    { name: 'Session', symbol: 'sess' },
  ];

  const unitIds: Record<string, string> = {};
  for (const uom of unitsOfMeasure) {
    const record = await prisma.unitOfMeasure.upsert({
      where: { name: uom.name },
      update: { symbol: uom.symbol, isActive: true },
      create: { name: uom.name, symbol: uom.symbol, isActive: true },
    });
    unitIds[uom.name] = record.id;
    console.log(`✓ UnitOfMeasure: ${uom.name} → ${record.id}`);
  }

  // ── 1. Super Admin (no clinicId) ──────────────────────────────────────────
  const platformAdmin = await prisma.user.upsert({
    where: { email: 'admin@petiatrics.io' },
    update: {},
    create: {
      email: 'admin@petiatrics.io',
      name: 'Platform Admin',
      passwordHash: await hashPassword('Admin@1234'),
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('✓ Super admin:', platformAdmin.email);

  // ── 2. Demo Clinic ────────────────────────────────────────────────────────
  const clinic = await prisma.clinic.upsert({
    where: { taxId: '0105567890123' },
    update: {},
    create: {
      name: 'Happy Paws Veterinary Clinic',
      taxId: '0105567890123',
      slug: 'happy-paws',
      address: { street: '123 Sukhumvit Rd', city: 'Bangkok', postalCode: '10110' },
      subscriptionTier: 'STANDARD',
      status: 'ACTIVE',
      settings: {
        max_login_attempts: 5,
        lockout_duration_minutes: 15,
        password_min_length: 8,
        password_require_uppercase: true,
        password_require_number: true,
      },
    },
  });
  console.log('✓ Clinic:', clinic.name, '(', clinic.id, ')');

  // ── 3. Branches ──────────────────────────────────────────────────────────
  const branchMain = await prisma.branch.upsert({
    where: { id: 'branch-happypaws-main-00000001' },
    update: {},
    create: {
      id: 'branch-happypaws-main-00000001',
      clinicId: clinic.id,
      name: 'Main Branch',
    },
  });
  const branchNorth = await prisma.branch.upsert({
    where: { id: 'branch-happypaws-north-0000001' },
    update: {},
    create: {
      id: 'branch-happypaws-north-0000001',
      clinicId: clinic.id,
      name: 'North Branch',
    },
  });
  console.log('✓ Branch:', branchMain.name, '(', branchMain.id, ')');
  console.log('✓ Branch:', branchNorth.name, '(', branchNorth.id, ')');

  // ── 4. Staff Users ────────────────────────────────────────────────────────
  const staffSeed = [
    { email: 'owner@happypaws.io', name: 'Happy Paws Owner', username: 'owner@happy-paws', role: 'CLINIC_OWNER' as const },
    { email: 'vet@happypaws.io', name: 'Dr. Veterinarian', username: 'vet@happy-paws', role: 'VET' as const },
    { email: 'assistant@happypaws.io', name: 'Clinic Assistant', username: 'assistant@happy-paws', role: 'ASSISTANT' as const },
    { email: 'cashier@happypaws.io', name: 'Clinic Cashier', username: 'cashier@happy-paws', role: 'CASHIER' as const },
    { email: 'staff@happypaws.io', name: 'Clinic Staff', username: 'staff@happy-paws', role: 'STAFF' as const },
  ];

  const staffUsers: Record<string, string> = {};
  for (const s of staffSeed) {
    const u = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        name: s.name,
        username: s.username,
        passwordHash: await hashPassword('Password@1'),
        role: s.role,
        status: 'ACTIVE',
        clinicId: clinic.id,
      },
    });
    staffUsers[s.role] = u.id;
    console.log('✓ User:', s.email, '→', s.role);
  }

  // ── 5. UserBranch assignments ─────────────────────────────────────────────
  // CLINIC_OWNER and VET get both branches (multi-branch users)
  // ASSISTANT, CASHIER, STAFF get main branch only (single-branch users)
  const multiBranchRoles = ['CLINIC_OWNER', 'VET'] as const;
  const singleBranchRoles = ['ASSISTANT', 'CASHIER', 'STAFF'] as const;

  for (const role of multiBranchRoles) {
    const uid = staffUsers[role];
    if (!uid) continue;
    await prisma.userBranch.upsert({
      where: { userId_branchId: { userId: uid, branchId: branchMain.id } },
      update: {},
      create: { userId: uid, branchId: branchMain.id },
    });
    await prisma.userBranch.upsert({
      where: { userId_branchId: { userId: uid, branchId: branchNorth.id } },
      update: {},
      create: { userId: uid, branchId: branchNorth.id },
    });
    console.log('✓ UserBranch:', role, '→ both branches');
  }

  for (const role of singleBranchRoles) {
    const uid = staffUsers[role];
    if (!uid) continue;
    await prisma.userBranch.upsert({
      where: { userId_branchId: { userId: uid, branchId: branchMain.id } },
      update: {},
      create: { userId: uid, branchId: branchMain.id },
    });
    console.log('✓ UserBranch:', role, '→ main branch only');
  }

  // Seed BpGroup for Customer seq numbering
  const customerBpGroup = await prisma.bpGroup.upsert({
    where: { clinicId_prefix: { clinicId: clinic.id, prefix: 'C-' } },
    update: {},
    create: {
      clinicId: clinic.id,
      name: 'Customers',
      prefix: 'C-',
      currentSequence: 1,
    },
  });

  // Seed Customer User
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@happypaws.io' },
    update: {},
    create: {
      email: 'customer@happypaws.io',
      name: 'Happy Paws Customer',
      username: 'customer@happy-paws',
      passwordHash: await hashPassword('Password@1'),
      role: 'CUSTOMER',
      status: 'ACTIVE',
      clinicId: clinic.id,
    },
  });
  console.log('✓ User:', customerUser.email, '→ CUSTOMER');

  // Seed Customer BusinessPartner
  const customerBp = await prisma.businessPartner.upsert({
    where: { clinicId_linkedUserId: { clinicId: clinic.id, linkedUserId: customerUser.id } },
    update: {},
    create: {
      clinicId: clinic.id,
      type: 'CUSTOMER',
      name: customerUser.name,
      email: customerUser.email,
      code: 'C-0001',
      groupId: customerBpGroup.id,
      linkedUserId: customerUser.id,
      isActive: true,
    },
  });
  console.log('✓ BusinessPartner linked for Customer:', customerBp.code);

  const ownerUser = customerUser;

  // ── 4. Pet Profiles (MongoDB) ─────────────────────────────────────────────
  const existingPets = await PetProfile.find({ clinicId: clinic.id }).lean();
  let petIds: string[] = existingPets.map((p: any) => p._id.toString());

  if (existingPets.length === 0 && ownerUser) {
    const petSeed = [
      { name: 'Mochi', species: 'dog', breed: 'Shih Tzu', dateOfBirth: new Date('2020-03-15'), weightKg: 5.2 },
      { name: 'Luna', species: 'cat', breed: 'Domestic Shorthair', dateOfBirth: new Date('2019-07-22'), weightKg: 3.8 },
    ];
    for (const p of petSeed) {
      const pet = await PetProfile.create({
        clinicId: clinic.id,
        ownerUserId: ownerUser.id,
        ...p,
      });
      petIds.push(pet._id.toString());
      console.log('✓ Pet profile:', p.name);
    }
  }

  // ── 5. Visit Records (MongoDB) ────────────────────────────────────────────
  const vetId = staffUsers['VET'];
  if (petIds.length > 0 && vetId && ownerUser) {
    const existingVisits = await VisitRecord.find({ clinicId: clinic.id }).lean();
    if (existingVisits.length === 0) {
      const visitData = [
        {
          clinicId: clinic.id,
          branchId: branchMain.id,
          patientId: petIds[0],
          ownerUserId: ownerUser.id,
          vetId,
          visitDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          soap: {
            subjective: 'Owner reports lethargy and reduced appetite for 2 days.',
            objective: 'Temperature 38.9°C, heart rate 110 bpm. Mild dehydration noted.',
            assessment: 'Mild gastroenteritis. No systemic involvement.',
            plan: 'Supportive care. Bland diet x5 days. Recheck if not improving.',
          },
          prescriptions: [
            {
              drug: 'Metronidazole 125mg',
              dosage: '1 tablet',
              frequency: 'Twice daily',
              duration: '5 days',
              productId: null,
              inventoryLinked: false,
            },
          ],
          attachments: [],
          status: 'finalized',
          finalizedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        },
        {
          clinicId: clinic.id,
          branchId: branchMain.id,
          patientId: petIds.length > 1 ? petIds[1] : petIds[0],
          ownerUserId: ownerUser.id,
          vetId,
          visitDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          soap: {
            subjective: 'Annual wellness check.',
            objective: 'BCS 5/9. Teeth tartar grade 1. All lymph nodes normal.',
            assessment: 'Healthy adult cat. Dental prophylaxis recommended.',
            plan: 'Rabies booster administered. Schedule dental cleaning in 3 months.',
          },
          prescriptions: [],
          attachments: [],
          status: 'finalized',
          finalizedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
        },
      ];
      for (const v of visitData) {
        await VisitRecord.create(v);
        console.log('✓ Visit record created');
      }
    }
  }

  // ── 6. Vaccination Records (MongoDB) ─────────────────────────────────────
  if (petIds.length > 0 && vetId) {
    const existingVax = await VaccinationRecord.find({ clinicId: clinic.id }).lean();
    if (existingVax.length === 0) {
      const vaccinations = [
        {
          clinicId: clinic.id,
          patientId: petIds[0],
          vetId,
          vaccineName: 'Rabies',
          administeredAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          nextDueAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          batchNumber: 'RBV-2024-001',
        },
        {
          clinicId: clinic.id,
          patientId: petIds[0],
          vetId,
          vaccineName: 'DHPPiL',
          administeredAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
          nextDueAt: new Date(Date.now() + 185 * 24 * 60 * 60 * 1000),
          batchNumber: 'DHV-2024-032',
        },
      ];
      for (const v of vaccinations) {
        await VaccinationRecord.create(v);
        console.log('✓ Vaccination record:', v.vaccineName);
      }
    }
  }

  // ── 7. Inventory Products (006-item-master expanded schema) ─────────────
  const productSeed = [
    { code: 'MED-001', name: 'Metronidazole 125mg (50 tabs)', itemType: 'STOCKED_GOOD' as const, categoryKey: 'MEDICINE',    unitName: 'Box',   stdCost: 120, sellPrice: 180, quantity: 15, reorderThreshold: 5 },
    { code: 'MED-002', name: 'Amoxicillin 250mg (30 caps)',   itemType: 'STOCKED_GOOD' as const, categoryKey: 'MEDICINE',    unitName: 'Box',   stdCost: 95,  sellPrice: 150, quantity: 3,  reorderThreshold: 5 },
    { code: 'VAX-001', name: 'Rabies Vaccine',                itemType: 'STOCKED_GOOD' as const, categoryKey: 'MEDICINE',    unitName: 'Vial',  stdCost: 200, sellPrice: 350, quantity: 20, reorderThreshold: 8 },
    { code: 'VAX-002', name: 'DHPPiL Combo Vaccine',          itemType: 'STOCKED_GOOD' as const, categoryKey: 'MEDICINE',    unitName: 'Vial',  stdCost: 180, sellPrice: 320, quantity: 2,  reorderThreshold: 5 },
    { code: 'SUP-001', name: 'Surgical Gloves (100 pcs)',     itemType: 'STOCKED_GOOD' as const, categoryKey: 'RETAIL',      unitName: 'Box',   stdCost: 80,  sellPrice: 120, quantity: 12, reorderThreshold: 3 },
    { code: 'SVC-001', name: 'Standard Consultation',         itemType: 'SERVICE'       as const, categoryKey: 'CONSULTATION', unitName: 'Visit', stdCost: 0,   sellPrice: 500, quantity: 0,  reorderThreshold: 0 },
  ];

  const productIds: string[] = [];
  for (const p of productSeed) {
    const product = await prisma.product.upsert({
      where: { clinicId_code: { clinicId: clinic.id, code: p.code } },
      update: {},
      create: {
        clinicId: clinic.id,
        code: p.code,
        name: p.name,
        itemType: p.itemType,
        categoryId: categoryIds[p.categoryKey],
        baseUnitId: unitIds[p.unitName],
        standardCost: p.stdCost,
        baseSellingPrice: p.sellPrice,
        quantity: p.quantity,
        reorderPoint: p.reorderThreshold,
      },
    });
    productIds.push(product.id);
    console.log('✓ Product:', p.name);
  }

  // ── 8. Sample Invoices ────────────────────────────────────────────────────
  if (ownerUser) {
    const existingInvoices = await prisma.invoice.findMany({ where: { clinicId: clinic.id } });
    if (existingInvoices.length === 0) {
      const subtotal = 80000; // 800 THB
      const taxRateBps = 700;
      const taxTotal = Math.round(subtotal * taxRateBps / 10_000);
      const total = subtotal + taxTotal;

      const invoice = await prisma.invoice.create({
        data: {
          clinicId: clinic.id,
          visitId: 'seed-visit-001',
          patientId: petIds[0] ?? 'seed-patient-001',
          ownerUserId: ownerUser.id,
          subtotalMinor: subtotal,
          taxRateBps,
          taxTotalMinor: taxTotal,
          totalMinor: total,
          status: 'PAID',
          issuedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          lineItems: {
            create: [
              {
                itemType: 'SERVICE',
                description: 'Consultation Fee',
                quantity: 1,
                unitPriceMinor: 50000,
                subtotalMinor: 50000,
              },
              {
                itemType: 'PRODUCT',
                description: 'Metronidazole 125mg (50 tabs)',
                quantity: 1,
                unitPriceMinor: 30000,
                subtotalMinor: 30000,
                sourceReferenceId: productIds[0],
              },
            ],
          },
        },
      });
      console.log('✓ Invoice:', invoice.id, '→ PAID ฿', (total / 100).toFixed(2));

      // Draft invoice
      await prisma.invoice.create({
        data: {
          clinicId: clinic.id,
          visitId: 'seed-visit-002',
          patientId: petIds.length > 1 ? petIds[1] : (petIds[0] ?? 'seed-patient-001'),
          ownerUserId: ownerUser.id,
          subtotalMinor: 120000,
          taxRateBps,
          taxTotalMinor: Math.round(120000 * taxRateBps / 10_000),
          totalMinor: 120000 + Math.round(120000 * taxRateBps / 10_000),
          status: 'DRAFT',
          lineItems: {
            create: [
              {
                itemType: 'SERVICE',
                description: 'Annual Wellness Examination',
                quantity: 1,
                unitPriceMinor: 80000,
                subtotalMinor: 80000,
              },
              {
                itemType: 'PRODUCT',
                description: 'Rabies Vaccine',
                quantity: 1,
                unitPriceMinor: 40000,
                subtotalMinor: 40000,
                sourceReferenceId: productIds[2],
              },
            ],
          },
        },
      });
      console.log('✓ Invoice: DRAFT created');
    }
  }

  // ── 9. Sample Appointments ────────────────────────────────────────────────
  if (ownerUser && petIds.length > 0) {
    const existingAppts = await prisma.appointment.findMany({ where: { clinicId: clinic.id } });
    if (existingAppts.length === 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      await prisma.appointment.create({
        data: {
          clinicId: clinic.id,
          patientId: petIds[0],
          ownerUserId: ownerUser.id,
          vetUserId: vetId,
          scheduledAt: tomorrow,
          durationMinutes: 30,
          reason: 'Follow-up check after gastroenteritis treatment',
          status: 'CONFIRMED',
        },
      });
      console.log('✓ Appointment: CONFIRMED for tomorrow');
    }
  }

  // ── 10. PENDING Clinic (for approve/reject testing) ───────────────────────
  const pendingClinic = await prisma.clinic.upsert({
    where: { taxId: '0105000000001' },
    update: {},
    create: {
      name: 'New Paws Clinic',
      taxId: '0105000000001',
      slug: 'new-paws',
      address: { street: '456 Rama IV Rd', city: 'Bangkok', postalCode: '10200' },
      subscriptionTier: 'FREE',
      status: 'PENDING',
      settings: {
        max_login_attempts: 5,
        lockout_duration_minutes: 15,
        password_min_length: 8,
        password_require_uppercase: true,
        password_require_number: true,
      },
    },
  });
  await prisma.user.upsert({
    where: { email: 'owner@newpaws.io' },
    update: {},
    create: {
      email: 'owner@newpaws.io',
      name: 'New Paws Owner',
      passwordHash: await hashPassword('Password@1'),
      role: 'CLINIC_OWNER',
      status: 'PENDING',
      clinicId: pendingClinic.id,
    },
  });
  console.log('✓ Pending clinic:', pendingClinic.name, '(', pendingClinic.id, ')');

  console.log('\n🎉 Seed complete!\n');
  console.log('Login credentials (002 roles):');
  console.log('  Super Admin (SUPER_ADMIN):    admin@petiatrics.io / Admin@1234  → /admin');
  console.log('  Clinic Owner (CLINIC_OWNER):  owner@happypaws.io / Password@1   → /clinic [2 branches]');
  console.log('  Vet (VET):                    vet@happypaws.io / Password@1      → /clinic [2 branches]');
  console.log('  Assistant (ASSISTANT):        assistant@happypaws.io / Password@1 → /clinic [1 branch]');
  console.log('  Cashier (CASHIER):            cashier@happypaws.io / Password@1  → /clinic [1 branch]');
  console.log('  Staff (STAFF):                staff@happypaws.io / Password@1    → /clinic [1 branch]');
  console.log('  Customer (CUSTOMER):          customer@happypaws.io / Password@1 → /owner-portal');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
