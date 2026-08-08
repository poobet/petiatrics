import type { Metadata } from 'next';
import RuleFormClient from '../rule-form-client';

export const metadata: Metadata = {
  title: 'Create Accounting Rule | Petiatrics',
  description: 'Create a new clinic-specific dynamic GL accounting rule.',
};

export default function NewAccountingRulePage() {
  return <RuleFormClient />;
}
