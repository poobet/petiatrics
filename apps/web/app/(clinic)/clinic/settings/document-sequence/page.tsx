import type { Metadata } from 'next';
import DocumentSequenceClient from './document-sequence-client';

export const metadata: Metadata = {
  title: 'Document Sequencing | Petiatrics',
  description: 'Manage clinic-specific document type definitions and configuration sequence rules.',
};

export default function DocumentSequencePage() {
  return <DocumentSequenceClient />;
}
