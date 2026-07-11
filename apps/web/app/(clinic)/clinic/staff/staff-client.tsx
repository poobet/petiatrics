'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { MoreHorizontal, Plus, Loader2, KeyRound, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '../../../../lib/api-client';
import { useSessionStore } from '../../../../lib/session-store';
import { BusinessPartnerResponse } from '@petiatrics/types';

// Used only for the Create Staff form / Reset Password dialog (still uses User table)
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
  businessPartners?: Array<{ id: string; code: string | null; type: string; isActive: boolean }>;
}


export default function StaffPageClient() {
  const t = useTranslations('staff');
  const tCommon = useTranslations('common');
  const clinicSlug = useSessionStore((s) => s.user?.clinicSlug ?? '');
  const router = useRouter();

  const [staff, setStaff] = useState<BusinessPartnerResponse[]>([]);
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

  // ── Reset-password dialog state ────────────────────────────────────────
  const [resetTarget, setResetTarget] = useState<StaffUser | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [resetPwdConfirm, setResetPwdConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);





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
      await apiClient.post<StaffUser>('/clinic/staff', {
        usernamePrefix,
        name,
        temporaryPassword,
        role,
      });
      // Reload the BP list so the newly created Staff shows up with a BP record
      const params = new URLSearchParams();
      params.append('types', 'STAFF');
      params.append('types', 'VET');
      const updated = await apiClient.get<BusinessPartnerResponse[]>(`/clinic/business-partners?${params.toString()}`);
      setStaff(updated);
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

  function openResetDialog(user: StaffUser) {
    setResetTarget(user);
    setResetPwd('');
    setResetPwdConfirm('');
    setResetError(null);
    setResetSuccess(false);
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    if (resetPwd.length < 8) { setResetError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    if (resetPwd !== resetPwdConfirm) { setResetError('รหัสผ่านไม่ตรงกัน'); return; }
    setResetting(true);
    setResetError(null);
    try {
      await apiClient.patch(`/clinic/staff/${resetTarget.id}/reset-password`, { newPassword: resetPwd });
      setResetSuccess(true);
      setTimeout(() => setResetTarget(null), 1500);
    } catch (err: any) {
      setResetError(err?.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setResetting(false);
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
      {/* ── Reset Password Dialog ──────────────────────────────────────── */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) setResetTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              รีเซ็ตรหัสผ่าน — {resetTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              ตั้งรหัสผ่านชั่วคราวใหม่ พนักงานจะต้องเปลี่ยนรหัสผ่านในครั้งถัดไปที่ล็อกอิน
            </p>
            <div className="space-y-1.5">
              <Label>รหัสผ่านใหม่</Label>
              <Input
                type="password"
                value={resetPwd}
                onChange={(e) => setResetPwd(e.target.value)}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>ยืนยันรหัสผ่าน</Label>
              <Input
                type="password"
                value={resetPwdConfirm}
                onChange={(e) => setResetPwdConfirm(e.target.value)}
                placeholder="กรอกรหัสผ่านอีกครั้ง"
              />
            </div>
            {resetError && <p className="text-sm text-destructive">{resetError}</p>}
            {resetSuccess && <p className="text-sm text-green-600">✓ รีเซ็ตรหัสผ่านสำเร็จ</p>}
            <Button
              className="w-full"
              onClick={handleResetPassword}
              disabled={resetting || resetSuccess || !resetPwd || !resetPwdConfirm}
            >
              {resetting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              ยืนยันรีเซ็ตรหัสผ่าน
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              <TableHead>BP Code</TableHead>
              <TableHead>{t('role')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead className="text-right">{tCommon('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                </TableCell>
              </TableRow>
            )}
            {!loading && staff.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                  {t('noStaff')}
                </TableCell>
              </TableRow>
            )}
            {staff.map((bp) => {
              return (
                <TableRow key={bp.id}>
                  <TableCell className="font-medium">{bp.name}</TableCell>
                  <TableCell className="font-mono text-sm text-gray-600">
                    {bp.user?.username ?? bp.user?.email ?? bp.email ?? '-'}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/clinic/business-partners/${bp.id}/edit`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {bp.code ?? 'View BP'}
                    </Link>
                  </TableCell>
                  <TableCell>{roleLabel(bp.user?.role ?? bp.type)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(bp.isActive ? 'ACTIVE' : 'INACTIVE') as any}>
                      {bp.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={busy === bp.id}>
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
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={() => router.push(`/clinic/business-partners/${bp.id}/edit`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                          ดูข้อมูล BP
                        </DropdownMenuItem>
                        {bp.user && (
                          <DropdownMenuItem
                            className="flex items-center gap-2"
                            onClick={() => openResetDialog({ id: bp.user!.id, name: bp.name, username: bp.user!.username, email: bp.user!.email, role: bp.user!.role, status: bp.user!.status })}
                          >
                            <KeyRound className="h-4 w-4" />
                            รีเซ็ตรหัสผ่าน
                          </DropdownMenuItem>
                        )}
                        {bp.user && (
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => handleDeactivate(bp.user!.id)}
                          >
                            {t('deactivate')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
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

