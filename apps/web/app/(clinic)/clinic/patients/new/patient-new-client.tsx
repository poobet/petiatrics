'use client';

import { useEffect, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@petiatrics/ui/button';
import { Input } from '@petiatrics/ui/input';
import { Label } from '@petiatrics/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@petiatrics/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@petiatrics/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@petiatrics/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';

interface ClientUser {
  id: string;
  name: string;
  email: string | null;
}

const SPECIES_LABELS: Record<string, string> = {
  dog: 'Dog', cat: 'Cat', rabbit: 'Rabbit', bird: 'Bird', other: 'Other',
};

export default function PatientNewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ownerIdParam = searchParams.get('ownerId');

  const [clients, setClients] = useState<ClientUser[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<ClientUser | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: '',
    species: 'dog',
    breed: '',
    weightKg: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<ClientUser[]>('/clinic/clients')
      .then((data) => {
        setClients(data);
        if (ownerIdParam) {
          const matched = data.find((c) => c.id === ownerIdParam);
          if (matched) setSelectedOwner(matched);
        }
      })
      .finally(() => setLoading(false));
  }, [ownerIdParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOwner) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post('/patients', {
        ...form,
        ownerUserId: selectedOwner.id,
        weightKg: form.weightKg ? parseFloat(form.weightKg) : undefined,
      });
      if (ownerIdParam) {
        router.push(`/clinic/clients/${ownerIdParam}`);
      } else {
        router.push('/clinic/patients');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add patient');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-muted-foreground text-sm">Loading form data…</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-6 bg-card">
      {error && <p className="text-destructive text-sm font-medium">{error}</p>}

      <div className="space-y-1.5">
        <Label htmlFor="name">Pet Name *</Label>
        <Input
          id="name"
          required
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

      <div className="space-y-1.5 flex flex-col">
        <Label className="mb-1">Owner *</Label>
        {ownerIdParam ? (
          <Input
            value={selectedOwner ? `${selectedOwner.name} (${selectedOwner.email ?? 'No Email'})` : 'Loading…'}
            disabled
            className="bg-muted"
          />
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="justify-between text-left font-normal"
              >
                {selectedOwner
                  ? `${selectedOwner.name} (${selectedOwner.email ?? 'No Email'})`
                  : 'Select Owner…'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search client owners…" />
                <CommandList>
                  <CommandEmpty>No owners found.</CommandEmpty>
                  <CommandGroup>
                    {clients.map((client) => (
                      <CommandItem
                        key={client.id}
                        value={client.name}
                        onSelect={() => {
                          setSelectedOwner(client);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${selectedOwner?.id === client.id ? 'opacity-100' : 'opacity-0'}`}
                        />
                        <div>
                          <div>{client.name}</div>
                          <div className="text-xs text-muted-foreground">{client.email ?? 'No Email'}</div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
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

      <div className="flex gap-3 justify-end pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (ownerIdParam) {
              router.push(`/clinic/clients/${ownerIdParam}`);
            } else {
              router.push('/clinic/patients');
            }
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !form.name || !selectedOwner}>
          {submitting ? 'Adding…' : 'Add Patient'}
        </Button>
      </div>
    </form>
  );
}
