# Client Management & Contextual Pet Addition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Client Management module in the Clinic Portal, integrating user/customer creation with automatic business partner generation, a client profile dashboard, and contextual pre-filled patient creation.

**Architecture:** Extend the NestJS backend with a new `ClientsController` and user service methods to query/register customer users. Build Next.js frontend routes under `/clinic/clients` and `/clinic/patients/new` that integrate these endpoints with clean, responsive tabular and form layouts.

**Tech Stack:** NestJS, Prisma (PostgreSQL), Mongoose (MongoDB), Next.js 15, Tailwind CSS, Radix UI (Combobox, Select, Dialog).

---

### Task 1: Extend UserService with Client Methods & DTOs

**Files:**
- Create: [create-client.dto.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/identity/dto/create-client.dto.ts)
- Modify: [user.service.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/identity/services/user.service.ts)
- Modify: [user.service.spec.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/identity/services/user.service.spec.ts)

- [ ] **Step 1: Create the CreateClientDto file**
  Create `apps/api/src/modules/identity/dto/create-client.dto.ts` with validation constraints:
  ```typescript
  import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

  export class CreateClientDto {
    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsOptional()
    taxId?: string;

    @IsString()
    @IsOptional()
    addressLine1?: string;

    @IsString()
    @IsOptional()
    subDistrict?: string;

    @IsString()
    @IsOptional()
    district?: string;

    @IsString()
    @IsOptional()
    province?: string;

    @IsString()
    @IsOptional()
    zipcode?: string;

    @IsString()
    @IsOptional()
    lineId?: string;
  }
  ```

- [ ] **Step 2: Add find methods and createClient method to user.service.ts**
  Add the following methods to `UserService` in `apps/api/src/modules/identity/services/user.service.ts`:
  ```typescript
  // Imports at the top:
  import { CreateClientDto } from '../dto/create-client.dto';
  import { v4 as uuidv4 } from 'uuid';

  // Inside UserService class:
  async findClientsByClinic(clinicId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        clinicId,
        role: Role.CUSTOMER as any,
      },
      include: {
        businessPartners: {
          where: { clinicId },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as any;
  }

  async findClientById(clinicId: string, id: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        clinicId,
        role: Role.CUSTOMER as any,
      },
      include: {
        businessPartners: {
          where: { clinicId },
        },
      },
    });
    if (!user) throw new NotFoundException(`Client ${id} not found in this clinic.`);
    return user as any;
  }

  async createClient(clinicId: string, dto: CreateClientDto): Promise<User> {
    let emailNorm: string | null = null;
    if (dto.email) {
      emailNorm = dto.email.toLowerCase().trim();
      const existingUser = await this.prisma.user.findFirst({ where: { email: emailNorm } });
      if (existingUser) {
        throw new ConflictException(`An account with email ${dto.email} already exists.`);
      }
    }

    const temporaryPassword = uuidv4().slice(0, 12) + 'A1!';
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    return this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: emailNorm,
          name: dto.name,
          passwordHash,
          role: Role.CUSTOMER as any,
          clinicId: clinicId,
          status: UserStatus.ACTIVE as any,
        },
      });

      const bp = await this.createCustomerBpWithCode(tx, u.id, clinicId, dto.name, emailNorm);

      await tx.businessPartner.update({
        where: { id: bp.id },
        data: {
          phone: dto.phone ?? null,
          taxId: dto.taxId ?? null,
          addressLine1: dto.addressLine1 ?? null,
          subDistrict: dto.subDistrict ?? null,
          district: dto.district ?? null,
          province: dto.province ?? null,
          zipcode: dto.zipcode ?? null,
          lineId: dto.lineId ?? null,
        },
      });

      return tx.user.findUnique({
        where: { id: u.id },
        include: {
          businessPartners: {
            where: { clinicId },
          },
        },
      });
    }) as any;
  }
  ```

- [ ] **Step 3: Add unit tests to user.service.spec.ts**
  Add test suite for `createClient` and fetching client methods inside `describe('UserService')`:
  ```typescript
  describe('createClient & findClients', () => {
    it('creates client with linked business partner details successfully', async () => {
      const clientDto = {
        name: 'Mochi Customer',
        email: 'mochi@example.com',
        phone: '0812345678',
      };
      
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-created-id',
        name: clientDto.name,
        email: clientDto.email,
        businessPartners: [{ id: 'bp-created-id', code: 'C-0001' }]
      });

      const result = await service.createClient('clinic-1', clientDto);
      expect(result.id).toBe('user-created-id');
      expect(txMock.user.create).toHaveBeenCalled();
      expect(txMock.businessPartner.create).toHaveBeenCalled();
      expect(txMock.businessPartner.update).toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 4: Run tests and verify they pass**
  Run: `npm run test -- src/modules/identity/services/user.service.spec.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run: `git add apps/api/src/modules/identity/dto/create-client.dto.ts apps/api/src/modules/identity/services/user.service.ts apps/api/src/modules/identity/services/user.service.spec.ts; git commit -m "feat(identity): add client creation and listing service methods"`

---

### Task 2: Create ClientsController in NestJS API

**Files:**
- Create: [clients.controller.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/identity/controllers/clients.controller.ts)
- Modify: [identity.module.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/identity/identity.module.ts)

- [ ] **Step 1: Create clients.controller.ts**
  Create `apps/api/src/modules/identity/controllers/clients.controller.ts`:
  ```typescript
  import { Body, Controller, Get, Param, Post } from '@nestjs/common';
  import { UserService } from '../services/user.service';
  import { CreateClientDto } from '../dto/create-client.dto';
  import { Permissions } from '../../../common/decorators/permissions.decorator';
  import { TenantId } from '../../../common/decorators/tenant.decorator';
  import { Audit } from '../../../common/interceptors/audit.interceptor';

  @Controller('clinic/clients')
  export class ClientsController {
    constructor(private readonly users: UserService) {}

    @Get()
    @Permissions('PATIENT:VIEW')
    list(@TenantId() clinicId: string) {
      return this.users.findClientsByClinic(clinicId);
    }

    @Get(':id')
    @Permissions('PATIENT:VIEW')
    getById(@Param('id') id: string, @TenantId() clinicId: string) {
      return this.users.findClientById(clinicId, id);
    }

    @Post()
    @Permissions('PATIENT:EDIT')
    @Audit({ entity: 'users', operation: 'create' })
    create(@TenantId() clinicId: string, @Body() dto: CreateClientDto) {
      return this.users.createClient(clinicId, dto);
    }
  }
  ```

- [ ] **Step 2: Register ClientsController in identity.module.ts**
  Import and add `ClientsController` to the controllers array in `apps/api/src/modules/identity/identity.module.ts`:
  ```typescript
  // Import:
  import { ClientsController } from './controllers/clients.controller';

  // Inside Module controllers:
  controllers: [AuthController, AdminController, StaffController, ClientsController, BusinessPartnersController, ReferenceController],
  ```

- [ ] **Step 3: Run backend build to verify compile**
  Run: `npm run build` in `apps/api`
  Expected: PASS

- [ ] **Step 4: Commit**
  Run: `git add apps/api/src/modules/identity/controllers/clients.controller.ts apps/api/src/modules/identity/identity.module.ts; git commit -m "feat(api): add ClientsController for clinic portal client operations"`

---

### Task 3: Update PatientController to support ownerUserId filtering

**Files:**
- Modify: [patient.controller.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/clinical/controllers/patient.controller.ts)

- [ ] **Step 1: Modify findAll route in patient.controller.ts**
  Modify `findAll` method in `apps/api/src/modules/clinical/controllers/patient.controller.ts` to query and pass `ownerUserId`:
  ```typescript
  // Target:
  @Get()
  @Permissions('PATIENT:VIEW')
  findAll(
    @TenantId() clinicId: string,
    @Query('search') search?: string,
    @Query('ownerUserId') ownerUserId?: string,
  ) {
    return this.patientService.findAll(clinicId, search, ownerUserId);
  }
  ```

- [ ] **Step 2: Run all backend tests**
  Run: `npm run test` in `apps/api`
  Expected: 14 test suites pass

- [ ] **Step 3: Commit**
  Run: `git add apps/api/src/modules/clinical/controllers/patient.controller.ts; git commit -m "feat(clinical): support ownerUserId filter query param in GET /patients"`

---

### Task 4: Build Client Directory Frontend Page

**Files:**
- Create: [page.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(clinic)/clinic/clients/page.tsx)
- Create: [clients-client.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(clinic)/clinic/clients/clients-client.tsx)

- [ ] **Step 1: Create layout page.tsx for `/clinic/clients`**
  Create `apps/web/app/(clinic)/clinic/clients/page.tsx`:
  ```typescript
  import { Suspense } from 'react';
  import ClientsClient from './clients-client';

  export default function ClientsPage() {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage pet owners, B2C business partners, and demographics
          </p>
        </div>
        <Suspense fallback={<div className="text-muted-foreground text-sm">Loading clients…</div>}>
          <ClientsClient />
        </Suspense>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create ClientsClient component**
  Create `apps/web/app/(clinic)/clinic/clients/clients-client.tsx`:
  ```typescript
  'use client';

  import { useEffect, useState } from 'react';
  import Link from 'next/link';
  import { apiClient, ApiError } from '@/lib/api-client';
  import { Button } from '@petiatrics/ui/button';
  import { Input } from '@petiatrics/ui/input';
  import { usePermission } from '@/lib/use-permission';

  interface ClientUser {
    id: string;
    name: string;
    email: string | null;
    businessPartners?: {
      code: string | null;
      phone: string | null;
    }[];
  }

  export default function ClientsClient() {
    const [clients, setClients] = useState<ClientUser[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const canAddClient = usePermission('PATIENT:EDIT');

    useEffect(() => {
      apiClient
        .get<ClientUser[]>('/clinic/clients')
        .then(setClients)
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load clients'))
        .finally(() => setLoading(false));
    }, []);

    const filtered = clients.filter((c) => {
      const q = search.toLowerCase();
      const bp = c.businessPartners?.[0];
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (bp?.code && bp.code.toLowerCase().includes(q)) ||
        (bp?.phone && bp.phone.includes(q))
      );
    });

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Input
            placeholder="Search by name, email, phone or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {canAddClient && (
            <Link href="/clinic/clients/new">
              <Button>+ Register Client</Button>
            </Link>
          )}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">BP Code</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No clients found
                    </td>
                  </tr>
                )}
                {filtered.map((c) => {
                  const bp = c.businessPartners?.[0];
                  return (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/clinic/clients/${c.id}`} className="text-primary hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{bp?.code ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.email ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{bp?.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/clinic/clients/${c.id}`} className="text-primary underline-offset-4 hover:underline text-sm font-medium">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 3: Commit**
  Run: `git add apps/web/app/\(clinic\)/clinic/clients/page.tsx apps/web/app/\(clinic\)/clinic/clients/clients-client.tsx; git commit -m "feat(web): build client directory list page"`

---

### Task 5: Build Create Client Page Frontend Form

**Files:**
- Create: [page.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(clinic)/clinic/clients/new/page.tsx)
- Create: [client-create-client.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(clinic)/clinic/clients/new/client-create-client.tsx)

- [ ] **Step 1: Create layout page.tsx for `/clinic/clients/new`**
  Create `apps/web/app/(clinic)/clinic/clients/new/page.tsx`:
  ```typescript
  import ClientCreateClient from './client-create-client';

  export default function RegisterClientPage() {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Register Client</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Register a walk-in pet owner as a clinic customer.
          </p>
        </div>
        <ClientCreateClient />
      </div>
    );
  }
  ```

- [ ] **Step 2: Create ClientCreateClient component**
  Create `apps/web/app/(clinic)/clinic/clients/new/client-create-client.tsx`:
  ```typescript
  'use client';

  import { useState } from 'react';
  import { useRouter } from 'next/navigation';
  import { apiClient, ApiError } from '@/lib/api-client';
  import { Button } from '@petiatrics/ui/button';
  import { Input } from '@petiatrics/ui/input';
  import { Label } from '@petiatrics/ui/label';

  export default function ClientCreateClient() {
    const router = useRouter();
    const [form, setForm] = useState({
      name: '',
      email: '',
      phone: '',
      lineId: '',
      taxId: '',
      addressLine1: '',
      subDistrict: '',
      district: '',
      province: '',
      zipcode: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        const payload = {
          ...form,
          email: form.email || undefined,
          phone: form.phone || undefined,
          lineId: form.lineId || undefined,
          taxId: form.taxId || undefined,
          addressLine1: form.addressLine1 || undefined,
          subDistrict: form.subDistrict || undefined,
          district: form.district || undefined,
          province: form.province || undefined,
          zipcode: form.zipcode || undefined,
        };
        const created = await apiClient.post<{ id: string }>('/clinic/clients', payload);
        router.push(`/clinic/clients/${created.id}`);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to register client');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-6 bg-card">
        {error && <p className="text-destructive text-sm font-medium">{error}</p>}

        <div className="space-y-1.5">
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="lineId">Line ID</Label>
            <Input
              id="lineId"
              value={form.lineId}
              onChange={(e) => setForm({ ...form, lineId: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="taxId">Tax ID (TIN)</Label>
            <Input
              id="taxId"
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="addressLine1">Address Line 1</Label>
          <Input
            id="addressLine1"
            value={form.addressLine1}
            onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="subDistrict">Sub-District</Label>
            <Input
              id="subDistrict"
              value={form.subDistrict}
              onChange={(e) => setForm({ ...form, subDistrict: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="district">District</Label>
            <Input
              id="district"
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="province">Province</Label>
            <Input
              id="province"
              value={form.province}
              onChange={(e) => setForm({ ...form, province: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zipcode">Zip Code</Label>
            <Input
              id="zipcode"
              value={form.zipcode}
              onChange={(e) => setForm({ ...form, zipcode: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => router.push('/clinic/clients')}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !form.name}>
            {submitting ? 'Registering…' : 'Register Client'}
          </Button>
        </div>
      </form>
    );
  }
  ```

- [ ] **Step 3: Commit**
  Run: `git add apps/web/app/\(clinic\)/clinic/clients/new/page.tsx apps/web/app/\(clinic\)/clinic/clients/new/client-create-client.tsx; git commit -m "feat(web): build create client page form"`

---

### Task 6: Build Client Details Page Frontend Dashboard

**Files:**
- Create: [page.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(clinic)/clinic/clients/[id]/page.tsx)
- Create: [client-detail-client.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(clinic)/clinic/clients/[id]/client-detail-client.tsx)

- [ ] **Step 1: Create layout page.tsx for `/clinic/clients/[id]`**
  Create `apps/web/app/(clinic)/clinic/clients/[id]/page.tsx`:
  ```typescript
  import ClientDetailClient from './client-detail-client';

  export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
    return <ClientDetailClient params={params} />;
  }
  ```

- [ ] **Step 2: Create ClientDetailClient component**
  Create `apps/web/app/(clinic)/clinic/clients/[id]/client-detail-client.tsx`:
  ```typescript
  'use client';

  import { useEffect, useState, use } from 'react';
  import Link from 'next/link';
  import { apiClient, ApiError } from '@/lib/api-client';
  import { Button } from '@petiatrics/ui/button';
  import { Badge } from '@petiatrics/ui/badge';
  import { usePermission } from '@/lib/use-permission';

  interface Client {
    id: string;
    name: string;
    email: string | null;
    businessPartners?: {
      code: string | null;
      phone: string | null;
      lineId: string | null;
      taxId: string | null;
      addressLine1: string | null;
      subDistrict: string | null;
      district: string | null;
      province: string | null;
      zipcode: string | null;
    }[];
  }

  interface Pet {
    _id: string;
    name: string;
    species: string;
    breed: string;
    weightKg?: number;
    createdAt: string;
  }

  export default function ClientDetailClient({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [client, setClient] = useState<Client | null>(null);
    const [pets, setPets] = useState<Pet[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const canEdit = usePermission('PATIENT:EDIT');

    useEffect(() => {
      const loadData = async () => {
        try {
          const [clientData, petsData] = await Promise.all([
            apiClient.get<Client>(`/clinic/clients/${id}`),
            apiClient.get<Pet[]>(`/patients?ownerUserId=${id}`),
          ]);
          setClient(clientData);
          setPets(petsData);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Failed to load details');
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }, [id]);

    if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;
    if (error || !client) return <p className="text-destructive text-sm">{error || 'Client not found'}</p>;

    const bp = client.businessPartners?.[0];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{client.name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              BP Code: <span className="font-medium text-foreground">{bp?.code ?? '—'}</span>
            </p>
          </div>
          <Link href="/clinic/clients">
            <Button variant="outline">Back to Clients</Button>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 border rounded-lg p-5 space-y-4 bg-card">
            <h2 className="font-semibold text-lg border-b pb-2">Client Profile</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground block">Email</span>
                <span className="font-medium">{client.email ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Phone</span>
                <span className="font-medium">{bp?.phone ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Line ID</span>
                <span className="font-medium">{bp?.lineId ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Tax ID</span>
                <span className="font-medium">{bp?.taxId ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Address</span>
                <span className="font-medium whitespace-pre-line">
                  {bp?.addressLine1 ? (
                    <>
                      {bp.addressLine1}
                      {(bp.subDistrict || bp.district || bp.province) && '\n'}
                      {[bp.subDistrict, bp.district, bp.province].filter(Boolean).join(', ')}
                      {bp.zipcode && ` ${bp.zipcode}`}
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="col-span-2 border rounded-lg p-5 space-y-4 bg-card">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-lg">Patients / Pets</h2>
              {canEdit && (
                <Link href={`/clinic/patients/new?ownerId=${id}`}>
                  <Button size="sm">+ Add Pet</Button>
                </Link>
              )}
            </div>

            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Pet Name</th>
                    <th className="text-left px-4 py-2.5 font-medium">Species / Breed</th>
                    <th className="text-left px-4 py-2.5 font-medium">Weight</th>
                    <th className="px-4 py-2.5 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pets.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                        No pets registered for this client.
                      </td>
                    </tr>
                  )}
                  {pets.map((pet) => (
                    <tr key={pet._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{pet.name}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="capitalize">{pet.species}</Badge>
                          {pet.breed && <span className="text-muted-foreground text-xs">{pet.breed}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {pet.weightKg != null ? `${pet.weightKg} kg` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={`/patients/${pet._id}`} className="text-primary hover:underline text-xs font-semibold">
                          View History
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Commit**
  Run: `git add apps/web/app/\(clinic\)/clinic/clients/\[id\]/page.tsx apps/web/app/\(clinic\)/clinic/clients/\[id\]/client-detail-client.tsx; git commit -m "feat(web): build client detail page showing aggregated pets and profile details"`

---

### Task 7: Build Standalone Patient Form with Owner Combobox

**Files:**
- Create: [page.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(clinic)/clinic/patients/new/page.tsx)
- Create: [patient-new-client.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(clinic)/clinic/patients/new/patient-new-client.tsx)

- [ ] **Step 1: Create layout page.tsx for `/clinic/patients/new`**
  Create `apps/web/app/(clinic)/clinic/patients/new/page.tsx`:
  ```typescript
  import { Suspense } from 'react';
  import PatientNewClient from './patient-new-client';

  export default function NewPatientPage() {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Add Patient</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Register a new pet in the clinic system.
          </p>
        </div>
        <Suspense fallback={<div className="text-muted-foreground text-sm">Loading form…</div>}>
          <PatientNewClient />
        </Suspense>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create PatientNewClient component**
  Create `apps/web/app/(clinic)/clinic/patients/new/patient-new-client.tsx`:
  ```typescript
  'use client';

  import { useEffect, useState } from 'react';
  import { useRouter, useSearchParams } from 'next/navigation';
  import { apiClient, ApiError } from '@/lib/api-client';
  import { Button } from '@petiatrics/ui/button';
  import { Input } from '@petiatrics/ui/input';
  import { Label } from '@petiatrics/ui/label';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@petiatrics/ui/select';
  import { Popover, PopoverContent, PopoverTrigger } from '@petiatrics/ui/popover';
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@petiatrics/ui/command';
  import { Check, ChevronsUpDown } from 'lucide-react';

  interface ClientUser {
    id: string;
    name: string;
    email: string | null;
  }

  const SPECIES_LABELS: Record<string, string> = {
    dog: 'Dog', cat: 'Cat', rabbit: 'Rabbit', bird: 'Bird', other: 'Other',
  };

  export default function PatientNewClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const ownerIdParam = searchParams.get('ownerId');

    const [clients, setClients] = useState<ClientUser[]>([]);
    const [selectedOwner, setSelectedOwner] = useState<ClientUser | null>(null);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState({
      name: '',
      species: 'dog',
      breed: '',
      weightKg: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      apiClient
        .get<ClientUser[]>('/clinic/clients')
        .then((data) => {
          setClients(data);
          if (ownerIdParam) {
            const matched = data.find((c) => c.id === ownerIdParam);
            if (matched) setSelectedOwner(matched);
          }
        })
        .finally(() => setLoading(false));
    }, [ownerIdParam]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedOwner) return;
      setSubmitting(true);
      setError(null);
      try {
        await apiClient.post('/patients', {
          ...form,
          ownerUserId: selectedOwner.id,
          weightKg: form.weightKg ? parseFloat(form.weightKg) : undefined,
        });
        if (ownerIdParam) {
          router.push(`/clinic/clients/${ownerIdParam}`);
        } else {
          router.push('/clinic/patients');
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to add patient');
      } finally {
        setSubmitting(false);
      }
    };

    if (loading) return <p className="text-muted-foreground text-sm">Loading form data…</p>;

    return (
      <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-6 bg-card">
        {error && <p className="text-destructive text-sm font-medium">{error}</p>}

        <div className="space-y-1.5">
          <Label htmlFor="name">Pet Name *</Label>
          <Input
            id="name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Species *</Label>
          <Select
            value={form.species}
            onValueChange={(v) => setForm({ ...form, species: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SPECIES_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="breed">Breed</Label>
          <Input
            id="breed"
            value={form.breed}
            onChange={(e) => setForm({ ...form, breed: e.target.value })}
          />
        </div>

        <div className="space-y-1.5 flex flex-col">
          <Label className="mb-1">Owner *</Label>
          {ownerIdParam ? (
            <Input
              value={selectedOwner ? `${selectedOwner.name} (${selectedOwner.email ?? 'No Email'})` : 'Loading…'}
              disabled
              className="bg-muted"
            />
          ) : (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="justify-between text-left font-normal"
                >
                  {selectedOwner
                    ? `${selectedOwner.name} (${selectedOwner.email ?? 'No Email'})`
                    : 'Select Owner…'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search client owners…" />
                  <CommandList>
                    <CommandEmpty>No owners found.</CommandEmpty>
                    <CommandGroup>
                      {clients.map((client) => (
                        <CommandItem
                          key={client.id}
                          value={client.name}
                          onSelect={() => {
                            setSelectedOwner(client);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${selectedOwner?.id === client.id ? 'opacity-100' : 'opacity-0'}`}
                          />
                          <div>
                            <div>{client.name}</div>
                            <div className="text-xs text-muted-foreground">{client.email ?? 'No Email'}</div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="weight">Weight (kg)</Label>
          <Input
            id="weight"
            type="number"
            step="0.1"
            value={form.weightKg}
            onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
          />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (ownerIdParam) {
                router.push(`/clinic/clients/${ownerIdParam}`);
              } else {
                router.push('/clinic/patients');
              }
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !form.name || !selectedOwner}>
            {submitting ? 'Adding…' : 'Add Patient'}
          </Button>
        </div>
      </form>
    );
  }
  ```

- [ ] **Step 3: Commit**
  Run: `git add apps/web/app/\(clinic\)/clinic/patients/new/page.tsx apps/web/app/\(clinic\)/clinic/patients/new/patient-new-client.tsx; git commit -m "feat(web): build standalone patient form with client owner search combobox"`

---

### Task 8: Update Patients List to redirect to the new Standalone Form

**Files:**
- Modify: [patients-client.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(clinic)/clinic/patients/patients-client.tsx)

- [ ] **Step 1: Replace "+ Add Patient" dialog click handler**
  Modify `apps/web/app/(clinic)/clinic/patients/patients-client.tsx` to link to `/clinic/patients/new` page directly rather than opening the dialog.
  
  Replace lines 92:
  ```typescript
  // Target:
  {canAddPatient && <Button onClick={() => setShowAdd(true)}>+ Add Patient</Button>}
  
  // Replacement:
  {canAddPatient && (
    <Link href="/clinic/patients/new">
      <Button>+ Add Patient</Button>
    </Link>
  )}
  ```

- [ ] **Step 2: Run web dev compilation check**
  Run: `npx turbo run build --filter=@petiatrics/web 2>&1`
  Expected: Success

- [ ] **Step 3: Commit**
  Run: `git add apps/web/app/\(clinic\)/clinic/patients/patients-client.tsx; git commit -m "feat(web): redirect patients directory Add Patient button to the standalone new page"`
