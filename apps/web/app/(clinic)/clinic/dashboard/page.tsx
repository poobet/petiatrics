import { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  Calendar,
  PawPrint,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@petiatrics/ui';
import { Badge } from '@petiatrics/ui/badge';
import { DashboardUserBanner } from './_components/dashboard-user-banner';

export const metadata: Metadata = { title: 'Dashboard | Petiatrics' };

interface Appointment {
  id: string;
  patientId: string;
  reason: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  vetUserId?: string;
}

async function getTodayAppointments(): Promise<Appointment[]> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get('petiatrics_sid')?.value;
    if (!sid) return [];

    const today = new Date().toISOString().slice(0, 10);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/v1/appointments?date=${today}`, {
      headers: { Cookie: `petiatrics_sid=${sid}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

async function getLowStockCount(): Promise<number> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get('petiatrics_sid')?.value;
    if (!sid) return 0;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/v1/inventory/products/low-stock`, {
      headers: { Cookie: `petiatrics_sid=${sid}` },
      cache: 'no-store',
    });
    if (!res.ok) return 0;
    const json = await res.json();
    return (json.data ?? []).length;
  } catch {
    return 0;
  }
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  REQUESTED: 'secondary',
  CONFIRMED: 'default',
  IN_PROGRESS: 'default',
  COMPLETED: 'outline',
  CANCELLED: 'destructive',
};

export default async function ClinicDashboardPage() {
  const [todayAppointments, lowStockCount] = await Promise.all([
    getTodayAppointments(),
    getLowStockCount(),
  ]);
  const nonCancelled = todayAppointments.filter((a) => a.status !== 'CANCELLED');

  const kpis = [
    {
      label: "Today's Appointments",
      value: nonCancelled.length,
      href: '/appointments',
      icon: Calendar,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Recent Patients',
      value: 0,
      href: '/patients',
      icon: PawPrint,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Pending Invoices',
      value: 0,
      href: '/billing',
      icon: CreditCard,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Low Stock Alerts',
      value: lowStockCount,
      href: '/inventory',
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="space-y-6">
      <DashboardUserBanner />
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link key={kpi.href} href={kpi.href} className="group">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    {kpi.label}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${kpi.bg}`}>
                    <Icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">{kpi.value}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/clinic/appointments/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            New Appointment
          </Link>
          <Link
            href="/clinic/patients"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <PawPrint className="w-4 h-4" />
            View Patients
          </Link>
          <Link
            href="/clinic/billing"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Billing
          </Link>
        </div>
      </div>

      {/* Today's appointments list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Today's Appointments</h2>
          <Link href="/clinic/appointments" className="text-sm text-primary hover:underline">
            View all →
          </Link>
        </div>
        {nonCancelled.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-400">
              No appointments scheduled for today.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {nonCancelled.map((appt) => (
              <Card key={appt.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums text-muted-foreground w-14">
                      {new Date(appt.scheduledAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <div>
                      <p className="font-medium text-sm">{appt.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {appt.durationMinutes} min
                        {appt.vetUserId ? ` · Vet: ${appt.vetUserId.slice(0, 8)}…` : ''}
                      </p>
                    </div>
                  </div>
                  <Badge variant={STATUS_COLORS[appt.status] ?? 'secondary'}>
                    {appt.status.replace('_', ' ')}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

