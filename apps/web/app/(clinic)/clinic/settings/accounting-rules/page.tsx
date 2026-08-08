import type { Metadata } from 'next';
import AccountingRulesClient from './accounting-rules-client';

export const metadata: Metadata = {
  title: 'Dynamic Accounting Rules | Petiatrics',
  description: 'Manage clinic-specific dynamic GL account routing and automated rule engine configuration.',
};

export default function AccountingRulesPage() {
  return <AccountingRulesClient />;
}
