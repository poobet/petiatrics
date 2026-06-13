'use client';

import { useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';

interface Item {
  id: string;
  name: string;
  sku: string | null;
  requiresBatchAndExpiryTracking: boolean;
  itemType: string;
}

interface Props {
  onSelect: (item: Item) => void;
  placeholder?: string;
  itemType?: string;
  onChange?: (val: string) => void;
}

export default function ItemSearchCombobox({
  onSelect,
  placeholder = 'Search items…',
  itemType = 'INVENTORY',
  onChange,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    try {
      const typeParam = itemType ? `&itemType=${itemType}` : '';
      const res = await apiClient.get<{ data?: Item[]; items?: Item[] }>(
        `/inventory/products?search=${encodeURIComponent(q)}${typeParam}&perPage=20`,
        );
      setResults((res as any)?.data ?? (res as any)?.items ?? []);
    } catch {
      setResults([]);
    }
  }, [itemType]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(null);
    clearTimeout(timeoutRef.current ?? undefined);
    timeoutRef.current = setTimeout(() => search(val), 250);
    setOpen(true);
    onChange?.(val);
  };

  const handleSelect = (item: Item) => {
    setSelected(item);
    setQuery(`${item.name}${item.sku ? ` (${item.sku})` : ''}`);
    setOpen(false);
    setResults([]);
    onSelect(item);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => query.length >= 2 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-y-auto">
          {results.map((item) => (
            <li
              key={item.id}
              onMouseDown={() => handleSelect(item)}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent"
            >
              <span className="font-medium">{item.name}</span>
              {item.sku && <span className="ml-2 text-xs text-muted-foreground">{item.sku}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
