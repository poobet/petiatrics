import ClientDetailClient from './client-detail-client';

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Route: /clinic/clients/[id] — id is a BP ID (not User ID)
  return <ClientDetailClient params={params} />;
}
