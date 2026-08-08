'use client';

import { useState, useEffect } from 'react';
import { BookOpen, FileText, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

import { Money } from '@/components/ui/money';

export default function AccountingJournalPage() {
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get('/billing/accounting/trial-balance')
      .then((data) => setReport(Array.isArray(data) ? data : []))
      .catch(() => setReport([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-blue-600" />
          General Ledger & Trial Balance
        </h1>
        <p className="text-slate-500 text-sm mt-1">Automated double-entry accounting trial balance</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-6 py-3.5">Account Code</th>
              <th className="px-6 py-3.5">Account Name</th>
              <th className="px-6 py-3.5">Type</th>
              <th className="px-6 py-3.5 text-right">Debit (฿)</th>
              <th className="px-6 py-3.5 text-right">Credit (฿)</th>
              <th className="px-6 py-3.5 text-right">Balance (฿)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">Loading trial balance...</td>
              </tr>
            ) : report.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">No posted GL entries recorded yet</td>
              </tr>
            ) : (
              report.map((row) => (
                <tr key={row.glAccountId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono font-medium text-slate-800">{row.code}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{row.name}</td>
                  <td className="px-6 py-4 text-xs font-semibold text-slate-500">{row.type}</td>
                  <td className="px-6 py-4 text-right font-mono text-emerald-600"><Money minor={row.debitMinor} /></td>
                  <td className="px-6 py-4 text-right font-mono text-blue-600"><Money minor={row.creditMinor} /></td>
                  <td className="px-6 py-4 text-right font-mono font-semibold text-slate-900"><Money minor={row.balanceMinor} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
