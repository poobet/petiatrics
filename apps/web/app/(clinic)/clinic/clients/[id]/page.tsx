import ClientDetailClient from './client-detail-client';

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <ClientDetailClient params={params} />;
}
