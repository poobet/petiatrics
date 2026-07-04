import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import ItemForm from '@/components/inventory/item-form';
import ItemFormHeader from '@/components/inventory/item-form-header';
import type { ItemDetailResponse, ItemCategoryResponse, UnitOfMeasureResponse, ReferenceSelectorItem } from '@petiatrics/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function sessionHeaders(): Promise<HeadersInit> {
  const cookieStore = await cookies();
  const sid = cookieStore.get('petiatrics_sid')?.value;
  return { Cookie: sid ? `petiatrics_sid=${sid}` : '', Accept: 'application/json' };
}

async function getItem(id: string): Promise<ItemDetailResponse | null> {
  try {
    const res = await fetch(`${API}/api/v1/inventory/products/${id}`, {
      headers: await sessionHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? json ?? null;
  } catch {
    return null;
  }
}

async function getReferenceData() {
  const headers = await sessionHeaders();
  const [catRes, unitRes, taxRes, glRes] = await Promise.all([
    fetch(`${API}/api/v1/inventory/reference/categories`, { headers, cache: 'no-store' }),
    fetch(`${API}/api/v1/inventory/reference/units`, { headers, cache: 'no-store' }),
    fetch(`${API}/api/v1/inventory/reference/tax-codes`, { headers, cache: 'no-store' }),
    fetch(`${API}/api/v1/inventory/reference/gl-accounts`, { headers, cache: 'no-store' }),
  ]);

  const rawCategories = catRes.ok ? await catRes.json() : [];
  const rawUnits = unitRes.ok ? await unitRes.json() : [];
  const rawTaxResponse = taxRes.ok ? await taxRes.json() : [];
  const rawGlResponse = glRes.ok ? await glRes.json() : [];

  const categories: ItemCategoryResponse[] = rawCategories?.data ?? rawCategories ?? [];
  const units: UnitOfMeasureResponse[] = rawUnits?.data ?? rawUnits ?? [];
  const rawTax = rawTaxResponse?.data ?? rawTaxResponse ?? [];
  const taxCodes: ReferenceSelectorItem[] = rawTax.map((t: { id: string; code: string; description?: string }) => ({
    id: t.id,
    name: t.description ?? t.code,
    code: t.code,
  }));
  const rawGl = rawGlResponse?.data ?? rawGlResponse ?? [];
  const glAccounts: ReferenceSelectorItem[] = rawGl.map((g: { id: string; code: string; name: string; type: string }) => ({
    id: g.id,
    name: g.name,
    code: g.code,
    symbol: g.type,
  }));

  return { categories, units, taxCodes, suppliers: [], glAccounts };
}

async function ensureOwnerAccess() {
  const res = await fetch(`${API}/api/v1/auth/me`, {
    headers: await sessionHeaders(),
    cache: 'no-store',
  });

  if (!res.ok) {
    redirect('/clinic/inventory');
  }

  const json = await res.json();
  const user = json?.data ?? json;
  if (user?.role !== 'CLINIC_OWNER') {
    redirect('/clinic/inventory');
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditItemPage({ params }: PageProps) {
  await ensureOwnerAccess();
  const { id } = await params;
  const [item, refs] = await Promise.all([getItem(id), getReferenceData()]);

  if (!item) notFound();

  return (
    <div className="p-6">
      <ItemFormHeader
        title="Edit Item"
        backHref="/clinic/inventory"
        code={item.code}
      />
      <div className="bg-white rounded-lg border p-6">
        <ItemForm refs={refs} initial={item} />
      </div>
    </div>
  );
}
