'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient, ApiError } from '@/lib/api-client';
import { Badge } from '@petiatrics/ui/badge';
import { Button } from '@petiatrics/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@petiatrics/ui/dialog';
import { Label } from '@petiatrics/ui/label';
import { Textarea } from '@petiatrics/ui/textarea';

interface VisitRecord {
  _id: string;
  patientId: string;
  vetId: string;
  visitDate: string;
  status: 'draft' | 'finalized' | 'amended';
  chiefComplaint?: string;
  soap?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  prescriptions?: Array<{
    drug: string;
    dosage: string;
    frequency: string;
    duration: string;
    inventoryLinked: boolean;
  }>;
  finalizedAt?: string;
  amendedAt?: string;
  amendmentReason?: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'secondary',
  finalized: 'default',
  amended: 'destructive',
};

export default function VisitDetailClient({
  visit: initialVisit,
  patientId,
}: {
  visit: VisitRecord;
  patientId: string;
}) {
  const router = useRouter();
  const [visit, setVisit] = useState(initialVisit);
  const [showFinalize, setShowFinalize] = useState(false);
  const [showAmend, setShowAmend] = useState(false);
  const [amendReason, setAmendReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFinalize = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await apiClient.post<VisitRecord>(
        `/api/v1/patients/${patientId}/visits/${visit._id}/finalize`,
        {},
      );
      setVisit(updated);
      setShowFinalize(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to finalize visit');
    } finally {
      setLoading(false);
    }
  };

  const handleAmend = async () => {
    if (!amendReason.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await apiClient.post<VisitRecord>(
        `/api/v1/patients/${patientId}/visits/${visit._id}/amend`,
        { amendmentReason: amendReason.trim() },
      );
      setVisit(updated);
      setShowAmend(false);
      setAmendReason('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to amend visit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Visit</h1>
            <Badge variant={STATUS_COLORS[visit.status] as any}>{visit.status}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {new Date(visit.visitDate).toLocaleDateString()} · Vet: {visit.vetId}
          </p>
        </div>
        <div className="flex gap-2">
          {visit.status === 'draft' && (
            <Button onClick={() => setShowFinalize(true)}>Finalize</Button>
          )}
          {visit.status === 'finalized' && (
            <Button variant="outline" onClick={() => setShowAmend(true)}>
              Amend
            </Button>
          )}
          <Link href={`/patients/${patientId}`}>
            <Button variant="ghost">← Back</Button>
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Chief Complaint */}
      {visit.chiefComplaint && (
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Chief Complaint
          </p>
          <p>{visit.chiefComplaint}</p>
        </div>
      )}

      {/* SOAP */}
      {visit.soap && (
        <div className="rounded-lg border p-4 space-y-4">
          <h2 className="font-medium text-sm">SOAP Notes</h2>
          {(['subjective', 'objective', 'assessment', 'plan'] as const).map((field) =>
            visit.soap?.[field] ? (
              <div key={field}>
                <p className="text-xs text-muted-foreground uppercase tracking-wide capitalize mb-1">
                  {field}
                </p>
                <p className="text-sm whitespace-pre-wrap">{visit.soap[field]}</p>
              </div>
            ) : null,
          )}
        </div>
      )}

      {/* Prescriptions */}
      {(visit.prescriptions?.length ?? 0) > 0 && (
        <div className="rounded-lg border p-4">
          <h2 className="font-medium text-sm mb-3">Prescriptions</h2>
          <div className="space-y-2">
            {visit.prescriptions!.map((rx, i) => (
              <div key={i} className="text-sm flex gap-2">
                <span className="font-medium">{rx.drug}</span>
                <span className="text-muted-foreground">
                  {rx.dosage} · {rx.frequency} · {rx.duration}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Amendment info */}
      {visit.status === 'amended' && visit.amendmentReason && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Amendment Reason
          </p>
          <p className="text-sm">{visit.amendmentReason}</p>
        </div>
      )}

      {/* Finalize dialog */}
      <Dialog open={showFinalize} onOpenChange={setShowFinalize}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalize Visit</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Once finalized, this visit record becomes read-only and can only be amended with a
            stated reason. Are you sure?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinalize(false)}>
              Cancel
            </Button>
            <Button onClick={handleFinalize} disabled={loading}>
              {loading ? 'Finalizing…' : 'Finalize'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Amend dialog */}
      <Dialog open={showAmend} onOpenChange={setShowAmend}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Amend Visit</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="amendReason">Reason for Amendment *</Label>
            <Textarea
              id="amendReason"
              value={amendReason}
              onChange={(e) => setAmendReason(e.target.value)}
              rows={3}
              placeholder="Describe why this record is being amended"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAmend(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAmend}
              disabled={loading || !amendReason.trim()}
              variant="destructive"
            >
              {loading ? 'Amending…' : 'Amend Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
