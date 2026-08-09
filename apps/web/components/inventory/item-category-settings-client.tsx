'use client';

import { useEffect, useState, useCallback } from 'react';
import { Layers, Plus, Edit2, Trash2, CheckCircle, AlertCircle, Lock, RefreshCw, BookOpen } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@petiatrics/ui';
import { apiClient, ApiError } from '../../lib/api-client';

interface GLAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface ItemCategory {
  id: string;
  clinicId: string | null;
  code: string;
  name: string;
  revenueGlAccountId: string | null;
  expenseGlAccountId: string | null;
  isSystem: boolean;
  isActive: boolean;
  isOverride?: boolean;
  revenueGlAccount?: GLAccount | null;
  expenseGlAccount?: GLAccount | null;
}

export default function ItemCategorySettingsClient() {
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: '',
    name: '',
    revenueGlAccountId: '',
    expenseGlAccountId: '',
  });

  // Edit modal state
  const [editTarget, setEditTarget] = useState<ItemCategory | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    revenueGlAccountId: 'NONE',
    expenseGlAccountId: 'NONE',
  });

  // Delete modal state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [fetchedCats, fetchedGls] = await Promise.all([
        apiClient.get<ItemCategory[]>('/inventory/item-categories'),
        apiClient.get<GLAccount[]>('/accounting/gl-accounts'),
      ]);
      setCategories(fetchedCats || []);
      setGlAccounts(fetchedGls || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openEdit(category: ItemCategory) {
    setEditTarget(category);
    setEditForm({
      name: category.name,
      revenueGlAccountId: category.revenueGlAccountId || 'NONE',
      expenseGlAccountId: category.expenseGlAccountId || 'NONE',
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await apiClient.post('/inventory/item-categories', {
        code: createForm.code.toUpperCase().trim(),
        name: createForm.name.trim(),
        revenueGlAccountId: createForm.revenueGlAccountId || undefined,
        expenseGlAccountId: createForm.expenseGlAccountId || undefined,
      });
      setSuccess(`สร้างหมวดหมู่ ${createForm.name} สำเร็จ`);
      setIsCreateOpen(false);
      setCreateForm({ code: '', name: '', revenueGlAccountId: '', expenseGlAccountId: '' });
      fetchData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'สร้างหมวดหมู่ไม่สำเร็จ');
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setError('');
    setSuccess('');

    try {
      await apiClient.patch(`/inventory/item-categories/${editTarget.id}`, {
        name: editForm.name.trim(),
        revenueGlAccountId: editForm.revenueGlAccountId === 'NONE' ? null : editForm.revenueGlAccountId,
        expenseGlAccountId: editForm.expenseGlAccountId === 'NONE' ? null : editForm.expenseGlAccountId,
      });
      setSuccess(`บันทึกการตั้งค่าหมวดหมู่ ${editTarget.name} สำเร็จ`);
      setEditTarget(null);
      fetchData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'บันทึกไม่สำเร็จ');
    }
  }

  async function handleDelete(id: string) {
    setError('');
    setSuccess('');
    try {
      await apiClient.delete(`/inventory/item-categories/${id}`);
      setSuccess('ปิดการใช้งานหมวดหมู่เรียบร้อยแล้ว');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ลบไม่สำเร็จ');
    }
  }

  const revenueAccounts = glAccounts.filter((a) => a.type === 'REVENUE');
  const expenseAccounts = glAccounts.filter((a) => a.type === 'EXPENSE' || a.type === 'COGS');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="text-base font-semibold text-gray-900">หมวดหมู่สินค้า & ผูกบัญชี GL (Item Categories & GL Mapping)</h3>
            <p className="text-sm text-muted-foreground">
              กำหนดหมวดหมู่สินค้าประจำคลินิก และผูกบัญชีรายได้/ต้นทุนขายสำหรับบันทึกบัญชีอัตโนมัติ
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> เพิ่มหมวดหมู่สินค้า
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      ) : categories.length === 0 ? (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
          ไม่พบข้อมูลหมวดหมู่สินค้า
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b text-xs uppercase font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">รหัส (Code)</th>
                <th className="px-4 py-3">ชื่อหมวดหมู่ (Category Name)</th>
                <th className="px-4 py-3">สถานะระบบ</th>
                <th className="px-4 py-3">บัญชีรายได้ GL (Revenue Account)</th>
                <th className="px-4 py-3">บัญชีต้นทุน GL (Expense/COGS Account)</th>
                <th className="px-4 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {categories.map((cat) => {
                const revAcc = cat.revenueGlAccount;
                const expAcc = cat.expenseGlAccount;

                return (
                  <tr key={cat.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">{cat.code}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{cat.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {cat.isSystem ? (
                          <Badge variant="secondary" className="text-[10px] gap-1 bg-gray-100 text-gray-700 border">
                            <Lock className="h-3 w-3 text-gray-500" /> ระบบ
                          </Badge>
                        ) : (
                          <Badge className="bg-purple-100 text-purple-800 text-[10px]">
                            กำหนดเอง
                          </Badge>
                        )}
                        {cat.isOverride && (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                            ⚡ กำหนดเฉพาะคลินิก (Override)
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {revAcc ? (
                        <span className="font-mono text-blue-700 dark:text-blue-400 bg-blue-50 px-2 py-1 rounded">
                          {revAcc.code} - {revAcc.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-italic">ไม่ได้ผูก</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {expAcc ? (
                        <span className="font-mono text-amber-700 dark:text-amber-400 bg-amber-50 px-2 py-1 rounded">
                          {expAcc.code} - {expAcc.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-italic">ไม่ได้ผูก</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(cat)}
                          className="h-7 px-2 text-blue-600 hover:bg-blue-50 flex items-center gap-1 text-xs"
                        >
                          <Edit2 className="h-3.5 w-3.5" /> แก้ไขผูก GL
                        </Button>
                        {!cat.isSystem && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirmId(cat.id)}
                            className="h-7 w-7 text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md bg-white border rounded-xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-gray-900">
              <Plus className="h-5 w-5 text-blue-600" />
              เพิ่มหมวดหมู่สินค้าใหม่
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              กำหนดชื่อหมวดหมู่และเลือกผูกบัญชี GL เพื่อใช้บันทึกบัญชีอัตโนมัติ
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">รหัสหมวดหมู่ (Code)</Label>
              <Input
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                placeholder="เช่น PET_FOOD"
                required
                className="font-mono uppercase text-sm border-gray-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">ชื่อหมวดหมู่ (Category Name)</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="เช่น อาหารและโภชนาการสัตว์เลี้ยง"
                required
                className="text-sm border-gray-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">บัญชีรายได้ GL (Default Revenue GL Account)</Label>
              <Select
                value={createForm.revenueGlAccountId}
                onValueChange={(val) => setCreateForm({ ...createForm, revenueGlAccountId: val })}
              >
                <SelectTrigger className="border-gray-300">
                  <SelectValue placeholder="-- เลือกบัญชีรายได้ --" />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-md max-h-52 overflow-y-auto">
                  {revenueAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <span className="font-mono font-bold mr-2">{acc.code}</span> {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">บัญชีต้นทุน/ค่าใช้จ่าย GL (Default Expense GL Account)</Label>
              <Select
                value={createForm.expenseGlAccountId}
                onValueChange={(val) => setCreateForm({ ...createForm, expenseGlAccountId: val })}
              >
                <SelectTrigger className="border-gray-300">
                  <SelectValue placeholder="-- เลือกบัญชีต้นทุน --" />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-md max-h-52 overflow-y-auto">
                  {expenseAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <span className="font-mono font-bold mr-2">{acc.code}</span> {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-3 border-t flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                สร้างหมวดหมู่สินค้า
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md bg-white border rounded-xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              ตั้งค่าหมวดหมู่ — {editTarget?.code}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              แก้ไขชื่อหมวดหมู่และเลือกผูกบัญชี GL เพื่อเปิดใช้งานบันทึกสมุดรายวันอัตโนมัติ
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">ชื่อหมวดหมู่ (Category Name)</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                className="text-sm border-gray-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">บัญชีรายได้ GL (Default Revenue Account)</Label>
              <Select
                value={editForm.revenueGlAccountId}
                onValueChange={(val) => setEditForm({ ...editForm, revenueGlAccountId: val })}
              >
                <SelectTrigger className="border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-md max-h-52 overflow-y-auto">
                  <SelectItem value="NONE">-- ไม่ผูกบัญชี --</SelectItem>
                  {revenueAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <span className="font-mono font-bold mr-2">{acc.code}</span> {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">บัญชีต้นทุน/ค่าใช้จ่าย GL (Default Expense Account)</Label>
              <Select
                value={editForm.expenseGlAccountId}
                onValueChange={(val) => setEditForm({ ...editForm, expenseGlAccountId: val })}
              >
                <SelectTrigger className="border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-md max-h-52 overflow-y-auto">
                  <SelectItem value="NONE">-- ไม่ผูกบัญชี --</SelectItem>
                  {expenseAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <span className="font-mono font-bold mr-2">{acc.code}</span> {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-3 border-t flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                บันทึกการตั้งค่า
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-md bg-white border rounded-xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> ยืนยันการปิดใช้งานหมวดหมู่
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-2">
              คุณแน่ใจหรือไม่ว่าต้องการปิดใช้งานหมวดหมู่นี้?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              ยกเลิก
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              ยืนยันปิดใช้งาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
