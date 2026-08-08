'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { apiClient } from '@/lib/api-client';
import { useSessionStore } from '@/lib/session-store';
import StockLedgerTable, {
  type MovementHistoryRow,
  type ProductSummaryRow,
  type InventoryLocationInfo,
} from '@/components/inventory/stock-ledger-table';
import LowStockBanner from '@/components/inventory/low-stock-banner';
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@petiatrics/ui';
import { MapPin, AlertTriangle, Filter } from 'lucide-react';

interface StockBalance {
  id: string;
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  sku: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  quantity: number;
  reorderPoint: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRED';
  location?: InventoryLocationInfo | null;
}

interface BalancesResponse {
  data: StockBalance[];
  total: number;
  page: number;
  limit: number;
}

export default function StockLedgerClient() {
  const t = useTranslations('inventory.stock.ledger');
  const activeBranchId = useSessionStore((s) => s.activeBranch?.id);

  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [locations, setLocations] = useState<InventoryLocationInfo[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductSummaryRow | null>(null);
  const [movementHistory, setMovementHistory] = useState<Record<string, MovementHistoryRow[]>>({});
  const [movementLoadingFor, setMovementLoadingFor] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const locs = await apiClient.get<InventoryLocationInfo[]>('/inventory/locations');
      setLocations(locs ?? []);
    } catch {
      setLocations([]);
    }
  }, [activeBranchId]);

  const fetchBalances = useCallback(async () => {
    if (!activeBranchId) {
      setBalances([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '100' });
      if (lowStockOnly) params.set('lowStock', 'true');
      const result = await apiClient.get<BalancesResponse>(`/inventory/stock-balances?${params}`);
      setBalances(result?.data ?? []);
    } catch {
      setBalances([]);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, lowStockOnly]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // Filter balances by location if location filter is active
  const filteredBalances = useMemo(() => {
    if (!selectedLocationId) return balances;
    return balances.filter((b) => b.location?.id === selectedLocationId);
  }, [balances, selectedLocationId]);

  const groupedProducts = useMemo<ProductSummaryRow[]>(() => {
    return filteredBalances
      .reduce<ProductSummaryRow[]>((acc, balance) => {
        const existing = acc.find((item) => item.productId === balance.productId);
        if (existing) {
          existing.totalQuantity += balance.quantity;
        } else {
          acc.push({
            productId: balance.productId,
            productName: balance.productName,
            sku: balance.sku,
            totalQuantity: balance.quantity,
            reorderPoint: balance.reorderPoint,
          });
        }
        return acc;
      }, [])
      .sort((a, b) => a.productName.localeCompare(b.productName));
  }, [filteredBalances]);

  const fetchMovements = useCallback(
    async (productId: string) => {
      if (!activeBranchId) return;

      setMovementLoadingFor(productId);
      try {
        const params = new URLSearchParams({ productId, page: '1', limit: '100' });
        if (selectedLocationId) params.set('locationId', selectedLocationId);
        const result = await apiClient.get<MovementHistoryRow[]>(`/inventory/stock/movements?${params}`);
        const rows = Array.isArray(result)
          ? result
          : (result as { data?: MovementHistoryRow[] })?.data ?? [];
        setMovementHistory((prev) => ({ ...prev, [productId]: rows }));
      } catch {
        setMovementHistory((prev) => ({ ...prev, [productId]: [] }));
      } finally {
        setMovementLoadingFor(null);
      }
    },
    [activeBranchId, selectedLocationId],
  );

  const handleViewDetails = (product: ProductSummaryRow) => {
    setSelectedProduct(product);
    void fetchMovements(product.productId);
  };

  const selectedProductMovements = selectedProduct ? (movementHistory[selectedProduct.productId] ?? []) : [];
  const selectedProductLoading = selectedProduct ? movementLoadingFor === selectedProduct.productId : false;

  return (
    <div className="space-y-4">
      <LowStockBanner />

      {/* Action & Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-lg border shadow-sm">
        <div className="flex flex-wrap gap-2">
          <Link href="/clinic/inventory/receipt">
            <Button variant="default" size="sm">{t('newReceipt')}</Button>
          </Link>
          <Link href="/clinic/inventory/issue">
            <Button variant="outline" size="sm">{t('newIssue')}</Button>
          </Link>
          <Link href="/clinic/inventory/adjustments">
            <Button variant="outline" size="sm">{t('adjustStock')}</Button>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Location Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            <span className="font-medium text-gray-700">Filter Location:</span>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="border rounded-md px-2.5 py-1 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- All Locations (ทุกคลัง) --</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} {loc.isSellable ? '[Sellable]' : '[Defect Bin]'}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer border-l pl-3">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            {t('status.lowStock')}
          </label>
        </div>
      </div>

      <StockLedgerTable
        summaryRows={groupedProducts}
        onViewDetails={handleViewDetails}
        loading={loading}
      />

      <Sheet open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <SheetContent className="sm:max-w-2xl w-[95vw] md:w-[700px] h-full flex flex-col p-6">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="text-xl font-bold">{selectedProduct?.productName}</SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground mt-1">
              {selectedProduct?.sku ? `SKU: ${selectedProduct.sku} | ` : ''}
              {t('columns.totalQuantity')}: <span className="font-semibold text-foreground font-mono">{selectedProduct?.totalQuantity.toLocaleString()}</span>
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {selectedProductLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                {t('loading')}
              </div>
            ) : selectedProductMovements.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{t('columns.date')}</th>
                      <th className="px-3 py-2 text-left font-medium">{t('columns.action')}</th>
                      <th className="px-3 py-2 text-left font-medium">Location (คลัง)</th>
                      <th className="px-3 py-2 text-left font-medium">{t('columns.lotNumber')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('columns.quantityChanged')}</th>
                      <th className="px-3 py-2 text-left font-medium">{t('columns.user')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedProductMovements.map((movement) => {
                      const typeLabel =
                        movement.movementType === 'GOODS_RECEIPT' ||
                        movement.reason === 'REPLENISH' ||
                        movement.referenceType === 'REPLENISHMENT'
                          ? t('actions.receipt')
                          : movement.movementType === 'GOODS_ISSUE' ||
                            movement.reason === 'DISPENSE' ||
                            movement.referenceType === 'VISIT_RECORD'
                          ? t('actions.issue')
                          : movement.reason === 'MANUAL_ADJUSTMENT'
                          ? t('actions.adjust')
                          : movement.reason ?? movement.status ?? t('unknownAction');
                      const quantity = movement.quantityChange ?? movement.delta ?? movement.quantity ?? 0;
                      const user = movement.actor?.name ?? '—';
                      const loc = movement.location;

                      return (
                        <tr key={movement.id} className="border-t hover:bg-muted/10 transition-colors">
                          <td className="px-3 py-2 text-muted-foreground text-xs font-mono">
                            {movement.createdAt ? format(new Date(movement.createdAt), 'dd MMM yyyy HH:mm') : '—'}
                          </td>
                          <td className="px-3 py-2 font-medium text-xs">{typeLabel}</td>
                          <td className="px-3 py-2 text-xs">
                            {loc ? (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-blue-500" />
                                <span>{loc.name}</span>
                                {!loc.isSellable && (
                                  <span className="px-1 py-0.5 rounded text-[9px] bg-red-100 text-red-700 font-bold border border-red-200">
                                    Defect
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{movement.lotNumber ?? '—'}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold">
                            <span className={quantity >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                              {quantity >= 0 ? `+${quantity}` : quantity}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs">{user}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                {t('noMovementHistory')}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
