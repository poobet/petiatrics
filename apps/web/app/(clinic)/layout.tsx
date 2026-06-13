import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import type { Metadata } from 'next';
import { AppShell } from '../../components/layout/app-shell';
import { StoreHydrator } from '../../components/layout/store-hydrator';
import { apiClient, ApiError } from '../../lib/api-client';
import type { AuthProfile } from '@petiatrics/types';
import { Role } from '@petiatrics/types';

export const metadata: Metadata = {
  title: 'Petiatrics — Clinic Portal',
};

/**
 * Clinic staff portal layout (Server Component).
 * Performs authoritative server-side role check via GET /auth/me.
 * All authenticated users (including SUPER_ADMIN) can access clinic pages.
 * Hydrates the Zustand store via StoreHydrator for client components.
 * Redirects to change-password if mustChangePassword flag is set.
 */
export default async function ClinicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: AuthProfile;

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');

  try {
    user = await apiClient.get<AuthProfile>('/auth/me', {
      cache: 'no-store',
      headers: { Cookie: cookieHeader },
    });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      redirect('/login');
    }
    redirect('/login');
  }

  // Force password change before accessing any other clinic page
  if (user.role === Role.CUSTOMER) {
    redirect('/my');
  }

  if (user.mustChangePassword) {
    const headerStore = await headers();
    const pathname = headerStore.get('x-pathname') ?? headerStore.get('x-invoke-path') ?? '';
    if (!pathname.startsWith('/clinic/change-password')) {
      redirect('/clinic/change-password');
    }
  }

  return (
    <>
      <StoreHydrator profile={user} />
      <AppShell user={user}>{children}</AppShell>
    </>
  );
}


