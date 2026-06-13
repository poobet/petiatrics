'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@petiatrics/ui/button';
import { Input } from '@petiatrics/ui/input';
import { Label } from '@petiatrics/ui/label';

export default function ClientCreateClient() {
  const router = useRouter();
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...form,
        email: form.email || undefined,
        phone: form.phone || undefined,
        lineId: form.lineId || undefined,
        taxId: form.taxId || undefined,
        addressLine1: form.addressLine1 || undefined,
        subDistrict: form.subDistrict || undefined,
        district: form.district || undefined,
        province: form.province || undefined,
        zipcode: form.zipcode || undefined,
      };
      const created = await apiClient.post<{ id: string }>('/clinic/clients', payload);
      router.push(`/clinic/clients/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to register client');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-6 bg-card">
      {error && <p className="text-destructive text-sm font-medium">{error}</p>}

      <div className="space-y-1.5">
        <Label htmlFor="name">Full Name *</Label>
        <Input
          id="name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="lineId">Line ID</Label>
          <Input
            id="lineId"
            value={form.lineId}
            onChange={(e) => setForm({ ...form, lineId: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="taxId">Tax ID (TIN)</Label>
          <Input
            id="taxId"
            value={form.taxId}
            onChange={(e) => setForm({ ...form, taxId: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="addressLine1">Address Line 1</Label>
        <Input
          id="addressLine1"
          value={form.addressLine1}
          onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="subDistrict">Sub-District</Label>
          <Input
            id="subDistrict"
            value={form.subDistrict}
            onChange={(e) => setForm({ ...form, subDistrict: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="district">District</Label>
          <Input
            id="district"
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="province">Province</Label>
          <Input
            id="province"
            value={form.province}
            onChange={(e) => setForm({ ...form, province: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zipcode">Zip Code</Label>
          <Input
            id="zipcode"
            value={form.zipcode}
            onChange={(e) => setForm({ ...form, zipcode: e.target.value })}
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={() => router.push('/clinic/clients')}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !form.name}>
          {submitting ? 'Registering…' : 'Register Client'}
        </Button>
      </div>
    </form>
  );
}
