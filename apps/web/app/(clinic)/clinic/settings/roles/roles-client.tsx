'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Shield,
  CheckCircle2,
  Loader2,
  Lock,
  Plus,
  Trash2,
  AlertCircle,
  Settings,
} from 'lucide-react';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@petiatrics/ui';
import { apiClient } from '../../../../../lib/api-client';

interface ActionMaster {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

interface PageMaster {
  id: string;
  code: string;
  name: string;
  description: string | null;
  actions: ActionMaster[];
}

interface ClinicRole {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
  isDeletable: boolean;
  _count?: { users: number };
}

interface AssignedPermission {
  pageCode: string;
  pageName: string;
  actionCode: string | null;
  actionName: string | null;
}

export default function RolesClient() {
  const t = useTranslations('common');

  // Core state
  const [roles, setRoles] = useState<ClinicRole[]>([]);
  const [pages, setPages] = useState<PageMaster[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Create role dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);

  // Fetch initial roles and page master registry
  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      try {
        const [rolesList, pagesList] = await Promise.all([
          apiClient.get<ClinicRole[]>('/clinic/roles'),
          apiClient.get<PageMaster[]>('/clinic/pages'),
        ]);
        setRoles(rolesList);
        setPages(pagesList);
        if (rolesList.length > 0) {
          setSelectedRoleId(rolesList[0].id);
        }
      } catch (err) {
        console.error('Failed to load roles and permissions registry:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // Fetch permissions when active role changes
  useEffect(() => {
    if (!selectedRoleId) return;
    setLoadingPermissions(true);
    setSaved(false);
    setErrorMessage(null);

    apiClient
      .get<AssignedPermission[]>(`/clinic/roles/${selectedRoleId}/permissions`)
      .then((perms) => {
        // Collect all non-null action codes
        const codes = perms
          .filter((p) => p.actionCode)
          .map((p) => p.actionCode as string);
        setSelectedPermissions(codes);
      })
      .catch((err) => {
        console.error('Failed to load role permissions:', err);
      })
      .finally(() => {
        setLoadingPermissions(false);
      });
  }, [selectedRoleId]);

  const activeRole = roles.find((r) => r.id === selectedRoleId);
  const isOwner = activeRole?.code === 'CLINIC_OWNER';
  const isSystemRole = activeRole?.isSystem === true;

  // Toggle permission checkbox
  function togglePermission(actionCode: string, checked: boolean) {
    if (isOwner) return; // Read-only for owner role
    setSelectedPermissions((prev) =>
      checked ? [...prev, actionCode] : prev.filter((code) => code !== actionCode)
    );
    setSaved(false);
  }

  // Toggle all permissions inside a page group
  function togglePageAll(page: PageMaster, checked: boolean) {
    if (isOwner) return;
    const actionCodes = page.actions.map((a) => a.code);
    setSelectedPermissions((prev) => {
      if (checked) {
        // Add missing ones
        const unique = new Set([...prev, ...actionCodes]);
        return Array.from(unique);
      } else {
        // Remove all
        return prev.filter((code) => !actionCodes.includes(code));
      }
    });
    setSaved(false);
  }

  // Handle Save
  const handleSave = useCallback(async () => {
    if (!selectedRoleId || isOwner) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      await apiClient.put(`/clinic/roles/${selectedRoleId}/permissions`, {
        permissions: selectedPermissions,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error('Failed to save role permissions:', err);
      setErrorMessage(err?.message ?? 'Failed to update permissions.');
    } finally {
      setSaving(false);
    }
  }, [selectedRoleId, selectedPermissions, isOwner]);

  // Handle Create Role
  async function handleCreateRole() {
    if (!newRoleName.trim()) return;
    setCreatingRole(true);
    setErrorMessage(null);
    try {
      const created = await apiClient.post<ClinicRole>('/clinic/roles', {
        name: newRoleName.trim(),
      });
      setRoles((prev) => [...prev, created]);
      setSelectedRoleId(created.id);
      setNewRoleName('');
      setCreateOpen(false);
    } catch (err: any) {
      console.error('Failed to create custom role:', err);
      setErrorMessage(err?.message ?? 'Role creation failed.');
    } finally {
      setCreatingRole(false);
    }
  }

  // Handle Delete Role
  async function handleDeleteRole(roleId: string, e: React.MouseEvent) {
    e.stopPropagation(); // Avoid selecting role on click
    if (!confirm('Are you sure you want to delete this custom role? This action cannot be undone.')) {
      return;
    }
    setErrorMessage(null);
    try {
      await apiClient.delete(`/clinic/roles/${roleId}`);
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      if (selectedRoleId === roleId && roles.length > 0) {
        const remaining = roles.filter((r) => r.id !== roleId);
        if (remaining.length > 0) {
          setSelectedRoleId(remaining[0].id);
        }
      }
    } catch (err: any) {
      console.error('Failed to delete role:', err);
      alert(err?.message ?? 'Failed to delete role. Ensure no users are assigned to this role.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage roles and customize page-action security settings for clinic staff.
            </p>
          </div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all duration-150">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Custom Role
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-white border rounded-xl shadow-2xl p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-lg font-bold text-gray-900">Create Custom Role</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="roleName" className="text-sm font-semibold text-gray-700">Role Name</Label>
                <Input
                  id="roleName"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Senior Vet Nurse"
                  className="w-full focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <DialogFooter className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creatingRole}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateRole}
                disabled={creatingRole || !newRoleName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4"
              >
                {creatingRole && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Main Grid: Left sidebar, Right detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Roles List */}
        <div className="lg:col-span-4 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-sm font-bold text-gray-800">Clinic Roles</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {roles.map((r) => {
              const isActive = r.id === selectedRoleId;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRoleId(r.id)}
                  className={`
                    flex items-center justify-between px-5 py-4 cursor-pointer transition-all duration-150 group
                    ${isActive ? 'bg-blue-50/70 border-l-4 border-blue-600 pl-4' : 'hover:bg-gray-50/60 border-l-4 border-transparent'}
                  `}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold transition-colors duration-150 ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                        {r.name}
                      </span>
                      {r.isSystem && (
                        <Badge className="bg-gray-100 text-gray-600 border border-gray-200 text-[10px] py-0 px-1 font-medium select-none">
                          System
                        </Badge>
                      )}
                    </div>
                    {r._count && (
                      <p className="text-xs text-gray-400">
                        {r._count.users} staff assigned
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    {r.code === 'CLINIC_OWNER' && (
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                    )}
                    {r.isDeletable && (
                      <button
                        onClick={(e) => handleDeleteRole(r.id, e)}
                        className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete custom role"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Permissions Grid Matrix */}
        <div className="lg:col-span-8 space-y-6">
          {activeRole && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-bold text-gray-900">{activeRole.name}</h2>
                  </div>
                  <p className="text-xs text-gray-500">
                    Role Code: <code className="font-mono text-gray-700 bg-gray-100 px-1 py-0.5 rounded">{activeRole.code}</code>
                  </p>
                </div>
                {isOwner && (
                  <Badge className="bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Locked Role
                  </Badge>
                )}
              </div>

              {isOwner && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 leading-normal">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Notice:</span> The Clinic Owner role possesses immutable administrative access across all screens and actions. Its permission set cannot be restricted.
                  </div>
                </div>
              )}

              {loadingPermissions ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="space-y-5">
                  {pages.map((page) => {
                    const allActionCodes = page.actions.map((a) => a.code);
                    const allChecked = allActionCodes.every((code) => selectedPermissions.includes(code));
                    const someChecked = allActionCodes.some((code) => selectedPermissions.includes(code)) && !allChecked;

                    return (
                      <div key={page.id} className="border border-gray-150 rounded-xl overflow-hidden shadow-sm bg-white">
                        {/* Page Module Title Row */}
                        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h3 className="text-sm font-bold text-gray-800">{page.name}</h3>
                            {page.description && (
                              <p className="text-xs text-gray-400">{page.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`page-select-all-${page.id}`}
                              checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                              onCheckedChange={(checked) => togglePageAll(page, !!checked)}
                              disabled={isOwner}
                            />
                            <Label
                              htmlFor={`page-select-all-${page.id}`}
                              className="text-xs font-semibold text-gray-500 cursor-pointer select-none"
                            >
                              Select All
                            </Label>
                          </div>
                        </div>

                        {/* Actions List Grid */}
                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {page.actions.map((act) => {
                            const isChecked = selectedPermissions.includes(act.code);
                            return (
                              <div
                                key={act.id}
                                onClick={() => togglePermission(act.code, !isChecked)}
                                className={`
                                  flex items-start gap-3 p-3.5 border rounded-xl transition-all duration-150
                                  ${isOwner ? 'opacity-85 border-gray-100 bg-gray-50 cursor-not-allowed' : 'cursor-pointer'}
                                  ${isChecked && !isOwner
                                    ? 'border-blue-200 bg-blue-50/40 hover:bg-blue-50/65'
                                    : !isOwner ? 'border-gray-100 bg-white hover:bg-gray-50/50' : ''
                                  }
                                `}
                              >
                                <Checkbox
                                  id={act.id}
                                  checked={isOwner || isChecked}
                                  onCheckedChange={(checked) => togglePermission(act.code, !!checked)}
                                  disabled={isOwner}
                                  className="mt-0.5 focus:ring-blue-500"
                                />
                                <div className="space-y-1 select-none">
                                  <Label
                                    htmlFor={act.id}
                                    className={`text-xs font-bold leading-none cursor-pointer ${isOwner ? 'cursor-not-allowed text-gray-600' : 'text-gray-800'}`}
                                  >
                                    {act.name}
                                  </Label>
                                  {act.description && (
                                    <p className="text-[11px] text-gray-400 leading-normal">{act.description}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Save Bar */}
      {activeRole && !isOwner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-gray-200 px-6 py-4 shadow-xl">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="text-sm text-gray-500">
              Saving changes for <span className="font-bold text-gray-800">{activeRole.name}</span>
            </div>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 font-bold animate-pulse">
                  <CheckCircle2 className="w-4 h-4" />
                  Permissions Saved
                </span>
              )}
              <Button
                onClick={handleSave}
                disabled={saving || loadingPermissions}
                className="min-w-[125px] bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md transition-all duration-150"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {saving ? 'Saving…' : 'Save Permissions'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
