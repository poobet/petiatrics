'use client';

import { useState, useEffect } from 'react';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
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
      {
        key: 'appointments',
        icon: Calendar,
        subItems: [
          { key: 'appointments', href: '/clinic/appointments', icon: Calendar },
          { key: 'appointmentSettings', href: '/clinic/appointments/settings', icon: Settings, requiredPermission: 'SETTINGS:MANAGE' },
        ],
      },
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
  /** Read from cookie on the server — no flash */
  initialSidebarOpen?: boolean;
  /** Read from cookie on the server — no flash */
  initialCollapsedGroups?: Record<string, boolean>;
}

/**
 * AppShell — persistent sidebar navigation + top header.
 *
 * - Sidebar collapses to off-canvas on mobile; persistent on desktop (lg+)
 * - Language switcher sets the `petiatrics_locale` cookie and reloads
 * - User menu shows logout option (POST /api/v1/auth/logout)
 */
export function AppShell({ children, user, initialSidebarOpen = true, initialCollapsedGroups = {} }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);
  const [expandedNav, setExpandedNav] = useState<Record<NavKey, boolean>>({} as any);
  const [animationsEnabled, setAnimationsEnabled] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(initialCollapsedGroups);
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tLocale = useTranslations('locale');
  const tAuth = useTranslations('auth');

  // Enable smooth animations after the first paint so initial render is instant
  useEffect(() => {
    requestAnimationFrame(() => {
      setAnimationsEnabled(true);
    });
  }, []);

  function handleSidebarOpenChange(open: boolean) {
    setSidebarOpen(open);
    try {
      localStorage.setItem('petiatrics_sidebar_open', String(open));
      document.cookie = `petiatrics_sidebar_open=${open}; path=/; max-age=31536000`;
    } catch (e) {}
  }

  function toggleGroup(groupKey: string) {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupKey]: !prev[groupKey] };
      try {
        localStorage.setItem('petiatrics_collapsed_groups', JSON.stringify(next));
        document.cookie = `petiatrics_collapsed_groups=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=31536000`;
      } catch (e) {}
      return next;
    });
  }

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
    <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarOpenChange}>
      <Sidebar>
        {/* Brand Header */}
        <SidebarHeader className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <PawPrint className="size-5 text-white" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm text-sidebar-foreground truncate leading-none">Petiatrics</span>
              <span className="text-xs text-muted-foreground truncate mt-1">Vet Management</span>
            </div>
          </div>
        </SidebarHeader>

        {/* Navigation Content (No visible scrollbar) */}
        <SidebarContent className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(canAccess);
            if (visibleItems.length === 0) return null;

            const isGroupCollapsed = collapsedGroups[group.groupKey] ?? false;

            return (
              <Collapsible
                key={group.groupKey}
                open={!isGroupCollapsed}
                onOpenChange={() => toggleGroup(group.groupKey)}
                className="group/group-collapsible"
              >
                <SidebarGroup>
                  <SidebarGroupLabel asChild className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer transition-colors select-none">
                    <CollapsibleTrigger className="flex items-center justify-between w-full h-8 group/label">
                      <span>{t(group.groupKey)}</span>
                      <ChevronRight className="size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/group-collapsible:rotate-90 text-muted-foreground" />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent
                    className={cn(
                      animationsEnabled
                        ? 'transition-all duration-200 ease-in-out data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down'
                        : '[transition:none!important] [animation:none!important]',
                    )}
                  >
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {visibleItems.map((item) => {
                          const Icon = item.icon;
                          const itemActive = isItemOrSubitemActive(item);

                          if (item.subItems) {
                            const visibleSubItems = item.subItems.filter(canAccess);
                            if (visibleSubItems.length === 0) return null;

                            return (
                              <Collapsible key={item.key} defaultOpen={itemActive} className="group/collapsible">
                                <SidebarMenuItem>
                                  <CollapsibleTrigger asChild>
                                    <SidebarMenuButton tooltip={t(item.key)} isActive={itemActive}>
                                      <Icon className="size-4 shrink-0" />
                                      <span className="truncate">{t(item.key)}</span>
                                      <ChevronRight className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                    </SidebarMenuButton>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <SidebarMenuSub>
                                      {visibleSubItems.map((subItem) => {
                                        const SubIcon = subItem.icon;
                                        const subActive = isActive(subItem.href);
                                        return (
                                          <SidebarMenuSubItem key={subItem.href}>
                                            <SidebarMenuSubButton asChild isActive={subActive}>
                                              <Link href={subItem.href}>
                                                <SubIcon className="size-3.5 shrink-0" />
                                                <span className="truncate">{t(subItem.key)}</span>
                                              </Link>
                                            </SidebarMenuSubButton>
                                          </SidebarMenuSubItem>
                                        );
                                      })}
                                    </SidebarMenuSub>
                                  </CollapsibleContent>
                                </SidebarMenuItem>
                              </Collapsible>
                            );
                          }

                          return (
                            <SidebarMenuItem key={item.key}>
                              <SidebarMenuButton asChild tooltip={t(item.key)} isActive={itemActive}>
                                <Link href={item.href || '#'}>
                                  <Icon className="size-4 shrink-0" />
                                  <span className="truncate">{t(item.key)}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          })}
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-border px-4 lg:px-6 bg-background sticky top-0 z-40">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
            <div className="relative flex-1 max-w-md hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search patients, clients, appointments..."
                className="w-full pl-9 pr-4 py-1.5 bg-muted/50 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <BranchSelector />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  {user.preferredLocale === 'TH' ? 'TH' : 'EN'}
                  <ChevronDown className="size-3 ml-1" />
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

            <button className="relative p-2 text-muted-foreground hover:bg-accent rounded-lg focus-visible:outline-none">
              <Bell className="size-5" />
              <span className="absolute top-1.5 right-1.5 size-2 bg-orange-500 rounded-full" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 hover:bg-accent rounded-lg focus-visible:outline-none">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-medium text-foreground leading-none">{displayName.includes('@') ? displayName.split('@')[0] : displayName}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{user.role.replace(/_/g, ' ').toLowerCase()}</p>
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground" />
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
                  <LogOut className="size-4 mr-2" />
                  {tAuth('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
