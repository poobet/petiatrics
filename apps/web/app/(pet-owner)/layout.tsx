import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata, Viewport } from 'next';
import { apiClient, ApiError } from '../../lib/api-client';
import type { AuthProfile } from '@petiatrics/types';
import { Role } from '@petiatrics/types';
import Link from 'next/link';
import { Home, Calendar, FileText, CreditCard, Bell } from 'lucide-react';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2563eb',
};

export const metadata: Metadata = {
  title: {
    template: '%s | Petiatrics',
    default: 'Petiatrics — My Pets',
  },
  description: 'Track your pets health, appointments, and invoices.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Petiatrics',
  },
  formatDetection: { telephone: false },
};

const NAV_ITEMS = [
  { href: '/my', icon: Home, label: 'Home' },
  { href: '/my/appointments', icon: Calendar, label: 'Appointments' },
  { href: '/my/invoices', icon: CreditCard, label: 'Invoices' },
];

export default async function PetOwnerLayout({
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

  // Pet-owner portal: allow clinic staff roles and SUPER_ADMIN (who can access all pages)
  if (
    user.role !== Role.STAFF &&
    user.role !== Role.ASSISTANT &&
    user.role !== Role.CASHIER &&
    user.role !== Role.SUPER_ADMIN
  ) {
    redirect('/clinic/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Top App Bar */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <span className="font-bold text-blue-600 text-lg">🐾 Petiatrics</span>
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-600">{user.email}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t flex justify-around py-2 z-10">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-0.5 text-xs text-gray-500 hover:text-blue-600 px-3 py-1"
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
