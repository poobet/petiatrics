import { Metadata } from 'next';
import { apiClient } from '@/lib/api-client';
import { Building2, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@petiatrics/ui';

export const metadata: Metadata = { title: 'Dashboard | Admin | Petiatrics' };

interface Metrics {
  totalClinics: number;
  activeUsers: number;
}

export default async function AdminDashboardPage() {
  let metrics: Metrics = { totalClinics: 0, activeUsers: 0 };

  try {
    metrics = await apiClient.get<Metrics>('/admin/metrics', { cache: 'no-store' });
  } catch {
    // Show zeros on error — will be visible in UI
  }

  const kpis = [
    {
      label: 'Total Clinics',
      value: metrics.totalClinics,
      icon: Building2,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Active Users',
      value: metrics.activeUsers,
      icon: Users,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'MRR (฿)',
      value: '—',
      icon: TrendingUp,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Alerts',
      value: 0,
      icon: AlertCircle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Platform Metrics</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
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
          );
        })}
      </div>
    </div>
  );
}
