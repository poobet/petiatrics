import { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  Activity,
  Calendar,
  TrendingUp,
  Users,
  Clock,
  ArrowUpRight,
  DollarSign,
  PawPrint,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@petiatrics/ui';
import { Badge } from '@petiatrics/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@petiatrics/ui/avatar';
import { Button } from '@petiatrics/ui/button';
import { RevenueChart } from './_components/revenue-chart';
import { AppointmentTypesChart } from './_components/appointment-types-chart';
import type { RevenueDataPoint } from './_components/revenue-chart';
import type { AppointmentTypeDataPoint } from './_components/appointment-types-chart';

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

interface Patient {
  _id: string;
  name: string;
  species: string;
  breed: string;
  photoUrl?: string;
}

async function getSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('petiatrics_sid')?.value ?? null;
}

async function getTodayAppointments(sid: string): Promise<Appointment[]> {
  try {
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

async function getRecentPatients(sid: string): Promise<Patient[]> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/v1/clinical/patients`, {
      headers: { Cookie: `petiatrics_sid=${sid}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (Array.isArray(json) ? json : (json.data ?? [])).slice(0, 4);
  } catch {
    return [];
  }
}

async function getLowStockCount(sid: string): Promise<number> {
  try {
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

async function getTodayRevenue(sid: string): Promise<number> {
  try {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(
      `${apiUrl}/api/v1/billing/reports?from=${from.toISOString()}&to=${to.toISOString()}`,
      { headers: { Cookie: `petiatrics_sid=${sid}` }, cache: 'no-store' },
    );
    if (!res.ok) return 0;
    const json = await res.json();
    return Math.round((json.revenueMinor ?? 0) / 100);
  } catch {
    return 0;
  }
}

async function getMonthlyRevenue(sid: string): Promise<RevenueDataPoint[]> {
  const now = new Date();
  const monthRanges = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i;
    const from = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59);
    const month = from.toLocaleString('en-US', { month: 'short' });
    return { from, to, month };
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  return Promise.all(
    monthRanges.map(async ({ from, to, month }) => {
      try {
        const res = await fetch(
          `${apiUrl}/api/v1/billing/reports?from=${from.toISOString()}&to=${to.toISOString()}`,
          { headers: { Cookie: `petiatrics_sid=${sid}` }, cache: 'no-store' },
        );
        if (!res.ok) return { month, revenue: 0 };
        const json = await res.json();
        return { month, revenue: Math.round((json.revenueMinor ?? 0) / 100) };
      } catch {
        return { month, revenue: 0 };
      }
    }),
  );
}

const APPOINTMENT_STATUS_STYLES: Record<
  string,
  { iconBg: string; iconColor: string; badge: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  REQUESTED: { iconBg: 'bg-gray-100', iconColor: 'text-gray-600', badge: 'outline' },
  CONFIRMED: { iconBg: 'bg-blue-100', iconColor: 'text-blue-600', badge: 'default' },
  IN_PROGRESS: { iconBg: 'bg-orange-100', iconColor: 'text-orange-600', badge: 'default' },
  COMPLETED: { iconBg: 'bg-green-100', iconColor: 'text-green-600', badge: 'secondary' },
  CANCELLED: { iconBg: 'bg-red-100', iconColor: 'text-red-400', badge: 'destructive' },
};

const STATUS_CHART_COLORS: Record<string, string> = {
  REQUESTED: '#9ca3af',
  CONFIRMED: '#3b82f6',
  IN_PROGRESS: '#f97316',
  COMPLETED: '#8b5cf6',
  CANCELLED: '#ef4444',
};

export default async function ClinicDashboardPage() {
  const sid = await getSessionCookie();
  if (!sid) return null;

  const [todayAppointments, recentPatients, lowStockCount, todayRevenue, monthlyRevenue] =
    await Promise.all([
      getTodayAppointments(sid),
      getRecentPatients(sid),
      getLowStockCount(sid),
      getTodayRevenue(sid),
      getMonthlyRevenue(sid),
    ]);

  const nonCancelled = todayAppointments.filter((a) => a.status !== 'CANCELLED');
  const inProgress = todayAppointments.filter((a) => a.status === 'IN_PROGRESS');
  const upcomingAppointments = nonCancelled.slice(0, 5);

  const statusDist: AppointmentTypeDataPoint[] = Object.entries(
    todayAppointments.reduce<Record<string, number>>((acc, apt) => {
      acc[apt.status] = (acc[apt.status] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([status, value]) => ({
      name: status.replace(/_/g, ' '),
      value,
      color: STATUS_CHART_COLORS[status] ?? '#9ca3af',
    }))
    .filter((d) => d.value > 0);

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here&#39;s what&#39;s happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600">Today&#39;s Appointments</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{nonCancelled.length}</p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">vs yesterday</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600">Patients in Clinic</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{inProgress.length}</p>
                <div className="flex items-center gap-1 mt-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-gray-600 font-medium">In progress</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <PawPrint className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600">Today&#39;s Revenue</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">
                  &#3647;{todayRevenue.toLocaleString()}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">Collected today</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600">Low Stock Alerts</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{lowStockCount}</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-600 font-medium">Items to reorder</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two-column: Appointments + Recent Patients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Appointments */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Today&#39;s Appointments</CardTitle>
                <CardDescription>{todayStr}</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/clinic/appointments">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length === 0 ? (
              <p className="text-center text-gray-400 py-8">
                No appointments scheduled for today.
              </p>
            ) : (
              <div className="space-y-4">
                {upcomingAppointments.map((apt) => {
                  const styles =
                    APPOINTMENT_STATUS_STYLES[apt.status] ??
                    APPOINTMENT_STATUS_STYLES.REQUESTED;
                  return (
                    <div
                      key={apt.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="shrink-0">
                        <div
                          className={`w-12 h-12 rounded-lg flex items-center justify-center ${styles.iconBg}`}
                        >
                          <Clock className={`w-6 h-6 ${styles.iconColor}`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">{apt.reason}</p>
                          <Badge variant={styles.badge} className="text-xs shrink-0">
                            {apt.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          {apt.durationMinutes} min
                          {apt.vetUserId ? ` · Vet: ${apt.vetUserId.slice(0, 8)}…` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(apt.scheduledAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Patients */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Patients</CardTitle>
            <CardDescription>Latest check-ins</CardDescription>
          </CardHeader>
          <CardContent>
            {recentPatients.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No patients found.</p>
            ) : (
              <div className="space-y-4">
                {recentPatients.map((pet) => (
                  <div key={pet._id} className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 rounded-xl">
                      {pet.photoUrl && <AvatarImage src={pet.photoUrl} alt={pet.name} />}
                      <AvatarFallback>{pet.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{pet.name}</p>
                      <p className="text-sm text-gray-600">{pet.breed}</p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="bg-blue-100 text-blue-700 hover:bg-blue-100"
                    >
                      {pet.species}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={monthlyRevenue} />
        <AppointmentTypesChart data={statusDist} />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/clinic/appointments/new">
                <Calendar className="w-5 h-5" />
                <span>New Appointment</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/clinic/patients">
                <PawPrint className="w-5 h-5" />
                <span>Add Patient</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/clients">
                <Users className="w-5 h-5" />
                <span>Add Client</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/clinic/billing">
                <DollarSign className="w-5 h-5" />
                <span>Create Invoice</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

