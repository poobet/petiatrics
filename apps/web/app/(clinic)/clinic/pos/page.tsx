import type { Metadata } from 'next';
import { PosWorkspaceClient } from './pos-client';

export const metadata: Metadata = {
  title: 'POS Checkout — Petiatrics',
  description: 'Point-of-sale checkout for clinical and OTC dispensing with tax compliance',
};

export default function PosPage() {
  return <PosWorkspaceClient />;
}
