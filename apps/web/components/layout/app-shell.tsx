'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Calendar,
  PawPrint,
  Users,
  FileText,
  Package,
  CreditCard,
  UserCog,
  ClipboardList,
  Settings,
  Smartphone,
  Menu,
  X,
  Bell,
  ChevronDown,
  LogOut,
  Search,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@petiatrics/ui';
import { Button } from '@petiatrics/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@petiatrics/ui';
import { cn } from '@petiatrics/ui';
import type { AuthProfile } from '@petiatrics/types';
import { BranchSelector } from './branch-selector';
import { useSessionStore } from '../../lib/session-store';

type NavKey = 'dashboard' | 'appointments' | 'patients' | 'clients' | 'medicalRecords' | 'inventory' | 'billing' | 'staff' | 'audit' | 'mobileApp' | 'settings';

interface NavItem {
  key: NavKey;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/clinic/dashboard', icon: LayoutDashboard },
  { key: 'appointments', href: '/clinic/appointments', icon: Calendar },
  { key: 'patients', href: '/clinic/patients', icon: PawPrint },
  { key: 'clients', href: '/clients', icon: Users },
  { key: 'medicalRecords', href: '/medical-records', icon: FileText },
  { key: 'inventory', href: '/clinic/inventory', icon: Package },
  { key: 'billing', href: '/clinic/billing', icon: CreditCard },
  {
    key: 'staff',
    href: '/clinic/staff',
    icon: UserCog,
    roles: ['CLINIC_OWNER', 'SUPER_ADMIN'],
  },
  {
    key: 'audit',
    href: '/clinic/audit',
    icon: ClipboardList,
    roles: ['CLINIC_OWNER', 'SUPER_ADMIN'],
  },
  { key: 'mobileApp', href: '/mobile-app', icon: Smartphone },
  { key: 'settings', href: '/clinic/settings', icon: Settings },
];

interface AppShellProps {
  children: React.ReactNode;
  user: AuthProfile;
}

/**
 * AppShell — persistent sidebar navigation + top header.
 *
 * - Sidebar collapses to off-canvas on mobile; persistent on desktop (lg+)
 * - Language switcher sets the `petiatrics_locale` cookie and reloads
 * - User menu shows logout option (POST /api/v1/auth/logout)
 */
export function AppShell({ children, user }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tLocale = useTranslations('locale');
  const tAuth = useTranslations('auth');

  function isActive(href: string) {
    if (href === '/clinic/dashboard') return pathname === '/clinic/dashboard';
    return pathname.startsWith(href);
  }

  function canAccess(item: NavItem) {
    if (!item.roles) return true;
    return item.roles.includes(user.role);
  }

  async function handleLocaleSwitch(locale: string) {
    document.cookie = `petiatrics_locale=${locale}; path=/; max-age=31536000`;
    window.location.reload();
  }

  async function handleLogout() {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    useSessionStore.getState().clear();
    window.location.href = '/login';
  }

  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200',
          'flex flex-col transition-transform duration-200',
          'lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <PawPrint className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm leading-none">
                Petiatrics
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Vet Management</p>
            </div>
          </div>
          <button
            className="lg:hidden text-gray-400 hover:text-gray-600"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.filter(canAccess).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                )}
              >
                <Icon
                  className={cn(
                    'w-5 h-5 shrink-0',
                    active ? 'text-blue-600' : 'text-gray-400',
                  )}
                />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        {/* Mobile App card */}
        <div className="p-4 border-t border-gray-200 shrink-0">
          <Link
            href="/mobile-app"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-4 py-3 bg-linear-to-r from-green-50 to-blue-50 rounded-xl border border-green-200"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-green-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{t('mobileApp')}</p>
              <p className="text-xs text-gray-600">{t('mobileAppSubtitle')}</p>
            </div>
          </Link>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 shrink-0">
          {/* Mobile menu toggle */}
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Search bar */}
          <div className="flex-1 max-w-2xl mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients, clients, appointments..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Branch selector — only visible for multi-branch users */}
            <BranchSelector />

            {/* Language switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-gray-600">
                  {user.preferredLocale === 'TH' ? 'TH' : 'EN'}
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4} className="w-40">
                <DropdownMenuItem onClick={() => handleLocaleSwitch('TH')}>
                  {tLocale('th')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleLocaleSwitch('EN')}>
                  {tLocale('en')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notification bell */}
            <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg focus-visible:outline-none">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full" />
            </button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 hover:bg-gray-100 rounded-lg focus-visible:outline-none">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-medium text-gray-900 leading-none">{user.email.split('@')[0]}</p>
                    <p className="text-xs text-gray-500 capitalize mt-0.5">{user.role.replace(/_/g, ' ').toLowerCase()}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4} className="w-56">
                <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/clinic/settings">{t('settings')}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {tAuth('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
