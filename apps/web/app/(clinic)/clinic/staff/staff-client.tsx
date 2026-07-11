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
  Checkbox,
} from '@petiatrics/ui';
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
  roleId?: string;
  status: string;
  userBranches?: { branchId: string }[];
  permissions?: string[];
}



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
  const [role, setRole] = useState('');
  const [roles, setRoles] = useState<{ id: string; code: string; name: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Edit staff state
  const [editOpen, setEditOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editBranchIds, setEditBranchIds] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);

  const branches = useSessionStore((s) => s.authorizedBranches);





  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.get<StaffUser[]>('/clinic/staff'),
      apiClient.get<{ id: string; code: string; name: string }[]>('/clinic/roles'),
    ])
      .then(([staffData, rolesData]) => {
        setStaff(staffData);
        setRoles(rolesData);
        const vetRole = rolesData.find((r) => r.code === 'VET');
        if (vetRole) {
          setRole(vetRole.id);
        } else if (rolesData.length > 0) {
          setRole(rolesData[0].id);
        }
      })
      .catch((err) => console.error('Failed to load staff/roles:', err))
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
      const vetRole = roles.find((r) => r.code === 'VET');
      if (vetRole) {
        setRole(vetRole.id);
      } else if (roles.length > 0) {
        setRole(roles[0].id);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDeactivate(userId: string) {
    setBusy(userId);
    try {
      await apiClient.delete(`/clinic/staff/${userId}`);
      setStaff((prev) => prev.filter((u) => u.id !== userId));
    } finally {
      setBusy(null);
    }
  }

  async function handleEditSubmit() {
    if (!editingStaff) return;
    setUpdating(true);
    try {
      await apiClient.patch(`/clinic/staff/${editingStaff.id}/role`, {
        name: editName,
        role: editRole,
        branchIds: editBranchIds,
      });
      // Refresh staff list
      const data = await apiClient.get<StaffUser[]>('/clinic/staff');
      setStaff(data);
      setEditOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  }

  function roleLabel(roleCode: string) {
    const found = roles.find((r) => r.code === roleCode);
    if (found) return found.name;

    const map: Record<string, string> = {
      SUPER_ADMIN: t('roles.platform_admin'),
      CLINIC_OWNER: t('roles.clinic_admin'),
      VET: t('roles.vet'),
      ASSISTANT: t('roles.receptionist'),
      CASHIER: t('roles.receptionist'),
      STAFF: t('roles.receptionist'),
    };
    return map[roleCode] ?? roleCode;
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
        <div className="flex items-center gap-2">

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
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
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
                          setEditingStaff(user);
                          setEditName(user.name);
                          setEditRole(user.roleId || user.role);
                          setEditBranchIds(user.userBranches?.map((ub) => ub.branchId) || []);
                          setEditOpen(true);
                        }}
                      >
                        {tCommon('edit')}
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


      {/* Edit Staff Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff — {editingStaff?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>{t('name')}</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('role')}</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Branches</Label>
              <div className="space-y-2 border rounded-lg p-3 bg-gray-50/50">
                {branches.map((b) => {
                  const checked = editBranchIds.includes(b.id);
                  return (
                    <div key={b.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-branch-${b.id}`}
                        checked={checked}
                        onCheckedChange={(val) => {
                          if (val) {
                            setEditBranchIds((prev) => [...prev, b.id]);
                          } else {
                            setEditBranchIds((prev) => prev.filter((id) => id !== b.id));
                          }
                        }}
                      />
                      <Label htmlFor={`edit-branch-${b.id}`} className="cursor-pointer font-normal text-sm">
                        {b.name}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
            <Button
              className="w-full"
              disabled={updating || !editName.trim()}
              onClick={handleEditSubmit}
            >
              {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {tCommon('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

