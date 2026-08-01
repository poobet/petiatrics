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
  Archive,
  Boxes,
  CreditCard,
  UserCog,
  ClipboardList,
  Settings,
  Smartphone,
  ShoppingCart,
  Menu,
  X,
  Bell,
  ChevronDown,
  LogOut,
  Search,
  Briefcase,
  ChevronRight,
  Shield,
  Receipt,
  Coins,
  BookOpen,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarProvider,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@petiatrics/ui';
import { cn } from '@petiatrics/ui';
import type { AuthProfile } from '@petiatrics/types';
import { BranchSelector } from './branch-selector';
import { useSessionStore } from '../../lib/session-store';

type NavKey = 'dashboard' | 'appointments' | 'patients' | 'clients' | 'medicalRecords' | 'inventory' | 'products' | 'stockLedger' | 'goodsReceipt' | 'goodsIssue' | 'adjustments' | 'billing' | 'billingSettings' | 'pos' | 'staff' | 'businessPartners' | 'audit' | 'mobileApp' | 'settings' | 'settingsGeneral' | 'rolePermissions' | 'documentSequence' | 'accountingPeriods' | 'procurement' | 'purchaseOrders' | 'purchaseInvoices' | 'supplierPayments' | 'procurementSettings' | 'appointmentSettings' | 'commission' | 'commissionDashboard' | 'commissionRules' | 'commissionTransactions' | 'commissionPaymentRuns' | 'commissionWht' | 'accounting' | 'accountingJournal';

interface SubNavItem {
  key: NavKey;
  href: string;
  icon: React.ElementType;
  requiredPermission?: string;
}

interface NavItem {
  key: NavKey;
  href?: string;
  icon: React.ElementType;
  roles?: string[];
  requiredPermission?: string;
  subItems?: SubNavItem[];
}

type NavGroupKey =
  | 'navGroupClinicOps'
  | 'navGroupInventoryProcurement'
  | 'navGroupFinanceAccounting'
  | 'navGroupAdministration';

interface NavGroup {
  groupKey: NavGroupKey;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupKey: 'navGroupClinicOps',
    items: [
      { key: 'dashboard', href: '/clinic/dashboard', icon: LayoutDashboard },
      { key: 'appointments', href: '/clinic/appointments', icon: Calendar },
      { key: 'patients', href: '/clinic/patients', icon: PawPrint, requiredPermission: 'PATIENT:VIEW' },
      { key: 'clients', href: '/clinic/clients', icon: Users, requiredPermission: 'PATIENT:VIEW' },
      { key: 'medicalRecords', href: '/medical-records', icon: FileText, requiredPermission: 'PATIENT:VIEW' },
      { key: 'pos', href: '/clinic/pos', icon: ShoppingCart, requiredPermission: 'BILLING:ADD' },
    ],
  },
  {
    groupKey: 'navGroupInventoryProcurement',
    items: [
      {
        key: 'inventory',
        icon: Package,
        subItems: [
          { key: 'products', href: '/clinic/inventory/products', icon: Package, requiredPermission: 'INVENTORY:VIEW' },
          { key: 'stockLedger', href: '/clinic/inventory/stock-ledger', icon: Archive, requiredPermission: 'INVENTORY:VIEW' },
          { key: 'goodsReceipt', href: '/clinic/inventory/receipt', icon: Boxes, requiredPermission: 'INVENTORY:ADD' },
          { key: 'goodsIssue', href: '/clinic/inventory/issue', icon: Archive, requiredPermission: 'INVENTORY:ADD' },
          { key: 'adjustments', href: '/clinic/inventory/adjustments', icon: Boxes, requiredPermission: 'INVENTORY:EDIT' },
        ],
      },
      {
        key: 'procurement',
        icon: ClipboardList,
        subItems: [
          { key: 'purchaseOrders', href: '/clinic/procurement/orders', icon: FileText, requiredPermission: 'INVENTORY:VIEW' },
          { key: 'goodsReceipt', href: '/clinic/procurement/receipts', icon: Boxes, requiredPermission: 'INVENTORY:ADD' },
          { key: 'purchaseInvoices', href: '/clinic/procurement/invoices', icon: Receipt, requiredPermission: 'INVENTORY:VIEW' },
          { key: 'supplierPayments', href: '/clinic/procurement/payments', icon: CreditCard, requiredPermission: 'INVENTORY:VIEW' },
          { key: 'procurementSettings', href: '/clinic/procurement/settings', icon: Settings, requiredPermission: 'SETTINGS:MANAGE' },
        ],
      },
    ],
  },
  {
    groupKey: 'navGroupFinanceAccounting',
    items: [
      {
        key: 'billing',
        icon: CreditCard,
        subItems: [
          { key: 'billing', href: '/clinic/billing', icon: CreditCard, requiredPermission: 'BILLING:VIEW' },
          { key: 'billingSettings', href: '/clinic/billing/settings', icon: Settings, requiredPermission: 'SETTINGS:MANAGE' },
        ],
      },
      {
        key: 'commission',
        icon: Coins,
        subItems: [
          { key: 'commissionDashboard', href: '/clinic/commission', icon: LayoutDashboard, requiredPermission: 'COMMISSION:VIEW' },
          { key: 'commissionRules', href: '/clinic/commission/rules', icon: ClipboardList, requiredPermission: 'COMMISSION:VIEW' },
          { key: 'commissionTransactions', href: '/clinic/commission/transactions', icon: FileText, requiredPermission: 'COMMISSION:VIEW' },
          { key: 'commissionPaymentRuns', href: '/clinic/commission/payment-runs', icon: CreditCard, requiredPermission: 'COMMISSION:VIEW' },
          { key: 'commissionWht', href: '/clinic/commission/wht', icon: Receipt, requiredPermission: 'COMMISSION:VIEW' },
        ],
      },
      {
        key: 'accounting',
        icon: BookOpen,
        subItems: [
          { key: 'accountingJournal', href: '/clinic/accounting/journal', icon: BookOpen, requiredPermission: 'BILLING:VIEW' },
          { key: 'accountingPeriods', href: '/clinic/settings/accounting-periods', icon: Calendar, requiredPermission: 'SETTINGS:MANAGE' },
        ],
      },
    ],
  },
  {
    groupKey: 'navGroupAdministration',
    items: [
      { key: 'staff', href: '/clinic/staff', icon: UserCog, requiredPermission: 'SETTINGS:MANAGE' },
      { key: 'businessPartners', href: '/clinic/business-partners', icon: Briefcase },
      { key: 'audit', href: '/clinic/audit', icon: ClipboardList, requiredPermission: 'SETTINGS:MANAGE' },
      {
        key: 'settings',
        icon: Settings,
        subItems: [
          { key: 'settingsGeneral', href: '/clinic/settings', icon: Settings },
          { key: 'rolePermissions', href: '/clinic/settings/roles', icon: Shield, requiredPermission: 'SETTINGS:MANAGE' },
          { key: 'documentSequence', href: '/clinic/settings/document-sequence', icon: ClipboardList, requiredPermission: 'SETTINGS:MANAGE' },
        ],
      },
    ],
  },
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
  const [expandedNav, setExpandedNav] = useState<Record<NavKey, boolean>>({} as any);
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tLocale = useTranslations('locale');
  const tAuth = useTranslations('auth');

  function isActive(href?: string) {
    if (!href) return false;
    if (href === '/clinic/dashboard') return pathname === '/clinic/dashboard';
    return pathname.startsWith(href);
  }

  function isItemOrSubitemActive(item: NavItem): boolean {
    if (item.href && isActive(item.href)) return true;
    if (item.subItems) {
      return item.subItems.some(sub => isActive(sub.href));
    }
    return false;
  }

  function toggleNav(key: NavKey) {
    setExpandedNav(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function canAccess(item: NavItem | SubNavItem): boolean {
    const isSuperAdmin = user.systemRole === 'SUPER_ADMIN' || user.role === 'SUPER_ADMIN';
    const isClinicOwner = user.roleCode === 'CLINIC_OWNER' || user.role === 'CLINIC_OWNER';

    // SUPER_ADMIN and CLINIC_OWNER bypass all menu restrictions
    if (isSuperAdmin || isClinicOwner) {
      return true;
    }

    // Role-based filtering fallback (if roles field is specified)
    if ('roles' in item && item.roles) {
      const activeRoleCode = user.roleCode ?? user.role;
      if (!item.roles.includes(activeRoleCode)) {
        return false;
      }
    }

    // Permission-based filtering
    if (item.requiredPermission) {
      const userPermissions = user.permissions || [];
      if (!userPermissions.includes(item.requiredPermission)) {
        return false;
      }
    }

    return true;
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

  const displayName = user.name || user.username || user.email || '';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen bg-gray-50 flex w-full">
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

        {/* Navigation Groups (Storybook Sidebar Design) */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(canAccess);
            if (visibleItems.length === 0) return null;

            return (
              <SidebarGroup key={group.groupKey} className="p-0">
                <SidebarGroupLabel className="px-2 text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/60 h-7 flex items-center">
                  {t(group.groupKey)}
                </SidebarGroupLabel>
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu>
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const itemActive = isItemOrSubitemActive(item);
                      const isExpanded = expandedNav[item.key];

                      if (item.subItems) {
                        const visibleSubItems = item.subItems.filter(canAccess);
                        if (visibleSubItems.length === 0) return null;

                        return (
                          <SidebarMenuItem key={item.key}>
                            <SidebarMenuButton
                              onClick={() => toggleNav(item.key)}
                              isActive={itemActive}
                              className="w-full justify-between font-medium cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Icon className="w-4 h-4 shrink-0" />
                                <span className="truncate">{t(item.key)}</span>
                              </div>
                              <ChevronRight
                                className={cn(
                                  'w-4 h-4 shrink-0 transition-transform duration-200',
                                  isExpanded && 'rotate-90',
                                )}
                              />
                            </SidebarMenuButton>

                            {isExpanded && (
                              <SidebarMenuSub className="my-1 border-l border-sidebar-border ml-3.5 pl-2.5 py-0.5 flex flex-col gap-1">
                                {visibleSubItems.map((subItem) => {
                                  const SubIcon = subItem.icon;
                                  const subActive = isActive(subItem.href);
                                  return (
                                    <SidebarMenuSubItem key={subItem.href}>
                                      <SidebarMenuSubButton
                                        asChild
                                        isActive={subActive}
                                      >
                                        <Link
                                          href={subItem.href}
                                          onClick={() => setSidebarOpen(false)}
                                          className="flex items-center gap-2"
                                        >
                                          <SubIcon className="w-3.5 h-3.5 shrink-0" />
                                          <span className="truncate">{t(subItem.key)}</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  );
                                })}
                              </SidebarMenuSub>
                            )}
                          </SidebarMenuItem>
                        );
                      }

                      return (
                        <SidebarMenuItem key={item.key}>
                          <SidebarMenuButton
                            asChild
                            isActive={itemActive}
                            className="font-medium"
                          >
                            <Link
                              href={item.href || '#'}
                              onClick={() => setSidebarOpen(false)}
                              className="flex items-center gap-2.5"
                            >
                              <Icon className="w-4 h-4 shrink-0" />
                              <span className="truncate">{t(item.key)}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
        </nav>
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
                    <p className="text-sm font-medium text-gray-900 leading-none">{displayName.includes('@') ? displayName.split('@')[0] : displayName}</p>
                    <p className="text-xs text-gray-500 capitalize mt-0.5">{user.role.replace(/_/g, ' ').toLowerCase()}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4} className="w-56">
                <DropdownMenuLabel>{user.email ?? user.username ?? user.name}</DropdownMenuLabel>
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
    </SidebarProvider>
  );
}
