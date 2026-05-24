import { cookies } from 'next/headers';
import InventoryClient from './inventory-client';
import type { ItemCategoryResponse } from '@petiatrics/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function sessionHeaders(): Promise<HeadersInit> {
  const cookieStore = await cookies();
  const sid = cookieStore.get('petiatrics_sid')?.value;
  return {
    Cookie: sid ? `petiatrics_sid=${sid}` : '',
    Accept: 'application/json',
  };
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
  // Items and low-stock are branch-sensitive: fetched client-side by InventoryClient
  // after the active branch is resolved from Zustand session store.
  const categories = await getCategories();

  return (
    <InventoryClient
      categories={categories}
    />
  );
}
