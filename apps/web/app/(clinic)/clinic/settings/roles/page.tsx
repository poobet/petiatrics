import type { Metadata } from 'next';
import RolesClient from './roles-client';

export const metadata: Metadata = {
  title: 'Roles & Permissions | Petiatrics',
  description: 'Configure granular CRUD-level permissions for each staff role in your clinic.',
};

export default function RolesPage() {
  return <RolesClient />;
}
