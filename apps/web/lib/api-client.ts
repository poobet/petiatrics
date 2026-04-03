/**
 * Typed fetch wrapper for the Petiatrics API.
 *
 * - Always sends credentials (session cookie) with each request.
 * - Automatically injects x-active-branch header from Zustand store (browser only).
 * - Unwraps the standard { data, meta, error } envelope.
 * - Throws ApiError on non-2xx responses so callers can catch it.
 * - On 401, clears session store and redirects to /login (browser only).
 * - Supports both Server Components (absolute URL) and Client Components
 *   (relative URL via /api proxy in next.config.ts rewrites — added later).
 */

import type { ApiEnvelope, PaginatedResponse } from '@petiatrics/types';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getBaseUrl(): string {
  // In Server Components, use the internal API URL.
  // In browser, requests go through the Next.js rewrite proxy (relative path).
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  }
  return '';
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${getBaseUrl()}/api/v1${path}`;

  // Inject x-active-branch in browser context from the Zustand session store.
  // Server Components skip this — they don't have client-side branch state.
  const branchHeaders: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    // Dynamic import avoids server-side evaluation of the Zustand store
    const { useSessionStore } = await import('./session-store');
    const activeBranchId = useSessionStore.getState().activeBranch?.id;
    if (activeBranchId) {
      branchHeaders['x-active-branch'] = activeBranchId;
    }
  }

  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...branchHeaders,
      ...(init.headers ?? {}),
    },
  });

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  // 401 → clear session state and redirect to login (browser only)
  if (response.status === 401 && typeof window !== 'undefined') {
    const { useSessionStore } = await import('./session-store');
    useSessionStore.getState().clear();
    window.location.href = '/login';
    return undefined as T;
  }

  const envelope: ApiEnvelope<T> = await response.json();

  if (!response.ok || envelope.error) {
    throw new ApiError(
      envelope.error?.code ?? `HTTP_${response.status}`,
      envelope.error?.message ?? response.statusText,
      response.status,
      envelope.error?.details,
    );
  }

  return envelope.data as T;
}

// ─── Convenience methods ─────────────────────────────────────────────────────

export const apiClient = {
  get<T>(path: string, init?: RequestInit): Promise<T> {
    return request<T>(path, { ...init, method: 'GET' });
  },

  post<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
    return request<T>(path, {
      ...init,
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  put<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
    return request<T>(path, {
      ...init,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  patch<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
    return request<T>(path, {
      ...init,
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  delete<T = void>(path: string, init?: RequestInit): Promise<T> {
    return request<T>(path, { ...init, method: 'DELETE' });
  },
};

// ─── Paginated helper ─────────────────────────────────────────────────────────

export async function fetchPaginated<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
  init?: RequestInit,
): Promise<PaginatedResponse<T>> {
  const searchParams = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.set(key, String(value));
    }
  }
  const query = searchParams.toString();
  const url = `${path}${query ? `?${query}` : ''}`;

  const url2 = `${getBaseUrl()}/api/v1${url}`;
  const response = await fetch(url2, {
    ...init,
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const envelope: PaginatedResponse<T> = await response.json();

  if (!response.ok) {
    const anyEnvelope = envelope as unknown as { error?: { code?: string; message?: string } };
    throw new ApiError(
      anyEnvelope.error?.code ?? `HTTP_${response.status}`,
      anyEnvelope.error?.message ?? response.statusText,
      response.status,
    );
  }

  return envelope;
}
