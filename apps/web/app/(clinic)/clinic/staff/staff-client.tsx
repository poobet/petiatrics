'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@petiatrics/ui';
import { Badge } from '@petiatrics/ui';
import { Button } from '@petiatrics/ui';
import { Input } from '@petiatrics/ui';
import { Label } from '@petiatrics/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@petiatrics/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@petiatrics/ui';
import { Checkbox } from '@petiatrics/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@petiatrics/ui';
import { MoreHorizontal, Plus, Loader2 } from 'lucide-react';
import { apiClient } from '../../../../lib/api-client';
import { useSessionStore } from '../../../../lib/session-store';

interface StaffUser {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  role: string;
  status: string;
  permissions?: string[];
}

const PERMISSION_GROUPS = [
  {
    title: 'Clinical Permissions',
    permissions: [
      { id: 'VIEW_PATIENTS', label: 'View Patients', desc: 'Allows searching, viewing, and reading patient profiles.' },
      { id: 'EDIT_PATIENTS', label: 'Edit Patients', desc: 'Allows creating, updating, and deleting patient profiles.' },
      { id: 'MANAGE_VISITS', label: 'Manage Visits', desc: 'Allows creating, updating, and finalizing SOAP visit notes.' },
      { id: 'MANAGE_VACCINATIONS', label: 'Manage Vaccinations', desc: 'Allows administering and logging vaccinations.' },
    ],
  },
  {
    title: 'Inventory Permissions',
    permissions: [
      { id: 'VIEW_INVENTORY', label: 'View Inventory', desc: 'Allows viewing stock balances, product catalog, and ledger.' },
      { id: 'MANAGE_INVENTORY', label: 'Manage Inventory', desc: 'Allows performing stock adjustments and goods receipt.' },
    ],
  },
  {
    title: 'Billing Permissions',
    permissions: [
      { id: 'VIEW_BILLING', label: 'View Billing', desc: 'Allows reading invoices, payment history, and financial logs.' },
      { id: 'MANAGE_BILLING', label: 'Manage Billing', desc: 'Allows creating, paying, and voiding invoices.' },
    ],
  },
  {
    title: 'Settings Permissions',
    permissions: [
      { id: 'MANAGE_SETTINGS', label: 'Manage Settings', desc: 'Allows managing clinic settings, branches, and staff permission matrices.' },
    ],
  },
];

export default function StaffPageClient() {
  const t = useTranslations('staff');
  const tCommon = useTranslations('common');
  const clinicSlug = useSessionStore((s) => s.user?.clinicSlug ?? '');

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [usernamePrefix, setUsernamePrefix] = useState('');
  const [name, setName] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [role, setRole] = useState('VET');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [updatingPermissions, setUpdatingPermissions] = useState(false);

  async function handleSavePermissions() {
    if (!selectedStaff) return;
    setUpdatingPermissions(true);
    try {
      const updated = await apiClient.put<StaffUser>(`/clinic/staff/${selectedStaff.id}/permissions`, {
        permissions: selectedPermissions,
      });
      setStaff((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
      setPermissionsOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingPermissions(false);
    }
  }

  useEffect(() => {
    apiClient
      .get<StaffUser[]>('/clinic/staff')
      .then(setStaff)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const newUser = await apiClient.post<StaffUser>('/clinic/staff', {
        usernamePrefix,
        name,
        temporaryPassword,
        role,
      });
      setStaff((prev) => [...prev, newUser]);
      setCreateOpen(false);
      setUsernamePrefix('');
      setName('');
      setTemporaryPassword('');
      setRole('VET');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeactivate(userId: string) {
    setBusy(userId);
    try {
      const updated = await apiClient.delete<StaffUser>(`/clinic/staff/${userId}`);
      setStaff((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } finally {
      setBusy(null);
    }
  }

  function roleLabel(role: string) {
    const map: Record<string, string> = {
      SUPER_ADMIN: t('roles.platform_admin'),
      CLINIC_OWNER: t('roles.clinic_admin'),
      VET: t('roles.vet'),
      ASSISTANT: t('roles.receptionist'),
      CASHIER: t('roles.receptionist'),
      STAFF: t('roles.receptionist'),
    };
    return map[role] ?? role;
  }

  function statusVariant(status: string) {
    if (status === 'ACTIVE') return 'default';
    if (status === 'INACTIVE') return 'secondary';
    return 'outline';
  }

  const canCreate = usernamePrefix.trim().length >= 2 && name.trim() && temporaryPassword.length >= 8;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              {t('new')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('new')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>{t('name')}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Smith"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('usernamePrefix')}</Label>
                <div className="flex items-center gap-1">
                  <Input
                    value={usernamePrefix}
                    onChange={(e) => setUsernamePrefix(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="drsmith"
                    className="flex-1"
                  />
                  {clinicSlug && (
                    <span className="text-sm text-gray-500 whitespace-nowrap">@{clinicSlug}</span>
                  )}
                </div>
                {usernamePrefix && clinicSlug && (
                  <p className="text-xs text-gray-400">
                    {t('usernamePreview')}: <span className="font-mono text-gray-600">{usernamePrefix}@{clinicSlug}</span>
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{t('temporaryPassword')}</Label>
                <Input
                  type="password"
                  value={temporaryPassword}
                  onChange={(e) => setTemporaryPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <p className="text-xs text-gray-400">{t('temporaryPasswordHint')}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t('role')}</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VET">{t('roles.vet')}</SelectItem>
                    <SelectItem value="ASSISTANT">{t('roles.receptionist')}</SelectItem>
                    <SelectItem value="CASHIER">{t('roles.receptionist')}</SelectItem>
                    <SelectItem value="CLINIC_OWNER">{t('roles.clinic_admin')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                disabled={creating || !canCreate}
                onClick={handleCreate}
              >
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('new')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('username')}</TableHead>
              <TableHead>{t('role')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead className="text-right">{tCommon('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                </TableCell>
              </TableRow>
            )}
            {!loading && staff.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                  {t('noStaff')}
                </TableCell>
              </TableRow>
            )}
            {staff.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="font-mono text-sm text-gray-600">{user.username ?? user.email ?? '-'}</TableCell>
                <TableCell>{roleLabel(user.role)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(user.status) as any}>{user.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={busy === user.id}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedStaff(user);
                          setSelectedPermissions(user.permissions || []);
                          setPermissionsOpen(true);
                        }}
                      >
                        Edit Permissions
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => handleDeactivate(user.id)}
                      >
                        {t('deactivate')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Permissions Dialog */}
      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Permissions — {selectedStaff?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <p className="text-sm text-gray-500">
              Configure granular module-level overrides for this staff member. If no custom permissions are selected, the system falls back to default role permissions.
            </p>

            <div className="space-y-6">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.title} className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-1.5">{group.title}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.permissions.map((perm) => {
                      const isChecked = selectedPermissions.includes(perm.id);
                      return (
                        <div key={perm.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                          <Checkbox
                            id={perm.id}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedPermissions(prev => [...prev, perm.id]);
                              } else {
                                setSelectedPermissions(prev => prev.filter(p => p !== perm.id));
                              }
                            }}
                          />
                          <div className="space-y-1">
                            <Label htmlFor={perm.id} className="text-sm font-medium leading-none cursor-pointer">
                              {perm.label}
                            </Label>
                            <p className="text-xs text-gray-500 leading-normal">{perm.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 border-t pt-4">
              <Button variant="outline" onClick={() => setPermissionsOpen(false)} disabled={updatingPermissions}>
                {tCommon('cancel')}
              </Button>
              <Button onClick={handleSavePermissions} disabled={updatingPermissions}>
                {updatingPermissions && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {tCommon('save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

