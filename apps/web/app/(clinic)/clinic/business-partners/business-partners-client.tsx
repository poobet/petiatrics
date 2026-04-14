'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@petiatrics/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@petiatrics/ui';
import { Plus } from 'lucide-react';
import { apiClient } from '../../../../lib/api-client';
import { useSessionStore } from '../../../../lib/session-store';
import {
  BusinessPartnerResponse,
  CreateBusinessPartnerPayload,
  UpdateBusinessPartnerPayload,
  Role,
} from '@petiatrics/types';
import BusinessPartnerTable from '../../../../components/business-partners/business-partner-table';
import BusinessPartnerForm from '../../../../components/business-partners/business-partner-form';

const WRITE_ROLES: Role[] = [Role.SUPER_ADMIN, Role.CLINIC_OWNER, Role.STAFF];
const DEACTIVATE_ROLES: Role[] = [Role.SUPER_ADMIN, Role.CLINIC_OWNER];

export default function BusinessPartnersClient() {
  const t = useTranslations('businessPartners');
  const role = useSessionStore((s) => s.user?.role as Role | undefined);

  const canWrite = role != null && WRITE_ROLES.includes(role);
  const canDeactivate = role != null && DEACTIVATE_ROLES.includes(role);

  const [partners, setPartners] = useState<BusinessPartnerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BusinessPartnerResponse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadPartners(includeInactive: boolean) {
    setLoading(true);
    try {
      const qs = includeInactive ? '?includeInactive=true' : '';
      const data = await apiClient.get<BusinessPartnerResponse[]>(
        `/clinic/business-partners${qs}`,
      );
      setPartners(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPartners(showInactive);
  }, [showInactive]);

  async function handleCreate(payload: CreateBusinessPartnerPayload | UpdateBusinessPartnerPayload) {
    const created = await apiClient.post<BusinessPartnerResponse>(
      '/clinic/business-partners',
      payload,
    );
    setPartners((prev) => [created, ...prev]);
    setCreateOpen(false);
  }

  async function handleUpdate(payload: CreateBusinessPartnerPayload | UpdateBusinessPartnerPayload) {
    if (!editTarget) return;
    const updated = await apiClient.patch<BusinessPartnerResponse>(
      `/clinic/business-partners/${editTarget.id}`,
      payload,
    );
    setPartners((prev) =>
      prev.map((bp) => (bp.id === updated.id ? updated : bp)),
    );
    setEditTarget(null);
  }

  async function handleDeactivate(bp: BusinessPartnerResponse) {
    setBusyId(bp.id);
    try {
      const updated = await apiClient.patch<BusinessPartnerResponse>(
        `/clinic/business-partners/${bp.id}/deactivate`,
        {},
      );
      setPartners((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInactive((v) => !v)}
          >
            {t('showInactive')}
          </Button>
          {canWrite && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('new')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('new')}</DialogTitle>
                </DialogHeader>
                <BusinessPartnerForm
                  onSubmit={handleCreate}
                  onCancel={() => setCreateOpen(false)}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">{t('noPartners')}</p>
      ) : (
        <BusinessPartnerTable
          partners={showInactive ? partners : partners.filter((bp) => bp.isActive)}
          canWrite={canWrite}
          canDeactivate={canDeactivate}
          busyId={busyId}
          onEdit={setEditTarget}
          onDeactivate={handleDeactivate}
        />
      )}

      {/* Edit dialog */}
      <Dialog open={editTarget != null} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('edit')}</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <BusinessPartnerForm
              initial={editTarget}
              onSubmit={handleUpdate}
              onCancel={() => setEditTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
