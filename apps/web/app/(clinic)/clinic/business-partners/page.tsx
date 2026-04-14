import { Metadata } from 'next';
import BusinessPartnersClient from './business-partners-client';

export const metadata: Metadata = { title: 'Business Partners | Petiatrics' };

export default async function BusinessPartnersPage() {
  return <BusinessPartnersClient />;
}
