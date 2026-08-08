import type { Metadata } from 'next';
import RuleFormClient from '../../rule-form-client';

export const metadata: Metadata = {
  title: 'Edit Accounting Rule | Petiatrics',
  description: 'Edit existing clinic-specific dynamic GL accounting rule.',
};

export default async function EditAccountingRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RuleFormClient ruleId={id} />;
}
