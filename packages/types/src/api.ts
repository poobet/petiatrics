import { Role, Locale } from './enums';

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

