'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Trash2, ShoppingCart, AlertTriangle, Lock, CheckCircle, X, Loader2, CreditCard } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useSessionStore } from '@/lib/session-store';
import { formatMinor } from '@/lib/currency';
import { cn } from '@petiatrics/ui';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProductResult {
  id: string;
  name: string;
  code: string;
  sku: string;
  baseSellingPrice: number;
  dispensingCategory: string;
  defaultVatType: string;
  itemType: string;
  category?: { name: string };
}

interface CartLine {
  productId: string;
  name: string;
  code: string;
  dispensingCategory: string;
  vatType: string;
  quantity: number;
  unitPriceMinor: number; // always in satang
  /** Computed client-side. Refreshed when context changes. */
  vatRateBps: number;
}

type SalesContext = 'OTC' | 'CLINICAL';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CONTROLLED = ['Dangerous_Drug', 'Specially_Controlled_Drug', 'Clinic_Use_Only'];

function resolveClientVatBps(vatType: string, ctx: SalesContext): number {
  if (ctx === 'CLINICAL') return 700;
  if (vatType === 'VAT_7') return 700;
  return 0; // VAT_EXEMPT, NON_VAT
}

function computeLineTotal(line: CartLine) {
  const subtotal = Math.round(line.quantity * line.unitPriceMinor);
  const vat = Math.round(subtotal * line.vatRateBps / 10_000);
  return { subtotal, vat, total: subtotal + vat };
}

// ─── PIN Override Modal ───────────────────────────────────────────────────────

interface PinModalProps {
  productName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function PinOverrideModal({ productName, onSuccess, onCancel }: PinModalProps) {
  const [supervisorId, setSupervisorId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleVerify() {
    if (!supervisorId || pin.length < 4) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/auth/pin/verify', { supervisorUserId: supervisorId, pin });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN verification failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Supervisor Override Required</h2>
            <p className="text-white/80 text-sm">Controlled substance authorization</p>
          </div>
          <button onClick={onCancel} className="ml-auto text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>{productName}</strong> is a controlled substance. A VET or Clinic Owner must authorize this dispensing.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor User ID</label>
              <input
                id="pos-pin-supervisor-id"
                type="text"
                value={supervisorId}
                onChange={(e) => setSupervisorId(e.target.value)}
                placeholder="Supervisor's user ID"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor PIN</label>
              <input
                id="pos-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4–8 digit PIN"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 tracking-[0.5em]"
                onKeyDown={(e) => e.key === 'Enter' && void handleVerify()}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              id="pos-pin-cancel"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              id="pos-pin-verify"
              onClick={() => void handleVerify()}
              disabled={loading || pin.length < 4 || !supervisorId}
              className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Authorize
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main POS Workspace ───────────────────────────────────────────────────────

export function PosWorkspaceClient() {
  const activeBranch = useSessionStore((s) => s.activeBranch);
  const user = useSessionStore((s) => s.user);

  const [context, setContext] = useState<SalesContext>('OTC');
  const [visitId, setVisitId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pinTarget, setPinTarget] = useState<ProductResult | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const searchRef = useRef<NodeJS.Timeout | null>(null);

  // Recompute VAT rates when context changes
  useEffect(() => {
    setCart((prev) =>
      prev.map((line) => ({
        ...line,
        vatRateBps: resolveClientVatBps(line.vatType, context),
      })),
    );
  }, [context]);

  // ── Product Search ──────────────────────────────────────────────────────
  async function doSearch(q: string) {
    if (!q.trim() || !activeBranch) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await apiClient.get<{ items: ProductResult[] }>(
        `/inventory/products?search=${encodeURIComponent(q)}&itemType=INVENTORY`,
      );
      setSearchResults(res?.items ?? []);
    } finally {
      setSearching(false);
    }
  }

  function handleSearchInput(value: string) {
    setSearchQuery(value);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => void doSearch(value), 350);
  }

  // ── Add to Cart ─────────────────────────────────────────────────────────
  function addToCart(product: ProductResult, overrideControlled = false) {
    const isControlled = CONTROLLED.includes(product.dispensingCategory);
    if (isControlled && context === 'OTC' && !overrideControlled) {
      setPinTarget(product);
      return;
    }

    const vatRateBps = resolveClientVatBps(product.defaultVatType, context);
    const unitPriceMinor = Math.round(Number(product.baseSellingPrice) * 100);

    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          code: product.code,
          dispensingCategory: product.dispensingCategory,
          vatType: product.defaultVatType,
          quantity: 1,
          unitPriceMinor,
          vatRateBps,
        },
      ];
    });
    setSearchQuery('');
    setSearchResults([]);
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) { removeFromCart(productId); return; }
    setCart((prev) => prev.map((l) => l.productId === productId ? { ...l, quantity: qty } : l));
  }

  // ── Totals ──────────────────────────────────────────────────────────────
  const totals = cart.reduce(
    (acc, line) => {
      const { subtotal, vat, total } = computeLineTotal(line);
      return { subtotal: acc.subtotal + subtotal, vat: acc.vat + vat, total: acc.total + total };
    },
    { subtotal: 0, vat: 0, total: 0 },
  );

  // ── Checkout ────────────────────────────────────────────────────────────
  async function handleCheckout(method: string = 'CASH', referenceNo?: string) {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        visitId: context === 'CLINICAL' ? (visitId || null) : null,
        lineItems: cart.map((l) => ({
          itemType: 'PRODUCT' as const,
          description: l.name,
          quantity: l.quantity,
          unitPriceMinor: l.unitPriceMinor,
          sourceReferenceId: l.productId,
        })),
      };
      const invoice: any = await apiClient.post('/billing/invoices', payload);

      // Issue payment & trigger double-entry GL posting
      await apiClient.post('/billing/payments', {
        invoiceId: invoice.id,
        cashierUserId: user?.id || 'cashier-system',
        totalMinor: invoice.totalMinor,
        tenders: [
          {
            method,
            amountMinor: invoice.totalMinor,
            referenceNo: referenceNo || undefined,
          },
        ],
      });

      setSuccess(`Invoice #${invoice.id.slice(0, 8)} paid successfully via ${method}! GL journal posted.`);
      setCart([]);
      setVisitId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!activeBranch) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">POS Checkout</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Please select a branch from the top navigation to use the POS.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">POS Checkout</h1>
          <p className="text-xs text-gray-500 mt-0.5">Branch: {activeBranch.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── LEFT: Product Search + Context ── */}
        <div className="lg:col-span-3 space-y-4">

          {/* Context Selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Sales Context</p>
            <div className="flex gap-3">
              {(['OTC', 'CLINICAL'] as const).map((ctx) => (
                <button
                  key={ctx}
                  id={`pos-context-${ctx.toLowerCase()}`}
                  onClick={() => setContext(ctx)}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                    context === ctx
                      ? ctx === 'CLINICAL'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                        : 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {ctx === 'OTC' ? '🛒 OTC / Retail' : '🏥 Clinical Visit'}
                </button>
              ))}
            </div>
            {context === 'CLINICAL' && (
              <input
                id="pos-visit-id"
                type="text"
                value={visitId}
                onChange={(e) => setVisitId(e.target.value)}
                placeholder="Visit ID (optional — links invoice to visit)"
                className="mt-3 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
            {context === 'CLINICAL' && (
              <p className="mt-2 text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-1.5">
                ✓ All items will attract 7% VAT. Controlled substances are permitted with a VET's authorization.
              </p>
            )}
            {context === 'OTC' && (
              <p className="mt-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-1.5">
                ⚠ VAT is applied per product master. Controlled substances require supervisor PIN override.
              </p>
            )}
          </div>

          {/* Product Search */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Product Search</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="pos-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Search by name, code, or SKU…"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="off"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {searchResults.map((product) => {
                  const isControlled = CONTROLLED.includes(product.dispensingCategory);
                  const blockedInOtc = isControlled && context === 'OTC';
                  return (
                    <button
                      key={product.id}
                      id={`pos-product-${product.id}`}
                      onClick={() => addToCart(product)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.code} · {product.category?.name}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isControlled && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                            {blockedInOtc ? '🔒 PIN Required' : '⚠ Controlled'}
                          </span>
                        )}
                        <span className="text-sm font-semibold text-gray-900">
                          {formatMinor(Math.round(Number(product.baseSellingPrice) * 100))}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {searchQuery && !searching && searchResults.length === 0 && (
              <p className="mt-2 text-sm text-gray-400 text-center py-4">No products found for &quot;{searchQuery}&quot;</p>
            )}
          </div>

          {/* Cart Items */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <ShoppingCart className="w-4 h-4 text-gray-400" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cart</p>
              <span className="ml-auto text-xs text-gray-400">{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
            </div>

            {cart.length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingCart className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Cart is empty</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {cart.map((line) => {
                  const { subtotal, vat, total } = computeLineTotal(line);
                  return (
                    <div key={line.productId} className="px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{line.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatMinor(line.unitPriceMinor)} × &nbsp;
                          <span className={`font-medium ${line.vatRateBps > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                            VAT {(line.vatRateBps / 100).toFixed(0)}%
                          </span>
                          {line.vatRateBps > 0 && <span className="text-gray-400"> (+{formatMinor(vat)})</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateQty(line.productId, line.quantity - 1)}
                            className="px-2.5 py-1 hover:bg-gray-50 text-gray-600 text-sm font-medium"
                          >−</button>
                          <span className="px-3 text-sm font-semibold min-w-[2rem] text-center">{line.quantity}</span>
                          <button
                            onClick={() => updateQty(line.productId, line.quantity + 1)}
                            className="px-2.5 py-1 hover:bg-gray-50 text-gray-600 text-sm font-medium"
                          >+</button>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 w-20 text-right">{formatMinor(total)}</span>
                        <button
                          onClick={() => removeFromCart(line.productId)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Summary + Checkout ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Order Summary</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span className="font-medium text-gray-900">{formatMinor(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>VAT</span>
                <span className="font-medium text-blue-600">{formatMinor(totals.vat)}</span>
              </div>
              <div className="h-px bg-gray-100 my-3" />
              <div className="flex justify-between text-base font-bold text-gray-900">
                <span>Total</span>
                <span>{formatMinor(totals.total)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {[
                  { id: 'CASH', label: '💵 Cash' },
                  { id: 'QR_PROMPTPAY', label: '📱 PromptPay' },
                  { id: 'CREDIT_CARD', label: '💳 Credit' },
                  { id: 'BANK_TRANSFER', label: '🏛️ Transfer' },
                  { id: 'AR_CREDIT', label: '📝 Credit Term' },
                  { id: 'WALLET_DEPOSIT', label: '👛 Deposit' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={cn(
                      'py-2 px-1.5 rounded-lg border text-center font-medium transition-all',
                      paymentMethod === m.id
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-sm'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="mt-4 flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2.5">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <button
              id="pos-checkout-btn"
              onClick={() => void handleCheckout(paymentMethod)}
              disabled={cart.length === 0 || submitting}
              className="mt-5 w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-200"
            >
              {submitting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <CreditCard className="w-4 h-4" />}
              {submitting ? 'Processing…' : `Pay & Issue (${paymentMethod.replace('_', ' ')})`}
            </button>

            <button
              id="pos-clear-btn"
              onClick={() => { setCart([]); setError(''); setSuccess(''); }}
              disabled={cart.length === 0}
              className="mt-2 w-full py-2.5 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Clear Cart
            </button>
          </div>
        </div>
      </div>

      {/* PIN Override Modal */}
      {pinTarget && (
        <PinOverrideModal
          productName={pinTarget.name}
          onSuccess={() => { const p = pinTarget; setPinTarget(null); addToCart(p, true); }}
          onCancel={() => setPinTarget(null)}
        />
      )}
    </div>
  );
}
