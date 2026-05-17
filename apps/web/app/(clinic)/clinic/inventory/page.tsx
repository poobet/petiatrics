import { cookies } from 'next/headers';
import InventoryClient from './inventory-client';
import type { ItemSummaryResponse, ItemCategoryResponse } from '@petiatrics/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function sessionHeaders(): Promise<HeadersInit> {
  const cookieStore = await cookies();
  const sid = cookieStore.get('petiatrics_sid')?.value;
  return {
    Cookie: sid ? `petiatrics_sid=${sid}` : '',
    Accept: 'application/json',
  };
}

async function getItems(): Promise<ItemSummaryResponse[]> {
  try {
    const res = await fetch(`${API}/api/v1/inventory/products`, {
      headers: await sessionHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.items ?? json?.data?.items ?? json?.data ?? [];
  } catch {
    return [];
  }
}

async function getLowStockItems(): Promise<ItemSummaryResponse[]> {
  try {
    const res = await fetch(`${API}/api/v1/inventory/products/low-stock`, {
      headers: await sessionHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data ?? [];
  } catch {
    return [];
  }
}

async function getCategories(): Promise<ItemCategoryResponse[]> {
  try {
    const res = await fetch(`${API}/api/v1/inventory/reference/categories`, {
      headers: await sessionHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data ?? json?.items ?? json ?? [];
  } catch {
    return [];
  }
}

export default async function InventoryPage() {
  const [items, lowStockItems, categories] = await Promise.all([
    getItems(),
    getLowStockItems(),
    getCategories(),
  ]);

  return (
    <InventoryClient
      initialItems={items}
      lowStockItems={lowStockItems}
      categories={categories}
    />
  );
}
