'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@petiatrics/ui/button';
import { Input } from '@petiatrics/ui/input';
import { Textarea } from '@petiatrics/ui/textarea';
import { Label } from '@petiatrics/ui/label';
import ItemSearchCombobox from '@/components/inventory/item-search-combobox';

interface Prescription {
  drug: string;
  dosage: string;
  frequency: string;
  duration: string;
  inventoryLinked?: boolean;
}

function calculateChildDosage(parentDosage: string, ratio: number): string {
  const match = parentDosage.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (match) {
    const parentQty = parseFloat(match[1]);
    const childQty = parentQty * ratio;
    const unit = match[2];
    const formattedQty = Number(childQty.toFixed(3));
    return unit ? `${formattedQty} ${unit}` : `${formattedQty}`;
  }
  return `${parentDosage} (x${ratio})`;
}



export default function NewVisitPage() {
  const router = useRouter();
  const { id: patientId } = useParams<{ id: string }>();

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [soap, setSoap] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [newRx, setNewRx] = useState<Prescription>({
    drug: '',
    dosage: '',
    frequency: '',
    duration: '',
  });
  const [vetId, setVetId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProductSelect = async (item: any) => {
    try {
      const details = await apiClient.get<any>(`/inventory/products/${item.id}`);
      setSelectedProduct(details);
      setNewRx((prev) => ({
        ...prev,
        drug: details.name,
      }));
    } catch (err) {
      console.error('Failed to fetch product details', err);
      setNewRx((prev) => ({
        ...prev,
        drug: item.name,
      }));
    }
  };

  const addPrescription = () => {
    if (!newRx.drug || !newRx.dosage) return;

    const mainRx = { ...newRx, inventoryLinked: !!selectedProduct };
    const additionalRxs: Prescription[] = [];

    if (selectedProduct && selectedProduct.accessories && selectedProduct.accessories.length > 0) {
      selectedProduct.accessories.forEach((acc: any) => {
        additionalRxs.push({
          drug: acc.name,
          dosage: calculateChildDosage(newRx.dosage, acc.quantityRatio),
          frequency: newRx.frequency,
          duration: newRx.duration,
          inventoryLinked: true,
        });
      });
    }

    setPrescriptions([...prescriptions, mainRx, ...additionalRxs]);
    setNewRx({ drug: '', dosage: '', frequency: '', duration: '' });
    setSelectedProduct(null);
  };

  const removePrescription = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chiefComplaint || !vetId) {
      setError('Chief complaint and vet ID are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const visit = await apiClient.post<{ _id: string }>(
        `/patients/${patientId}/visits`,
        {
          vetId,
          chiefComplaint,
          soap,
          prescriptions: prescriptions.map((rx) => ({
            ...rx,
            inventoryLinked: rx.inventoryLinked ?? false,
          })),
        },
      );
      router.push(`/patients/${patientId}/visits/${visit._id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create visit');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Visit</h1>
        <p className="text-muted-foreground text-sm mt-1">Create a new visit record (draft)</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-1.5">
          <Label htmlFor="vetId">Vet ID *</Label>
          <Input
            id="vetId"
            value={vetId}
            onChange={(e) => setVetId(e.target.value)}
            placeholder="UUID of attending vet"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="chiefComplaint">Chief Complaint *</Label>
          <Input
            id="chiefComplaint"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="Reason for visit"
          />
        </div>

        {/* SOAP Notes */}
        <div className="rounded-lg border p-4 space-y-4">
          <h2 className="font-medium text-sm">SOAP Notes</h2>
          {(['subjective', 'objective', 'assessment', 'plan'] as const).map((field) => (
            <div key={field} className="space-y-1.5">
              <Label className="capitalize">{field}</Label>
              <Textarea
                value={soap[field]}
                onChange={(e) => setSoap({ ...soap, [field]: e.target.value })}
                rows={2}
                className="resize-none"
              />
            </div>
          ))}
        </div>

        {/* Prescriptions */}
        <div className="rounded-lg border p-4 space-y-4">
          <h2 className="font-medium text-sm">Prescriptions</h2>
          {prescriptions.map((rx, i) => (
            <div key={i} className="flex items-center justify-between text-sm rounded bg-muted/40 px-3 py-2">
              <span>
                <strong>{rx.drug}</strong> — {rx.dosage}, {rx.frequency}, {rx.duration}
              </span>
              <button
                type="button"
                onClick={() => removePrescription(i)}
                className="text-destructive hover:underline text-xs"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <ItemSearchCombobox
                placeholder="Search drug/service…"
                itemType=""
                onSelect={handleProductSelect}
                onChange={(val) => {
                  setNewRx((prev) => ({ ...prev, drug: val }));
                  setSelectedProduct(null);
                }}
              />
            </div>
            <Input
              placeholder="Dosage"
              value={newRx.dosage}
              onChange={(e) => setNewRx({ ...newRx, dosage: e.target.value })}
            />
            <Input
              placeholder="Frequency"
              value={newRx.frequency}
              onChange={(e) => setNewRx({ ...newRx, frequency: e.target.value })}
            />
            <Input
              placeholder="Duration"
              value={newRx.duration}
              onChange={(e) => setNewRx({ ...newRx, duration: e.target.value })}
            />
          </div>
          <Button type="button" variant="outline" onClick={addPrescription} className="w-full">
            + Add Prescription
          </Button>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/patients/${patientId}`)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Draft'}
          </Button>
        </div>
      </form>
    </div>
  );
}
