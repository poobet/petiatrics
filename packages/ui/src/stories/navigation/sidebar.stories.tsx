import type { Meta, StoryObj } from '@storybook/react';
import {
  CalendarIcon,
  ChartBarIcon,
  HomeIcon,
  PawPrintIcon,
  Settings2Icon,
  UsersIcon,
} from 'lucide-react';
import {
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
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '../../sidebar';
import { Separator } from '../../separator';
import { Avatar, AvatarFallback } from '../../avatar';

const meta = {
  title: 'Navigation/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

const navItems = [
  { label: 'Dashboard', icon: HomeIcon, href: '#' },
  { label: 'Patients', icon: PawPrintIcon, href: '#' },
  { label: 'Appointments', icon: CalendarIcon, href: '#' },
  { label: 'Staff', icon: UsersIcon, href: '#' },
  { label: 'Analytics', icon: ChartBarIcon, href: '#' },
  { label: 'Settings', icon: Settings2Icon, href: '#' },
];

export const Default: Story = {
  render: () => (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-primary flex items-center justify-center">
              <PawPrintIcon className="size-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">Petiatrics</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Clinic</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton asChild>
                      <a href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3">
          <Separator className="mb-3" />
          <div className="flex items-center gap-2 px-1">
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">DR</AvatarFallback>
            </Avatar>
            <div className="text-left text-xs">
              <p className="font-medium">Dr. Somchai</p>
              <p className="text-muted-foreground">Veterinarian</p>
            </div>
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-muted-foreground">Dashboard</span>
        </header>
        <main className="flex-1 p-6">
          <p className="text-muted-foreground text-sm">
            Click the trigger button or drag the rail to resize the sidebar.
          </p>
        </main>
      </SidebarInset>
    </SidebarProvider>
  ),
};

export const Collapsed: Story = {
  render: () => (
    <SidebarProvider defaultOpen={false}>
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-primary flex items-center justify-center">
              <PawPrintIcon className="size-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">Petiatrics</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.slice(0, 4).map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton asChild tooltip={item.label}>
                      <a href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-muted-foreground">Patients</span>
        </header>
        <main className="flex-1 p-6">
          <p className="text-muted-foreground text-sm">Sidebar starts collapsed.</p>
        </main>
      </SidebarInset>
    </SidebarProvider>
  ),
};
