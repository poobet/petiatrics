'use client';

import { useState } from 'react';

interface AuditLog {
  _id: string;
  clinicId?: string;
  entityType: string;
  entityId: string;
  operation: string;
  actorId: string;
  actorRole: string;
  timestamp: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}

interface PageInfo {
  items: AuditLog[];
  total: number;
  page: number;
  pages: number;
}

export default function AdminAuditPage() {
  const [filters, setFilters] = useState({
    clinicId: '',
    entityType: '',
    actorId: '',
    operation: '',
    from: '',
    to: '',
  });
  const [result, setResult] = useState<PageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function search(page = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (filters.clinicId) params.set('clinicId', filters.clinicId);
      if (filters.entityType) params.set('entityType', filters.entityType);
      if (filters.actorId) params.set('actorId', filters.actorId);
      if (filters.operation) params.set('operation', filters.operation);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);

      const res = await fetch(`/api/v1/audit/logs?${params}`);
      const json = await res.json();
      setResult(json.data ?? json);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Audit Logs</h1>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 p-4 bg-gray-50 rounded-lg border">
        {[
          { label: 'Clinic ID', key: 'clinicId', placeholder: 'Filter by clinic…' },
          { label: 'Entity Type', key: 'entityType', placeholder: 'e.g. Invoice, Patient…' },
          { label: 'Actor ID', key: 'actorId', placeholder: 'User ID…' },
          { label: 'Operation', key: 'operation', placeholder: 'e.g. create, update…' },
          { label: 'From', key: 'from', type: 'date' },
          { label: 'To', key: 'to', type: 'date' },
        ].map(({ label, key, placeholder, type = 'text' }) => (
          <div key={key}>
            <label className="block text-xs text-gray-500 mb-1">{label}</label>
            <input
              type={type}
              value={filters[key as keyof typeof filters]}
              onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
        <div className="flex items-end">
          <button
            onClick={() => search(1)}
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-md py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {result && (
        <>
          <p className="text-sm text-gray-500 mb-2">
            {result.total} entries · page {result.page} of {result.pages}
          </p>
          <div className="space-y-2">
            {result.items.map((log) => (
              <div key={log._id} className="border rounded-lg bg-white overflow-hidden">
                <button
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50"
                  onClick={() => setExpandedId(expandedId === log._id ? null : log._id)}
                >
                  <div className="flex items-center gap-3 text-sm min-w-0">
                    <span className="font-mono text-xs text-gray-400 shrink-0">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs shrink-0">
                      {log.operation}
                    </span>
                    <span className="font-medium truncate">{log.entityType}</span>
                    <span className="text-gray-400 text-xs truncate">{log.entityId}</span>
                  </div>
                  <span className="text-gray-400 text-xs shrink-0">{log.actorRole}</span>
                </button>
                {expandedId === log._id && (
                  <div className="border-t px-4 py-3 bg-gray-50 text-xs space-y-3">
                    <div>
                      <p className="font-semibold text-gray-500 mb-1">Actor ID</p>
                      <p className="font-mono">{log.actorId}</p>
                    </div>
                    {log.clinicId && (
                      <div>
                        <p className="font-semibold text-gray-500 mb-1">Clinic ID</p>
                        <p className="font-mono">{log.clinicId}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="font-semibold text-gray-500 mb-1">Before</p>
                        <pre className="bg-white border rounded p-2 overflow-x-auto text-xs">
                          {log.beforeState ? JSON.stringify(log.beforeState, null, 2) : 'null'}
                        </pre>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-500 mb-1">After</p>
                        <pre className="bg-white border rounded p-2 overflow-x-auto text-xs">
                          {log.afterState ? JSON.stringify(log.afterState, null, 2) : 'null'}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {result.pages > 1 && (
            <div className="flex gap-2 justify-center mt-4">
              {Array.from({ length: result.pages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => search(i + 1)}
                  disabled={result.page === i + 1}
                  className={`px-3 py-1 rounded text-sm border ${result.page === i + 1 ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
