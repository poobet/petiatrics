'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@petiatrics/ui/button';
import { Input } from '@petiatrics/ui/input';
import { Badge } from '@petiatrics/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@petiatrics/ui/dialog';
import { Label } from '@petiatrics/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@petiatrics/ui/select';
import { usePermission } from '@/lib/use-permission';

interface Patient {
  _id: string;
  name: string;
  species: string;
  breed: string;
  ownerUserId: string;
  weightKg?: number;
  createdAt: string;
}

export default function PatientsClient() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '',
    species: 'dog',
    breed: '',
    ownerUserId: '',
    weightKg: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canAddPatient = usePermission('PATIENT:EDIT');

  const loadPatients = async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : '';
      const data = await apiClient.get<Patient[]>(`/patients${params}`);
      setPatients(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadPatients(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCreate = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      await apiClient.post('/patients', {
        ...form,
        weightKg: form.weightKg ? parseFloat(form.weightKg) : undefined,
      });
      setShowAdd(false);
      setForm({ name: '', species: 'dog', breed: '', ownerUserId: '', weightKg: '' });
      loadPatients(search);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create patient');
    } finally {
      setSubmitting(false);
    }
  };

  const SPECIES_LABELS: Record<string, string> = {
    dog: 'Dog', cat: 'Cat', rabbit: 'Rabbit', bird: 'Bird', other: 'Other',
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {canAddPatient && (
          <Link href="/clinic/patients/new">
            <Button>+ Add Patient</Button>
          </Link>
        )}
      </div>

      {error && (
        <p className="text-destructive text-sm">{error}</p>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Species / Breed</th>
                <th className="text-left px-4 py-3 font-medium">Weight</th>
                <th className="text-left px-4 py-3 font-medium">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {patients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No patients found
                  </td>
                </tr>
              )}
              {patients.map((p) => (
                <tr key={p._id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{SPECIES_LABELS[p.species] ?? p.species}</Badge>
                      {p.breed && <span className="text-muted-foreground">{p.breed}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.weightKg != null ? `${p.weightKg} kg` : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/patients/${p._id}`}
                      className="text-primary underline-offset-4 hover:underline text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add patient dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Species *</Label>
              <Select
                value={form.species}
                onValueChange={(v) => setForm({ ...form, species: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SPECIES_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="breed">Breed</Label>
              <Input
                id="breed"
                value={form.breed}
                onChange={(e) => setForm({ ...form, breed: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ownerUserId">Owner User ID *</Label>
              <Input
                id="ownerUserId"
                value={form.ownerUserId}
                onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                value={form.weightKg}
                onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={submitting || !form.name || !form.ownerUserId}
            >
              {submitting ? 'Saving…' : 'Add Patient'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
