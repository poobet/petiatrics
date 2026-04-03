import { Metadata } from 'next';
import StaffPageClient from './staff-client';
import { apiClient } from '../../../../lib/api-client';

export const metadata: Metadata = { title: 'Staff | Petiatrics' };

export default async function StaffPage() {
  return <StaffPageClient />;
}
