import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { apiClient, ApiError } from '../../lib/api-client';
import type { AuthProfile } from '@petiatrics/types';
import { Role } from '@petiatrics/types';
import { AdminShell } from './_components/admin-shell';

export const metadata: Metadata = {
  title: 'Petiatrics — Platform Admin',
};

/**
 * Admin portal layout (Server Component).
 * Performs authoritative server-side role check via GET /auth/me.
 * Non-SUPER_ADMIN users are redirected to /clinic/dashboard.
 */
export default async function AdminLayout({
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

  if (user.role !== Role.SUPER_ADMIN) {
    redirect('/clinic/dashboard');
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
