# Chart of Accounts (COA) Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend API controller (`GlAccountController`) and frontend UI page (`/clinic/settings/chart-of-accounts`) for Chart of Accounts management with system control account protection.

**Architecture:** NestJS REST Controller exposing CRUD operations on `GLAccount` with Prisma, coupled with Next.js App Router client page organizing accounts into 5 standard accounting tabs with system protection badges.

**Tech Stack:** NestJS, Prisma, Next.js (TypeScript, React, Tailwind CSS, Lucide icons).

---

### Task 1: Create NestJS DTOs and Controller (`GlAccountController`)

**Files:**
- Create: `apps/api/src/modules/accounting/dto/create-gl-account.dto.ts`
- Create: `apps/api/src/modules/accounting/controllers/gl-account.controller.ts`
- Modify: `apps/api/src/modules/accounting/accounting.module.ts`
- Test: `apps/api/src/modules/accounting/controllers/gl-account.controller.spec.ts`

- [ ] **Step 1: Create CreateGlAccountDto**

Create `apps/api/src/modules/accounting/dto/create-gl-account.dto.ts`:
```typescript
import { IsString, IsEnum, MinLength, Matches } from 'class-validator';
import { GLAccountType } from '@prisma/client';

export class CreateGlAccountDto {
  @IsString()
  @Matches(/^[0-9]{4,6}$/, { message: 'Code must be a 4-6 digit number' })
  code: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(GLAccountType)
  type: GLAccountType;
}
```

- [ ] **Step 2: Create GlAccountController**

Create `apps/api/src/modules/accounting/controllers/gl-account.controller.ts`:
```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ConflictException,
} from '@nestjs/common';
import { PrismaClient, GLAccountType } from '@prisma/client';
import { GlAccountService } from '../services/gl-account.service';
import { CreateGlAccountDto } from '../dto/create-gl-account.dto';

@Controller('accounting/gl-accounts')
export class GlAccountController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly glAccountService: GlAccountService,
  ) {}

  @Get()
  async findAll(
    @Query('type') type?: GLAccountType,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const where: any = {};
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.gLAccount.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  @Post()
  async create(@Body() dto: CreateGlAccountDto) {
    const existing = await this.prisma.gLAccount.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`GL Account code "${dto.code}" already exists.`);
    }

    return this.prisma.gLAccount.create({
      data: {
        code: dto.code,
        name: dto.name,
        type: dto.type,
        isSystem: false,
        isActive: true,
      },
    });
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    return this.glAccountService.deactivateAccount(id);
  }
}
```

- [ ] **Step 3: Register controller in AccountingModule**

Modify `apps/api/src/modules/accounting/accounting.module.ts` to include `GlAccountController` in `controllers`.

- [ ] **Step 4: Create controller unit tests**

Create `apps/api/src/modules/accounting/controllers/gl-account.controller.spec.ts` testing `findAll`, `create` duplicate conflict, and `deactivate`.

- [ ] **Step 5: Run tests**

Run: `npx jest src/modules/accounting/controllers/gl-account.controller.spec.ts`
Expected: PASS (4/4 tests pass)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/accounting/
git commit -m "feat(api): implement GlAccountController for COA listing, creation, and soft-deactivation"
```

---

### Task 2: Create Chart of Accounts UI Management Page (`/clinic/settings/chart-of-accounts`)

**Files:**
- Create: `apps/web/app/(clinic)/clinic/settings/chart-of-accounts/page.tsx`
- Modify: `apps/web/app/(clinic)/clinic/settings/page.tsx` (add navigation card for Chart of Accounts)

- [ ] **Step 1: Create Chart of Accounts Client Page**

Create `apps/web/app/(clinic)/clinic/settings/chart-of-accounts/page.tsx`:
Implement 5 category tabs (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`/`COGS`), search filter, Protected System Account badges (`🛡️ System Control Account`), user account deactivation with confirmation, and "+ Add Sub-Account" modal with smart code suggestions.

- [ ] **Step 2: Add Chart of Accounts Card to Clinic Settings Page**

Modify `apps/web/app/(clinic)/clinic/settings/page.tsx` to add a Chart of Accounts card pointing to `/clinic/settings/chart-of-accounts`.

- [ ] **Step 3: Verify TypeScript and Vitest Build**

Run: `npx tsc --noEmit` in `apps/web`
Expected: Zero TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add Chart of Accounts management page with category tabs and system account protection"
```
