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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@petiatrics/ui';
import { MoreHorizontal, Plus, Loader2 } from 'lucide-react';
import { apiClient } from '../../../../lib/api-client';

interface StaffUser {
  id: string;
  email: string;
  role: string;
  status: string;
}

export default function StaffPageClient() {
  const t = useTranslations('staff');
  const tCommon = useTranslations('common');

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('VET');
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<StaffUser[]>('/clinic/staff')
      .then(setStaff)
      .finally(() => setLoading(false));
  }, []);

  async function handleInvite() {
    setInviting(true);
    try {
      const newUser = await apiClient.post<StaffUser>('/clinic/staff/invite', {
        email: inviteEmail,
        role: inviteRole,
      });
      setStaff((prev) => [...prev, newUser]);
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('VET');
    } finally {
      setInviting(false);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
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
                <Label>{t('email')}</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="vet@clinic.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('role')}</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
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
                disabled={inviting || !inviteEmail}
                onClick={handleInvite}
              >
                {inviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
              <TableHead>{t('email')}</TableHead>
              <TableHead>{t('role')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead className="text-right">{tCommon('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                </TableCell>
              </TableRow>
            )}
            {!loading && staff.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                  {t('noStaff')}
                </TableCell>
              </TableRow>
            )}
            {staff.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
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
    </div>
  );
}
