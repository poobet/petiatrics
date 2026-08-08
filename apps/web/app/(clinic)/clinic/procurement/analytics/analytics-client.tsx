'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@petiatrics/ui';
import {
  TrendingUp,
  ArrowLeft,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle,
  BarChart3,
  Award,
  DollarSign,
  ChevronRight,
  Package,
} from 'lucide-react';
import { apiClient } from '../../../../../lib/api-client';
import { Money } from '@/components/ui/money';
import Link from 'next/link';

interface SupplierScorecard {
  supplierId: string;
  supplierName: string;
  totalPOs: number;
  totalGRs: number;
  totalInvoices: number;
  totalSpendMinor: number;
  otifRate: number; // percentage
  defectRate: number; // percentage
  averageLeadTimeDays: number;
}

interface OtifDetail {
  purchaseOrderId: string;
  poCode: string;
  expectedDeliveryDate: string | null;
  actualReceiptDate: string | null;
  isOnTime: boolean;
  isInFull: boolean;
  isOtif: boolean;
}

export default function AnalyticsClient() {
  const [scorecards, setScorecards] = useState<SupplierScorecard[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedScorecard, setSelectedScorecard] = useState<SupplierScorecard | null>(null);
  const [otifDetails, setOtifDetails] = useState<OtifDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    async function loadScorecards() {
      setLoading(true);
      try {
        const data = await apiClient.get<SupplierScorecard[]>('/procurement/analytics/suppliers');
        setScorecards(data ?? []);
      } catch (err) {
        console.error('Failed to load supplier scorecards:', err);
      } finally {
        setLoading(false);
      }
    }
    void loadScorecards();
  }, []);

  // Fetch drill-down details when a supplier is selected
  useEffect(() => {
    if (!selectedSupplierId) {
      setSelectedScorecard(null);
      setOtifDetails([]);
      return;
    }

    async function loadSupplierDetails() {
      setLoadingDetails(true);
      try {
        const [card, otif] = await Promise.all([
          apiClient.get<SupplierScorecard>(`/procurement/analytics/suppliers/${selectedSupplierId}`),
          apiClient.get<OtifDetail[]>(`/procurement/analytics/suppliers/${selectedSupplierId}/otif`),
        ]);
        setSelectedScorecard(card);
        setOtifDetails(otif ?? []);
      } catch (err) {
        console.error('Failed to load supplier analytics details:', err);
      } finally {
        setLoadingDetails(false);
      }
    }
    void loadSupplierDetails();
  }, [selectedSupplierId]);

  // Aggregated clinic metrics
  const aggregatedMetrics = useMemo(() => {
    if (scorecards.length === 0) {
      return { avgOtif: 0, avgDefect: 0, totalSpend: 0, activeSuppliers: 0 };
    }
    const totalSpend = scorecards.reduce((sum, s) => sum + s.totalSpendMinor, 0);
    const sumOtif = scorecards.reduce((sum, s) => sum + s.otifRate, 0);
    const sumDefect = scorecards.reduce((sum, s) => sum + s.defectRate, 0);

    return {
      avgOtif: Math.round((sumOtif / scorecards.length) * 10) / 10,
      avgDefect: Math.round((sumDefect / scorecards.length) * 10) / 10,
      totalSpend,
      activeSuppliers: scorecards.length,
    };
  }, [scorecards]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/clinic/procurement">
            <button className="p-2 border rounded-lg hover:bg-gray-50 transition-colors text-gray-500">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-7 h-7 text-indigo-600" />
              Vendor Performance Analytics
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Track On-Time In-Full (OTIF) fulfillment rates, defects, lead times, and spend summaries.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500">Loading supplier performance charts...</div>
      ) : !selectedSupplierId ? (
        // Scorecard Overview Dashboard
        <>
          {/* Clinic Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border rounded-xl p-5 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Average OTIF Rate</span>
                <Clock className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{aggregatedMetrics.avgOtif}%</div>
              <div className="text-xs text-gray-500">On-Time In-Full target is &gt; 95%</div>
            </div>

            <div className="bg-white border rounded-xl p-5 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Defect & Shortage Rate</span>
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-2xl font-bold text-red-600">{aggregatedMetrics.avgDefect}%</div>
              <div className="text-xs text-gray-500">Lot rejects and receipt shortfalls</div>
            </div>

            <div className="bg-white border rounded-xl p-5 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Supplier Spend</span>
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900"><Money minor={aggregatedMetrics.totalSpend} /></div>
              <div className="text-xs text-gray-500">Aggregated across all suppliers</div>
            </div>

            <div className="bg-white border rounded-xl p-5 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Monitored Suppliers</span>
                <Award className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{aggregatedMetrics.activeSuppliers}</div>
              <div className="text-xs text-gray-500">Suppliers with active purchase records</div>
            </div>
          </div>

          {/* Supplier Scorecards Table */}
          <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="text-sm font-bold text-gray-900">Supplier scorecards summary</h2>
            </div>
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-gray-50 border-b text-gray-700 font-semibold">
                <tr>
                  <th className="p-3.5">Supplier Name</th>
                  <th className="p-3.5 text-center">POs</th>
                  <th className="p-3.5 text-center">GRs</th>
                  <th className="p-3.5 text-center">OTIF Rate</th>
                  <th className="p-3.5 text-center">Defect Rate</th>
                  <th className="p-3.5 text-center">Avg Lead Time</th>
                  <th className="p-3.5 text-right">Total Payments</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {scorecards.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">No vendor performance data compiled yet.</td>
                  </tr>
                ) : (
                  scorecards.map(s => (
                    <tr key={s.supplierId} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-3.5 font-semibold text-gray-900">{s.supplierName}</td>
                      <td className="p-3.5 text-center font-mono text-xs">{s.totalPOs}</td>
                      <td className="p-3.5 text-center font-mono text-xs">{s.totalGRs}</td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                          s.otifRate >= 90 ? 'bg-green-50 text-green-700 border border-green-200' :
                          s.otifRate >= 70 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {s.otifRate}%
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                          s.defectRate <= 3 ? 'bg-green-50 text-green-700' :
                          s.defectRate <= 7 ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {s.defectRate}%
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono text-xs">{s.averageLeadTimeDays} days</td>
                      <td className="p-3.5 text-right font-medium"><Money minor={s.totalSpendMinor} /></td>
                      <td className="p-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedSupplierId(s.supplierId)}
                          className="inline-flex items-center text-xs"
                        >
                          Drill Down <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        // Supplier Drill-Down View
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => setSelectedSupplierId(null)}>
              Back to Overview
            </Button>
            <h2 className="text-xl font-bold text-gray-900">Scorecard: {selectedScorecard?.supplierName}</h2>
          </div>

          {loadingDetails ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading detailed vendor breakdown...</div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              {/* Detailed metrics sidebar */}
              <div className="col-span-1 space-y-4">
                <div className="bg-white border rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm text-gray-900 border-b pb-2 flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" /> Key Indicators
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                        <span>On-Time In-Full (OTIF)</span>
                        <span>{selectedScorecard?.otifRate}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            (selectedScorecard?.otifRate ?? 0) >= 90 ? 'bg-green-500' :
                            (selectedScorecard?.otifRate ?? 0) >= 70 ? 'bg-amber-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${selectedScorecard?.otifRate}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                        <span>Product Defect Rate</span>
                        <span>{selectedScorecard?.defectRate}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            (selectedScorecard?.defectRate ?? 0) <= 2 ? 'bg-green-500' :
                            (selectedScorecard?.defectRate ?? 0) <= 5 ? 'bg-amber-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${selectedScorecard?.defectRate}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="border-t pt-3 flex justify-between items-center text-xs">
                      <span className="text-gray-500">Average Delivery Lead Time</span>
                      <span className="font-semibold text-gray-800">{selectedScorecard?.averageLeadTimeDays} days</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Total Purchase Orders</span>
                      <span className="font-semibold text-gray-800">{selectedScorecard?.totalPOs} orders</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Total Received Shipments</span>
                      <span className="font-semibold text-gray-800">{selectedScorecard?.totalGRs} receipts</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Total Account Spend</span>
                      <Money minor={selectedScorecard?.totalSpendMinor} className="font-semibold text-green-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Order delivery history */}
              <div className="col-span-2 space-y-4">
                <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-indigo-500" />
                      Fulfillment & Receipt Logs
                    </h3>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">OTIF tracking logs</span>
                  </div>

                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 border-b font-semibold text-gray-600">
                      <tr>
                        <th className="p-3">PO Code</th>
                        <th className="p-3">Expected Date</th>
                        <th className="p-3">Actual Date</th>
                        <th className="p-3 text-center">On-Time</th>
                        <th className="p-3 text-center">In-Full</th>
                        <th className="p-3 text-right">OTIF Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otifDetails.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-400">No delivery logs recorded for this supplier.</td>
                        </tr>
                      ) : (
                        otifDetails.map((detail, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-semibold text-gray-900">{detail.poCode}</td>
                            <td className="p-3 text-gray-500">{detail.expectedDeliveryDate ? new Date(detail.expectedDeliveryDate).toLocaleDateString() : 'N/A'}</td>
                            <td className="p-3 text-gray-500">{detail.actualReceiptDate ? new Date(detail.actualReceiptDate).toLocaleDateString() : 'Pending receipt'}</td>
                            <td className="p-3 text-center">
                              {detail.actualReceiptDate ? (
                                detail.isOnTime ? (
                                  <span className="text-green-600 font-semibold">Yes</span>
                                ) : (
                                  <span className="text-red-500 font-semibold">Delayed</span>
                                )
                              ) : (
                                <span className="text-gray-400 font-semibold">-</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {detail.actualReceiptDate ? (
                                detail.isInFull ? (
                                  <span className="text-green-600 font-semibold">Yes</span>
                                ) : (
                                  <span className="text-red-500 font-semibold">Shortfall</span>
                                )
                              ) : (
                                <span className="text-gray-400 font-semibold">-</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {detail.actualReceiptDate ? (
                                detail.isOtif ? (
                                  <span className="inline-flex px-1.5 py-0.5 bg-green-50 text-green-700 font-bold rounded">Pass</span>
                                ) : (
                                  <span className="inline-flex px-1.5 py-0.5 bg-red-50 text-red-700 font-bold rounded">Fail</span>
                                )
                              ) : (
                                <span className="inline-flex px-1.5 py-0.5 bg-gray-50 text-gray-500 font-semibold rounded">Fulfillment</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
