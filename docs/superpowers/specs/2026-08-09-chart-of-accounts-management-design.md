# Chart of Accounts (COA) Management Design Spec

## 1. Overview
The Chart of Accounts (COA) module provides a strict hybrid accounting architecture for Petiatrics. Essential system control accounts required for perpetual inventory, revenue, taxes, and expenses are protected (`isSystem: true`), while allowing clinic administrators to add user-defined sub-accounts (`isSystem: false`) and soft-deactivate them without breaking the double-entry audit trail.

---

## 2. Technical Architecture

### 2.1 Backend API (`GlAccountController`)
Location: `apps/api/src/modules/accounting/controllers/gl-account.controller.ts`

Endpoints:
- `GET /api/v1/accounting/gl-accounts`
  - Query params: `type?: GLAccountType`, `isActive?: boolean`, `search?: string`
  - Returns array of `GLAccount` entities sorted by `code` ascending.
- `POST /api/v1/accounting/gl-accounts`
  - Body: `CreateGlAccountDto` (`code: string`, `name: string`, `type: GLAccountType`)
  - Validates code uniqueness (`400 Bad Request` if duplicate).
  - Forces `isSystem: false` and `isActive: true`.
- `PATCH /api/v1/accounting/gl-accounts/:id`
  - Body: `UpdateGlAccountDto` (`name?: string`, `code?: string`)
  - Prevents altering `isSystem` status.
- `DELETE /api/v1/accounting/gl-accounts/:id`
  - Calls `GlAccountService.deactivateAccount(id)`
  - If `isSystem === true`, throws `403 ForbiddenException`.
  - If `isSystem === false`, soft-deactivates by setting `isActive: false`.

### 2.2 Data Transfer Objects (DTOs)
Location: `apps/api/src/modules/accounting/dto/`
- `create-gl-account.dto.ts`
  - `code`: `@IsString()`, `@Matches(/^[0-9]{4,6}$/)`
  - `name`: `@IsString()`, `@MinLength(2)`
  - `type`: `@IsEnum(GLAccountType)`
- `update-gl-account.dto.ts`
  - `name?: string`
  - `code?: string`

### 2.3 Frontend Management Page (`/clinic/settings/chart-of-accounts`)
Location: `apps/web/app/(clinic)/clinic/settings/chart-of-accounts/page.tsx`

UI Features:
1. **5 Category Tabs**:
   - `ASSET` (1000s)
   - `LIABILITY` (2000s)
   - `EQUITY` (3000s)
   - `REVENUE` (4000s)
   - `EXPENSE` & `COGS` (5000s & 6000s)
2. **Visual Account Badges**:
   - `🛡️ Protected System Account` (Indigo badge with lock icon, deletion disabled)
   - `👤 User Account` (Slate badge, editable & deactivatable)
3. **Account Creation Modal**:
   - Smart code prefix suggestion based on active tab category
   - Live validation against existing account codes
4. **Deactivation Confirmation**:
   - Soft-deactivation toggle with confirmation dialog for user accounts.

---

## 3. Security & Business Rules
1. System Control Accounts (`isSystem: true`) cannot be deleted, deactivated, or rebranded into a different type.
2. All deletions are soft-deletions (`isActive: false`) to preserve historical GL journal posting references.
