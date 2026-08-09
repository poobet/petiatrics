import type { Metadata } from 'next';
import ItemCategorySettingsClient from '@/components/inventory/item-category-settings-client';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'ตั้งค่าหมวดหมู่สินค้า & ผูกบัญชี GL | Petiatrics',
};

export default function ItemCategoriesSettingsPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/clinic/settings" className="hover:underline">
          การตั้งค่า
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">หมวดหมู่สินค้า & ผูกบัญชี GL</span>
      </div>

      <ItemCategorySettingsClient />
    </div>
  );
}
