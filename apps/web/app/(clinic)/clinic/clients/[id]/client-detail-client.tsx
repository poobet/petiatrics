'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { apiClient, ApiError } from '@/lib/api-client';
import {
  Button,
  Badge,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@petiatrics/ui';
import { usePermission } from '@/lib/use-permission';
import { Loader2, Link2, Unlink } from 'lucide-react';
import { BusinessPartnerResponse } from '@petiatrics/types';

interface Client {
  id: string;
  name: string;
  email: string | null;
  businessPartners?: {
    id: string;
    code: string | null;
    phone: string | null;
    lineId: string | null;
    taxId: string | null;
    addressLine1: string | null;
    subDistrict: string | null;
    district: string | null;
    province: string | null;
    zipcode: string | null;
  }[];
}

interface Pet {
  _id: string;
  name: string;
  species: string;
  breed: string;
  weightKg?: number;
  createdAt: string;
}

interface BusinessPartner {
  id: string;
  name: string;
  code: string | null;
  type: string;
  user: any;
  isActive: boolean;
}

export default function ClientDetailClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [client, setClient] = useState<Client | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = usePermission('PATIENT:EDIT');

  // Edit form state
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    lineId: '',
    taxId: '',
    addressLine1: '',
    subDistrict: '',
    district: '',
    province: '',
    zipcode: '',
  });

  // Link BP state
  const [linkOpen, setLinkOpen] = useState(false);
  const [unlinkedBps, setUnlinkedBps] = useState<BusinessPartner[]>([]);
  const [selectedBpId, setSelectedBpId] = useState('');
  const [linking, setLinking] = useState(false);
  const [loadingBps, setLoadingBps] = useState(false);

  async function loadData() {
    try {
      const clientData = await apiClient.get<Client>(`/clinic/clients/${id}`);
      setClient(clientData);

      const petsData = await apiClient.get<Pet[]>(`/patients?ownerUserId=${clientData.id}`);
      setPets(petsData);

      // Prepopulate form
      const bp = clientData.businessPartners?.[0];
      setForm({
        name: clientData.name,
        email: clientData.email ?? '',
        phone: bp?.phone ?? '',
        lineId: bp?.lineId ?? '',
        taxId: bp?.taxId ?? '',
        addressLine1: bp?.addressLine1 ?? '',
        subDistrict: bp?.subDistrict ?? '',
        district: bp?.district ?? '',
        province: bp?.province ?? '',
        zipcode: bp?.zipcode ?? '',
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load details');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  // Fetch unlinked BPs when opening link modal
  useEffect(() => {
    if (!linkOpen) return;
    setLoadingBps(true);
    apiClient.get<BusinessPartner[]>('/clinic/business-partners')
      .then((res) => {
        // Filter for Customer type that are active and not linked to any user
        const filtered = res.filter((p) => !p.user && p.type === 'CUSTOMER' && p.isActive);
        setUnlinkedBps(filtered);
        if (filtered.length > 0) {
          setSelectedBpId(filtered[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingBps(false));
  }, [linkOpen]);

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await apiClient.patch<Client>(`/clinic/clients/${id}`, form);
      setClient(updated);
      setEditOpen(false);
    } catch (err) {
      console.error(err);
      alert(err instanceof ApiError ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  async function handleLink() {
    if (!selectedBpId) return;
    setLinking(true);
    try {
      await apiClient.post(`/clinic/clients/${id}/link-bp`, { businessPartnerId: selectedBpId });
      await loadData();
      setLinkOpen(false);
    } catch (err) {
      console.error(err);
      alert(err instanceof ApiError ? err.message : 'Failed to link Business Partner');
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink() {
    if (!confirm('Are you sure you want to unlink this Business Partner from this client?')) return;
    try {
      await apiClient.post(`/clinic/clients/${id}/unlink-bp`, {});
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err instanceof ApiError ? err.message : 'Failed to unlink Business Partner');
    }
  }

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (error || !client) return <p className="text-destructive text-sm">{error || 'Client not found'}</p>;

  const bp = client.businessPartners?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground text-sm">
              BP Code: <span className="font-medium text-foreground">{bp?.code ?? '—'}</span>
              {bp && (
                <Link
                  href={`/clinic/business-partners/${bp.id}/edit`}
                  className="ml-2 text-primary hover:underline text-xs"
                >
                  View BP Record →
                </Link>
              )}
            </p>
            {bp ? (
              canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUnlink}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                  title="Unlink Business Partner"
                >
                  <Unlink className="w-3.5 h-3.5 mr-1" />
                  Unlink
                </Button>
              )
            ) : (
              canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLinkOpen(true)}
                  className="border-dashed border-blue-300 text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-7 px-2"
                >
                  <Link2 className="w-3.5 h-3.5 mr-1" />
                  Link to BP
                </Button>
              )
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              Edit Profile
            </Button>
          )}
          <Link href="/clinic/clients">
            <Button variant="outline">Back to Clients</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 border rounded-lg p-5 space-y-4 bg-card">
          <h2 className="font-semibold text-lg border-b pb-2">Client Profile</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground block">Email</span>
              <span className="font-medium">{client.email ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Phone</span>
              <span className="font-medium">{bp?.phone ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Line ID</span>
              <span className="font-medium">{bp?.lineId ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Tax ID</span>
              <span className="font-medium">{bp?.taxId ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Address</span>
              <span className="font-medium whitespace-pre-line">
                {bp?.addressLine1 ? (
                  <>
                    {bp.addressLine1}
                    {(bp.subDistrict || bp.district || bp.province) && '\n'}
                    {[bp.subDistrict, bp.district, bp.province].filter(Boolean).join(', ')}
                    {bp.zipcode && ` ${bp.zipcode}`}
                  </>
                ) : (
                  '—'
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="col-span-2 border rounded-lg p-5 space-y-4 bg-card">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-lg">Patients / Pets</h2>
            {canEdit && (
              <Link href={`/clinic/patients/new?ownerId=${client.id}`}>
                <Button size="sm">+ Add Pet</Button>
              </Link>
            )}
          </div>

          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Pet Name</th>
                  <th className="text-left px-4 py-2.5 font-medium">Species / Breed</th>
                  <th className="text-left px-4 py-2.5 font-medium">Weight</th>
                  <th className="px-4 py-2.5 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {pets.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No pets registered for this client.
                    </td>
                  </tr>
                )}
                {pets.map((pet) => (
                  <tr key={pet._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{pet.name}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="capitalize">{pet.species}</Badge>
                        {pet.breed && <span className="text-muted-foreground text-xs">{pet.breed}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {pet.weightKg != null ? `${pet.weightKg} kg` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/clinic/patients/${pet._id}`} className="text-primary hover:underline text-xs font-semibold">
                        View History
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white p-6 border rounded-xl shadow-xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-bold">Edit Client Profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="editName">Full Name *</Label>
              <Input
                id="editName"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="editEmail">Email Address</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="editPhone">Phone Number</Label>
                <Input
                  id="editPhone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="editLineId">Line ID</Label>
                <Input
                  id="editLineId"
                  value={form.lineId}
                  onChange={(e) => setForm({ ...form, lineId: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="editTaxId">Tax ID (TIN)</Label>
                <Input
                  id="editTaxId"
                  value={form.taxId}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="editAddress">Address Line 1</Label>
              <Input
                id="editAddress"
                value={form.addressLine1}
                onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="editSubDistrict">Sub-District</Label>
                <Input
                  id="editSubDistrict"
                  value={form.subDistrict}
                  onChange={(e) => setForm({ ...form, subDistrict: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="editDistrict">District</Label>
                <Input
                  id="editDistrict"
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="editProvince">Province</Label>
                <Input
                  id="editProvince"
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="editZipcode">Zip Code</Label>
                <Input
                  id="editZipcode"
                  value={form.zipcode}
                  onChange={(e) => setForm({ ...form, zipcode: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !form.name.trim()}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Link Business Partner Dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md bg-white p-6 border rounded-xl shadow-xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-bold">Link Business Partner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Select an unlinked Customer Business Partner in this clinic to associate with this client account.
            </p>
            {loadingBps ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              </div>
            ) : unlinkedBps.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg text-xs text-yellow-800">
                No unlinked Customer Business Partners found in this clinic. Add one under Business Partners menu first.
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Choose Business Partner</Label>
                <Select value={selectedBpId} onValueChange={setSelectedBpId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {unlinkedBps.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.code ? `(${p.code})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLink}
              disabled={linking || loadingBps || unlinkedBps.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {linking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Link Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
