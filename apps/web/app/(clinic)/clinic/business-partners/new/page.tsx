import { Metadata } from 'next';
import BusinessPartnerForm from '../../../../../components/business-partners/business-partner-form';

export const metadata: Metadata = { title: 'Add Business Partner | Petiatrics' };

export default function NewBusinessPartnerPage() {
  return <BusinessPartnerForm />;
}
