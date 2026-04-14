import { Role, Locale, BusinessPartnerType } from './enums';

// ─── Response Envelope ───────────────────────────────────────────────────────

export interface ApiMeta {
  page?: number;
  perPage?: number;
  total?: number;
  totalPages?: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  data: T | null;
  meta: ApiMeta | null;
  error: ApiError | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// ─── Session / Auth ───────────────────────────────────────────────────────────

export interface BranchSummary {
  id: string;
  name: string;
}

export interface UserContext {
  userId: string;
  clinicId: string | null;
  clinicName: string | null;
  clinicSlug: string | null;
  role: Role;
  email?: string | null;
  username?: string | null;
  mustChangePassword?: boolean;
  preferredLocale: Locale;
  authorizedBranches: BranchSummary[];
  /** Optional linkage: the BP id of the logged-in user */
  businessPartnerId?: string | null;
  /** Epoch ms — used to enforce 12h absolute session expiry */
  issuedAt?: number;
}

export interface AuthProfile {
  id: string;
  name?: string;
  email?: string | null;
  username?: string | null;
  mustChangePassword?: boolean;
  role: Role;
  clinicName: string | null;
  clinicSlug?: string | null;
  branches: BranchSummary[];
  preferredLocale: Locale;
  /** Optional BP linkage for the authenticated user */
  businessPartnerId?: string | null;
}

// ─── Common Query Params ──────────────────────────────────────────────────────

export interface PaginationQuery {
  page?: number;
  perPage?: number;
}

export interface DateRangeQuery {
  from?: string; // ISO date string
  to?: string;   // ISO date string
}

// ─── Business Partner DTOs ────────────────────────────────────────────────────

export interface BpVetPayload {
  licenseNumber: string;
  whtRate?: number;
}

export interface BpSupplierPayload {
  taxId: string;
  creditTermDays: number;
}

export interface CreateBusinessPartnerPayload {
  type: BusinessPartnerType;
  name: string;
  linkUserId?: string | null;
  vet?: BpVetPayload | null;
  supplier?: BpSupplierPayload | null;
}

export interface UpdateBusinessPartnerPayload {
  name?: string;
  linkUserId?: string | null;
  vet?: BpVetPayload | null;
  supplier?: BpSupplierPayload | null;
}

export interface BusinessPartnerListQuery {
  type?: BusinessPartnerType;
  search?: string;
  includeInactive?: boolean;
}

export interface BpUserSummary {
  id: string;
  role: Role;
  email: string | null;
  username: string | null;
}

export interface BpVetResponse {
  licenseNumber: string;
  whtRate: number;
}

export interface BpSupplierResponse {
  taxId: string;
  creditTermDays: number;
}

export interface BusinessPartnerResponse {
  id: string;
  clinicId: string;
  type: BusinessPartnerType;
  name: string;
  isActive: boolean;
  user: BpUserSummary | null;
  vet: BpVetResponse | null;
  supplier: BpSupplierResponse | null;
  createdAt: string;
  updatedAt: string;
}

