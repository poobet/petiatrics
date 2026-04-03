import { cookies } from 'next/headers';
import InventoryClient from './inventory-client';

async function getProducts(clinicId: string) {
  const cookieStore = await cookies();
  const sid = cookieStore.get('petiatrics_sid')?.value;
  const res = await fetch(`${process.env.API_BASE_URL}/api/v1/inventory/products`, {
    headers: {
      Cookie: sid ? `petiatrics_sid=${sid}` : '',
      'x-clinic-id': clinicId,
    },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

async function getLowStockProducts(clinicId: string) {
  const cookieStore = await cookies();
  const sid = cookieStore.get('petiatrics_sid')?.value;
  const res = await fetch(`${process.env.API_BASE_URL}/api/v1/inventory/products/low-stock`, {
    headers: {
      Cookie: sid ? `petiatrics_sid=${sid}` : '',
      'x-clinic-id': clinicId,
    },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

export default async function InventoryPage() {
  // clinicId resolved from session on server; pass placeholder for now
  const clinicId = '';
  const [products, lowStockProducts] = await Promise.all([
    getProducts(clinicId),
    getLowStockProducts(clinicId),
  ]);

  return <InventoryClient initialProducts={products} lowStockProducts={lowStockProducts} />;
}
