'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Shield, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@petiatrics/ui';
import { Button } from '@petiatrics/ui';
import { Checkbox } from '@petiatrics/ui';
import { Label } from '@petiatrics/ui';
import { Badge } from '@petiatrics/ui';
import { apiClient } from '../../../../../lib/api-client';

// ─── Permission Groups ──────────────────────────────────────────────────────

interface PermissionEntry {
  id: string;
  label: string;
  desc: string;
}

interface PermissionGroup {
  title: string;
  permissions: PermissionEntry[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: 'Patients',
    permissions: [
      { id: 'PATIENT:VIEW', label: 'View Patients', desc: 'Search and read patient profiles.' },
      { id: 'PATIENT:EDIT', label: 'Add / Edit Patients', desc: 'Create and update patient records.' },
    ],
  },
  {
    title: 'Visits & Vaccinations',
    permissions: [
      { id: 'VISIT:VIEW', label: 'View Visits', desc: 'Read SOAP visit notes.' },
      { id: 'VISIT:ADD', label: 'Create Visits', desc: 'Open new visit / SOAP notes.' },
      { id: 'VISIT:EDIT', label: 'Edit & Finalize Visits', desc: 'Update and finalize visit notes.' },
      { id: 'VACCINATION:ADD', label: 'Log Vaccinations', desc: 'Record vaccination events.' },
    ],
  },
  {
    title: 'Inventory',
    permissions: [
      { id: 'INVENTORY:VIEW', label: 'View Inventory', desc: 'View stock, products, and ledger.' },
      { id: 'INVENTORY:ADD', label: 'Add Stock', desc: 'Receive goods and post new movements.' },
      { id: 'INVENTORY:EDIT', label: 'Edit Products', desc: 'Update product details and adjustments.' },
      { id: 'INVENTORY:DELETE', label: 'Deactivate Items', desc: 'Deactivate products from active catalog.' },
    ],
  },
  {
    title: 'Billing',
    permissions: [
      { id: 'BILLING:VIEW', label: 'View Billing', desc: 'Read invoices and payment history.' },
      { id: 'BILLING:ADD', label: 'Create Invoices', desc: 'Create draft invoices.' },
      { id: 'BILLING:EDIT', label: 'Process Payments', desc: 'Mark invoices as issued or paid.' },
      { id: 'BILLING:VOID', label: 'Void Invoices', desc: 'Void an invoice (destructive).' },
    ],
  },
  {
    title: 'Settings',
    permissions: [
      { id: 'SETTINGS:MANAGE', label: 'Manage Settings', desc: 'Manage clinic settings and role permissions.' },
    ],
  },
];

// ─── Default Role Permissions ──────────────────────────────────────────────

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  CLINIC_OWNER: [
    'PATIENT:VIEW', 'PATIENT:EDIT',
    'VISIT:VIEW', 'VISIT:ADD', 'VISIT:EDIT', 'VACCINATION:ADD',
    'INVENTORY:VIEW', 'INVENTORY:ADD', 'INVENTORY:EDIT', 'INVENTORY:DELETE',
    'BILLING:VIEW', 'BILLING:ADD', 'BILLING:EDIT', 'BILLING:VOID',
    'SETTINGS:MANAGE',
  ],
  VET: [
    'PATIENT:VIEW', 'PATIENT:EDIT',
    'VISIT:VIEW', 'VISIT:ADD', 'VISIT:EDIT', 'VACCINATION:ADD',
    'INVENTORY:VIEW',
  ],
  ASSISTANT: ['PATIENT:VIEW', 'VISIT:VIEW', 'INVENTORY:VIEW', 'BILLING:VIEW'],
  STAFF: ['PATIENT:VIEW', 'INVENTORY:VIEW', 'BILLING:VIEW'],
  CASHIER: ['PATIENT:VIEW', 'BILLING:VIEW', 'BILLING:ADD', 'BILLING:EDIT', 'BILLING:VOID'],
};

const CONFIGURABLE_ROLES = [
  { value: 'CLINIC_OWNER', label: 'Clinic Owner' },
  { value: 'VET', label: 'Veterinarian (VET)' },
  { value: 'ASSISTANT', label: 'Assistant' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'CASHIER', label: 'Cashier' },
];

// ─── Component ─────────────────────────────────────────────────────────────

interface ClinicRolePermission {
  id: string;
  clinicId: string;
  role: string;
  permissions: string[];
}

export default function RolesClient() {
  const t = useTranslations('common');

  const [selectedRole, setSelectedRole] = useState<string>('VET');
  const [overrideList, setOverrideList] = useState<ClinicRolePermission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Fetch all clinic-specific overrides once on mount
  useEffect(() => {
    setLoadingOverrides(true);
    apiClient
      .get<ClinicRolePermission[]>('/clinic/staff/role-permissions')
      .then((list) => setOverrideList(list))
      .catch(console.error)
      .finally(() => setLoadingOverrides(false));
  }, []);

  // Sync selectedPermissions whenever role or overrideList changes
  useEffect(() => {
    const override = overrideList.find((o) => o.role === selectedRole);
    setSelectedPermissions(
      override ? override.permissions : (DEFAULT_ROLE_PERMISSIONS[selectedRole] ?? [])
    );
    setSaved(false);
  }, [selectedRole, overrideList]);

  const hasCustomOverride = overrideList.some((o) => o.role === selectedRole);
  const defaultForRole = DEFAULT_ROLE_PERMISSIONS[selectedRole] ?? [];

  function togglePermission(permId: string, checked: boolean) {
    setSelectedPermissions((prev) =>
      checked ? [...prev, permId] : prev.filter((p) => p !== permId)
    );
    setSaved(false);
  }

  function resetToDefaults() {
    setSelectedPermissions([...defaultForRole]);
    setSaved(false);
  }

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updated = await apiClient.put<ClinicRolePermission>(
        `/clinic/staff/roles/${selectedRole}/permissions`,
        { permissions: selectedPermissions }
      );
      setOverrideList((prev) => {
        const idx = prev.findIndex((o) => o.role === selectedRole);
        if (idx > -1) return prev.map((o) => (o.role === selectedRole ? updated : o));
        return [...prev, updated];
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save role permissions', err);
    } finally {
      setSaving(false);
    }
  }, [selectedRole, selectedPermissions]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Shield className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure granular permissions for each role. Changes apply to all staff with that role.
          </p>
        </div>
      </div>

      {/* Role Selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Select Role to Configure</label>
            <p className="text-xs text-gray-400">Choose a role to view and modify its permission set.</p>
          </div>
          {hasCustomOverride && (
            <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
              Custom Override Active
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedRole} onValueChange={setSelectedRole} disabled={loadingOverrides}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a role…" />
            </SelectTrigger>
            <SelectContent>
              {CONFIGURABLE_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={resetToDefaults}
            className="text-gray-500 hover:text-gray-700 gap-1.5"
            title="Reset to system defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to defaults
          </Button>
        </div>
      </div>

      {/* Permission Matrix */}
      {loadingOverrides ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.title} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
                <h2 className="text-sm font-semibold text-gray-800">{group.title}</h2>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.permissions.map((perm) => {
                  const isChecked = selectedPermissions.includes(perm.id);
                  return (
                    <div
                      key={perm.id}
                      className={`
                        flex items-start gap-3 p-3.5 rounded-lg border transition-all cursor-pointer
                        ${isChecked
                          ? 'border-indigo-200 bg-indigo-50/60'
                          : 'border-gray-100 bg-gray-50/40 hover:bg-gray-50'
                        }
                      `}
                      onClick={() => togglePermission(perm.id, !isChecked)}
                    >
                      <Checkbox
                        id={perm.id}
                        checked={isChecked}
                        onCheckedChange={(checked) => togglePermission(perm.id, !!checked)}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5 select-none">
                        <Label
                          htmlFor={perm.id}
                          className="text-sm font-medium leading-none cursor-pointer text-gray-800"
                        >
                          {perm.label}
                        </Label>
                        <p className="text-xs text-gray-500 leading-relaxed">{perm.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sticky Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            Configuring permissions for{' '}
            <span className="font-semibold text-gray-800">
              {CONFIGURABLE_ROLES.find((r) => r.value === selectedRole)?.label ?? selectedRole}
            </span>
          </p>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Saved
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={saving || loadingOverrides}
              className="min-w-[120px] bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {saving ? 'Saving…' : t('save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
