'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@petiatrics/ui/button';
import { Input } from '@petiatrics/ui/input';
import { Label } from '@petiatrics/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@petiatrics/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@petiatrics/ui/command';
import { Card, CardContent } from '@petiatrics/ui/card';
import { Check, ChevronsUpDown, User, PawPrint, UserPlus, Users, Phone } from 'lucide-react';

interface Patient {
  _id: string;
  name: string;
  species: string;
  breed: string;
  ownerUserId: string;
}

interface ClientUser {
  id: string;
  name: string;
  email?: string;
  businessPartners?: { code: string | null; phone: string | null }[];
}

interface StaffUser {
  id: string;
  name: string;
  role: string;
  username: string;
}

type ClientMode = 'existing' | 'walkin';

const SPECIES_OPTIONS = [
  { value: 'dog', label: '🐕 สุนัข' },
  { value: 'cat', label: '🐈 แมว' },
  { value: 'rabbit', label: '🐇 กระต่าย' },
  { value: 'bird', label: '🐦 นก' },
  { value: 'fish', label: '🐟 ปลา' },
  { value: 'reptile', label: '🦎 สัตว์เลื้อยคลาน' },
  { value: 'other', label: '🐾 อื่นๆ' },
];

export default function NewAppointmentPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState('');

  // ── Per-owner patient fetch — lazy, only after owner is selected ───────
  const [ownerPatients, setOwnerPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);

  // ── Client mode toggle ─────────────────────────────────────────────────
  const [clientMode, setClientMode] = useState<ClientMode>('existing');

  // ── Existing client state ──────────────────────────────────────────────
  const [selectedOwner, setSelectedOwner] = useState<ClientUser | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedVet, setSelectedVet] = useState<StaffUser | null>(null);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [patientOpen, setPatientOpen] = useState(false);
  const [vetOpen, setVetOpen] = useState(false);

  // ── Walk-in client state ───────────────────────────────────────────────
  const [walkIn, setWalkIn] = useState({
    ownerName: '',
    ownerPhone: '',
    petName: '',
    petSpecies: '',
  });

  // ── Shared appointment fields ──────────────────────────────────────────
  const [form, setForm] = useState({
    scheduledAt: '',
    scheduledTime: '',
    durationMinutes: '30',
    reason: '',
  });

  useEffect(() => {
    Promise.all([
      apiClient.get<ClientUser[]>('/clinic/clients'),
      apiClient.get<StaffUser[]>('/clinic/staff'),
    ])
      .then(([clientsData, staffData]) => {
        setClients(clientsData || []);
        setStaff((staffData || []).filter((s) => s.role === 'VET' || s.role === 'CLINIC_OWNER'));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load clinic data'))
      .finally(() => setLoading(false));
  }, []);

  const handleOwnerSelect = (owner: ClientUser) => {
    setSelectedOwner(owner);
    setSelectedPatient(null);
    setOwnerOpen(false);
    // Fetch pets scoped to this owner only
    setPatientsLoading(true);
    setOwnerPatients([]);
    apiClient
      .get<Patient[]>(`/patients?ownerUserId=${owner.id}`)
      .then(setOwnerPatients)
      .catch(() => setOwnerPatients([]))
      .finally(() => setPatientsLoading(false));
  };

  const switchMode = (mode: ClientMode) => {
    setClientMode(mode);
    setSelectedOwner(null);
    setSelectedPatient(null);
    setOwnerPatients([]);
    setError(null);
    setWalkIn({ ownerName: '', ownerPhone: '', petName: '', petSpecies: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.scheduledAt || !form.scheduledTime || !form.reason) {
      setError('กรุณากรอกวันที่ เวลา และสาเหตุการนัดหมาย');
      return;
    }

    const scheduledAt = new Date(`${form.scheduledAt}T${form.scheduledTime}:00`);

    setSubmitting(true);

    try {
      let ownerUserId: string;
      let patientId: string;

      if (clientMode === 'existing') {
        // ── Existing client path ───────────────────────────────────────
        if (!selectedOwner) { setError('กรุณาเลือกเจ้าของสัตว์เลี้ยงก่อน'); setSubmitting(false); return; }
        if (!selectedPatient) { setError('กรุณาเลือกสัตว์เลี้ยง'); setSubmitting(false); return; }
        ownerUserId = selectedOwner.id;
        patientId = selectedPatient._id;
      } else {
        // ── Walk-in path ──────────────────────────────────────────────
        if (!walkIn.ownerName.trim()) { setError('กรุณากรอกชื่อเจ้าของสัตว์เลี้ยง'); setSubmitting(false); return; }
        if (!walkIn.petName.trim()) { setError('กรุณากรอกชื่อสัตว์เลี้ยง'); setSubmitting(false); return; }
        if (!walkIn.petSpecies) { setError('กรุณาเลือกประเภทสัตว์เลี้ยง'); setSubmitting(false); return; }

        // Step 1: Auto-register client
        setSubmitStep('กำลังลงทะเบียนลูกค้าใหม่…');
        const newClient = await apiClient.post<{ id: string }>('/clinic/clients', {
          name: walkIn.ownerName.trim(),
          phone: walkIn.ownerPhone.trim() || undefined,
        });
        ownerUserId = newClient.id;

        // Step 2: Auto-create pet
        setSubmitStep('กำลังสร้างโปรไฟล์สัตว์เลี้ยง…');
        const newPet = await apiClient.post<{ _id: string }>('/patients', {
          name: walkIn.petName.trim(),
          species: walkIn.petSpecies,
          ownerUserId,
        });
        patientId = newPet._id;
      }

      // Step 3: Book appointment
      setSubmitStep('กำลังจองนัดหมาย…');
      await apiClient.post('/appointments', {
        patientId,
        ownerUserId,
        vetUserId: selectedVet?.id || undefined,
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: parseInt(form.durationMinutes, 10),
        reason: form.reason,
      });

      router.push('/clinic/appointments');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      setSubmitting(false);
      setSubmitStep('');
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading clinic details…</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">นัดหมายใหม่</h1>
        <p className="text-muted-foreground text-sm mt-1">จองนัดหมายตรวจสัตว์เลี้ยง</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* ─── Client Mode Toggle ───────────────────────────────────────── */}
        <div className="space-y-3">
          <Label>ประเภทลูกค้า</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => switchMode('existing')}
              className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors text-left ${
                clientMode === 'existing'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted/40'
              }`}
            >
              <Users className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">ลูกค้าเดิม</p>
                <p className="text-[11px] font-normal opacity-80">ลงทะเบียนไว้แล้ว</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => switchMode('walkin')}
              className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors text-left ${
                clientMode === 'walkin'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted/40'
              }`}
            >
              <UserPlus className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Walk-in / ลูกค้าใหม่</p>
                <p className="text-[11px] font-normal opacity-80">ยังไม่เคยลงทะเบียน</p>
              </div>
            </button>
          </div>
        </div>

        {/* ─── Existing Client: Owner + Pet ──────────────────────────────── */}
        {clientMode === 'existing' && (
          <>
            <div className="space-y-1.5 flex flex-col">
              <Label>
                <User className="inline h-4 w-4 mr-1 -mt-0.5" />
                เจ้าของสัตว์เลี้ยง *
              </Label>
              <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={ownerOpen}
                    className="justify-between text-left font-normal w-full"
                  >
                    {selectedOwner
                      ? `${selectedOwner.name}${selectedOwner.businessPartners?.[0]?.code ? ` (${selectedOwner.businessPartners[0].code})` : selectedOwner.email ? ` (${selectedOwner.email})` : ''}`
                      : 'เลือกเจ้าของสัตว์เลี้ยง…'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[450px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="ค้นหาชื่อ, อีเมล, รหัส BP…" />
                    <CommandList>
                      <CommandEmpty>ไม่พบเจ้าของสัตว์เลี้ยง</CommandEmpty>
                      <CommandGroup heading="เจ้าของสัตว์เลี้ยง">
                        {clients.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.name} ${c.email || ''} ${c.businessPartners?.[0]?.code || ''}`}
                            onSelect={() => handleOwnerSelect(c)}
                          >
                            <Check className={`mr-2 h-4 w-4 ${selectedOwner?.id === c.id ? 'opacity-100' : 'opacity-0'}`} />
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{c.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {c.businessPartners?.[0]?.code && <span className="font-mono mr-1">{c.businessPartners[0].code}</span>}
                                {c.email && <span>{c.email}</span>}
                                {c.businessPartners?.[0]?.phone && <span> · {c.businessPartners[0].phone}</span>}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5 flex flex-col">
              <Label>
                <PawPrint className="inline h-4 w-4 mr-1 -mt-0.5" />
                สัตว์เลี้ยง *
              </Label>
              <Popover open={patientOpen} onOpenChange={setPatientOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    disabled={!selectedOwner}
                    className="justify-between text-left font-normal w-full"
                  >
                    {!selectedOwner
                      ? 'เลือกเจ้าของก่อน…'
                      : patientsLoading
                        ? 'กำลังโหลดสัตว์เลี้ยง…'
                        : selectedPatient
                          ? `${selectedPatient.name} (${selectedPatient.species}${selectedPatient.breed ? ` · ${selectedPatient.breed}` : ''})`
                          : 'เลือกสัตว์เลี้ยง…'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[450px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="ค้นหาชื่อสัตว์เลี้ยง…" />
                    <CommandList>
                      {patientsLoading ? (
                        <CommandEmpty>กำลังโหลด…</CommandEmpty>
                      ) : ownerPatients.length === 0 ? (
                        <CommandEmpty>ไม่มีสัตว์เลี้ยงในระบบ</CommandEmpty>
                      ) : (
                        <CommandGroup heading={`สัตว์เลี้ยงของ ${selectedOwner?.name}`}>
                          {ownerPatients.map((p) => (
                            <CommandItem
                              key={p._id}
                              value={p.name}
                              onSelect={() => { setSelectedPatient(p); setPatientOpen(false); }}
                            >
                              <Check className={`mr-2 h-4 w-4 ${selectedPatient?._id === p._id ? 'opacity-100' : 'opacity-0'}`} />
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{p.name}</span>
                                <span className="text-xs text-muted-foreground">{p.species}{p.breed ? ` · ${p.breed}` : ''}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {selectedOwner && selectedPatient && (
              <Card className="bg-muted/40 border-muted/80">
                <CardContent className="p-3 text-xs space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>เจ้าของ:</span>
                    <span className="font-semibold text-foreground">{selectedOwner.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>สัตว์เลี้ยง:</span>
                    <span className="font-semibold text-foreground">
                      {selectedPatient.name} — {selectedPatient.species}{selectedPatient.breed ? ` (${selectedPatient.breed})` : ''}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ─── Walk-in: Manual owner + pet entry ─────────────────────────── */}
        {clientMode === 'walkin' && (
          <div className="rounded-lg border border-dashed border-primary/40 bg-primary/3 p-4 space-y-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              ข้อมูลลูกค้า Walk-in (จะสร้างบัญชีและเชื่อมโยง BP อัตโนมัติ)
            </p>

            {/* Owner info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="walkInOwnerName">
                  <User className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  ชื่อเจ้าของ (ชื่อเล่นก็ได้) *
                </Label>
                <Input
                  id="walkInOwnerName"
                  value={walkIn.ownerName}
                  onChange={(e) => setWalkIn({ ...walkIn, ownerName: e.target.value })}
                  placeholder="เช่น แม่น้อย, คุณสมศรี"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="walkInOwnerPhone">
                  <Phone className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  เบอร์โทรศัพท์
                </Label>
                <Input
                  id="walkInOwnerPhone"
                  type="tel"
                  value={walkIn.ownerPhone}
                  onChange={(e) => setWalkIn({ ...walkIn, ownerPhone: e.target.value })}
                  placeholder="0812345678"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-border" />

            {/* Pet info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="walkInPetName">
                  <PawPrint className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  ชื่อสัตว์เลี้ยง *
                </Label>
                <Input
                  id="walkInPetName"
                  value={walkIn.petName}
                  onChange={(e) => setWalkIn({ ...walkIn, petName: e.target.value })}
                  placeholder="เช่น มะม่วง, ลูกหมี"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="walkInPetSpecies">ประเภทสัตว์ *</Label>
                <select
                  id="walkInPetSpecies"
                  value={walkIn.petSpecies}
                  onChange={(e) => setWalkIn({ ...walkIn, petSpecies: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">เลือกประเภท…</option>
                  {SPECIES_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview badge */}
            {walkIn.ownerName && walkIn.petName && walkIn.petSpecies && (
              <Card className="bg-background border-primary/20">
                <CardContent className="p-3 text-xs space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>เจ้าของ:</span>
                    <span className="font-semibold text-foreground">
                      {walkIn.ownerName}{walkIn.ownerPhone ? ` · ${walkIn.ownerPhone}` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>สัตว์เลี้ยง:</span>
                    <span className="font-semibold text-foreground">
                      {walkIn.petName} ({SPECIES_OPTIONS.find((s) => s.value === walkIn.petSpecies)?.label ?? walkIn.petSpecies})
                    </span>
                  </div>
                  <p className="text-[11px] text-primary mt-1.5">
                    ✓ จะสร้างบัญชีลูกค้าและ BP อัตโนมัติเมื่อยืนยันนัดหมาย
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ─── Vet Selection (shared) ───────────────────────────────────── */}
        <div className="space-y-1.5 flex flex-col">
          <Label>สัตวแพทย์ที่รับผิดชอบ</Label>
          <Popover open={vetOpen} onOpenChange={setVetOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={vetOpen}
                className="justify-between text-left font-normal w-full"
              >
                {selectedVet ? `${selectedVet.name} (@${selectedVet.username})` : 'มอบหมายสัตวแพทย์ (ไม่บังคับ)…'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[450px] p-0" align="start">
              <Command>
                <CommandInput placeholder="ค้นหาชื่อสัตวแพทย์…" />
                <CommandList>
                  <CommandEmpty>ไม่พบสัตวแพทย์</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="unassigned" onSelect={() => { setSelectedVet(null); setVetOpen(false); }}>
                      <Check className={`mr-2 h-4 w-4 ${selectedVet === null ? 'opacity-100' : 'opacity-0'}`} />
                      <span className="text-muted-foreground italic">ยังไม่กำหนด</span>
                    </CommandItem>
                    {staff.map((s) => (
                      <CommandItem key={s.id} value={s.name} onSelect={() => { setSelectedVet(s); setVetOpen(false); }}>
                        <Check className={`mr-2 h-4 w-4 ${selectedVet?.id === s.id ? 'opacity-100' : 'opacity-0'}`} />
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{s.name}</span>
                          <span className="text-xs text-muted-foreground">@{s.username}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* ─── Date / Time / Duration ───────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="scheduledAt">วันที่ *</Label>
            <Input
              id="scheduledAt"
              type="date"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scheduledTime">เวลา *</Label>
            <Input
              id="scheduledTime"
              type="time"
              value={form.scheduledTime}
              onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="duration">ระยะเวลา (นาที) *</Label>
          <Input
            id="duration"
            type="number"
            min="15"
            step="15"
            value={form.durationMinutes}
            onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
          />
        </div>

        {/* ─── Reason ───────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="reason">สาเหตุการนัดหมาย *</Label>
          <Input
            id="reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="ตรวจสุขภาพประจำปี, ฉีดวัคซีน, ฯลฯ"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {submitStep || 'กำลังบันทึก…'}
              </span>
            ) : (
              'ยืนยันนัดหมาย'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
