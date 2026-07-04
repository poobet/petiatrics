'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@petiatrics/ui';
import { Plus } from 'lucide-react';
import { apiClient } from '../../../../lib/api-client';
import { useSessionStore } from '../../../../lib/session-store';
import { BusinessPartnerResponse, Role } from '@petiatrics/types';
import BusinessPartnerTable from '../../../../components/business-partners/business-partner-table';

const WRITE_ROLES: Role[] = [Role.SUPER_ADMIN, Role.CLINIC_OWNER, Role.STAFF];
const DEACTIVATE_ROLES: Role[] = [Role.SUPER_ADMIN, Role.CLINIC_OWNER];

export default function BusinessPartnersClient() {
  const t = useTranslations('businessPartners');
  const router = useRouter();
  const role = useSessionStore((s) => s.user?.role as Role | undefined);

  const canWrite = role != null && WRITE_ROLES.includes(role);
  const canDeactivate = role != null && DEACTIVATE_ROLES.includes(role);

  const [partners, setPartners] = useState<BusinessPartnerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
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
            <Button size="sm" onClick={() => router.push('/clinic/business-partners/new')}>
              <Plus className="w-4 h-4 mr-2" />
              {t('new')}
            </Button>
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
          onEdit={(bp) => router.push(`/clinic/business-partners/${bp.id}/edit`)}
          onDeactivate={handleDeactivate}
        />
      )}
    </div>
  );
}
