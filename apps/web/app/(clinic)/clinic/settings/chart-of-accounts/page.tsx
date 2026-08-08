'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Search,
  Shield,
  User,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  X,
  Lock,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface GLAccount {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | 'COGS';
  isSystem: boolean;
  isActive: boolean;
}

const ACCOUNT_CATEGORIES = [
  { key: 'ASSET', label: '1000s Assets', icon: '💰' },
  { key: 'LIABILITY', label: '2000s Liabilities', icon: '💳' },
  { key: 'EQUITY', label: '3000s Equity', icon: '🏛️' },
  { key: 'REVENUE', label: '4000s Revenue', icon: '📈' },
  { key: 'EXPENSE', label: '5000s/6000s Expenses & COGS', icon: '📉' },
] as const;

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('ASSET');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<string>('ASSET');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Deactivation confirmation modal
  const [deactivatingAccount, setDeactivatingAccount] = useState<GLAccount | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<GLAccount[]>('/accounting/gl-accounts');
      setAccounts(Array.isArray(data) ? data : []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      // Tab matching
      let matchesTab = false;
      if (activeTab === 'EXPENSE') {
        matchesTab = acc.type === 'EXPENSE' || acc.type === 'COGS';
      } else {
        matchesTab = acc.type === activeTab;
      }

      // Search matching
      const matchesSearch =
        !searchQuery ||
        acc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.name.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesTab && matchesSearch;
    });
  }, [accounts, activeTab, searchQuery]);

  const handleCreateSubAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    try {
      await apiClient.post('/accounting/gl-accounts', {
        code: newCode,
        name: newName,
        type: newType,
      });

      setIsModalOpen(false);
      setNewCode('');
      setNewName('');
      fetchAccounts();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create sub-account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivatingAccount) return;
    try {
      await apiClient.delete(`/accounting/gl-accounts/${deactivatingAccount.id}`);
      setDeactivatingAccount(null);
      fetchAccounts();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate account');
    }
  };

  const openCreateModal = () => {
    setNewType(activeTab === 'EXPENSE' ? 'EXPENSE' : activeTab);
    setNewCode('');
    setNewName('');
    setErrorMessage('');
    setIsModalOpen(true);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Breadcrumb */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/clinic/settings"
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-7 h-7 text-indigo-600" />
              Chart of Accounts (COA) Management
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Strict hybrid accounting — Protected System Control Accounts & User Sub-Accounts
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-sm transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Sub-Account</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl">
          {ACCOUNT_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveTab(cat.key)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === cat.key
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search code or account name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* GL Accounts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200 font-semibold">
            <tr>
              <th className="px-6 py-3.5">Code</th>
              <th className="px-6 py-3.5">Account Name</th>
              <th className="px-6 py-3.5">Type</th>
              <th className="px-6 py-3.5">Protection Level</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                  Loading Chart of Accounts...
                </td>
              </tr>
            ) : filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                  No GL accounts found for this category
                </td>
              </tr>
            ) : (
              filteredAccounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-slate-900">{acc.code}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{acc.name}</td>
                  <td className="px-6 py-4 text-xs">
                    <span className="font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                      {acc.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {acc.isSystem ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                        <Lock className="w-3 h-3 text-indigo-600" />
                        <span>Protected System Account</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200">
                        <User className="w-3 h-3" />
                        <span>User Account</span>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {acc.isActive ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                        <X className="w-3.5 h-3.5" />
                        <span>Deactivated</span>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {acc.isSystem ? (
                      <span className="text-xs text-slate-400 italic cursor-not-allowed" title="System accounts cannot be deleted or deactivated">
                        Protected
                      </span>
                    ) : acc.isActive ? (
                      <button
                        onClick={() => setDeactivatingAccount(acc)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Inactive</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Sub-Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                Add User Sub-Account
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubAccount} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Category Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="ASSET">ASSET (1000s)</option>
                  <option value="LIABILITY">LIABILITY (2000s)</option>
                  <option value="EQUITY">EQUITY (3000s)</option>
                  <option value="REVENUE">REVENUE (4000s)</option>
                  <option value="EXPENSE">EXPENSE (5000s/6000s)</option>
                  <option value="COGS">COGS (5000s)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Code (4-6 digits)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 6090"
                  pattern="^[0-9]{4,6}$"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Custom Pet Grooming Expense"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Sub-Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivation Confirmation Dialog */}
      {deactivatingAccount && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-7 h-7" />
              <h3 className="text-lg font-bold text-slate-900">Deactivate Account?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to deactivate <strong className="text-slate-900">{deactivatingAccount.code} - {deactivatingAccount.name}</strong>?
              This will soft-deactivate the account (`isActive: false`) to preserve all existing GL audit logs.
            </p>

            <div className="pt-3 border-t flex justify-end gap-3">
              <button
                onClick={() => setDeactivatingAccount(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                className="px-5 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm"
              >
                Deactivate Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
