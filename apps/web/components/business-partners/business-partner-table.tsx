'use client';

import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@petiatrics/ui';
import { Badge } from '@petiatrics/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@petiatrics/ui';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@petiatrics/ui';
import { BusinessPartnerResponse } from '@petiatrics/types';

interface BusinessPartnerTableProps {
  partners: BusinessPartnerResponse[];
  canWrite: boolean;
  canDeactivate: boolean;
  busyId: string | null;
  onEdit: (bp: BusinessPartnerResponse) => void;
  onDeactivate: (bp: BusinessPartnerResponse) => void;
}

export default function BusinessPartnerTable({
  partners,
  canWrite,
  canDeactivate,
  busyId,
  onEdit,
  onDeactivate,
}: BusinessPartnerTableProps) {
  const t = useTranslations('businessPartners');
  const tCommon = useTranslations('common');

  if (partners.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">{t('noPartners')}</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('name')}</TableHead>
          <TableHead>{t('taxId')}</TableHead>
          <TableHead>{t('type')}</TableHead>
          <TableHead>{tCommon('status')}</TableHead>
          <TableHead>{t('linkedUser')}</TableHead>
          {canWrite && <TableHead className="w-12" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {partners.map((bp) => (
          <TableRow key={bp.id} className={!bp.isActive ? 'opacity-50' : undefined}>
            <TableCell className="font-medium">{bp.name}</TableCell>
            <TableCell className="text-sm text-gray-500 font-mono">
              {bp.taxId ?? '—'}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{t(`types.${bp.type}`)}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={bp.isActive ? 'default' : 'secondary'}>
                {bp.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-gray-500">
              {bp.user ? (bp.user.email ?? bp.user.username ?? bp.user.id) : '—'}
            </TableCell>
            {canWrite && (
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === bp.id}
                      aria-label={tCommon('actions')}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(bp)}>
                      {tCommon('edit')}
                    </DropdownMenuItem>
                    {canDeactivate && bp.isActive && (
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => onDeactivate(bp)}
                      >
                        {t('deactivate')}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
