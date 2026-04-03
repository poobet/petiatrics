'use client';

import { useState, useEffect } from 'react';

interface AuditLog {
  _id: string;
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

export default function ClinicAuditPage() {
  const [filters, setFilters] = useState({
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

  useEffect(() => {
    search(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Audit Logs</h1>
      <p className="text-sm text-gray-500 mb-4">Showing all operations performed within your clinic.</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={filters.entityType}
          onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}
          placeholder="Entity type…"
          className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          value={filters.operation}
          onChange={(e) => setFilters((f) => ({ ...f, operation: e.target.value }))}
          placeholder="Operation…"
          className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => search(1)}
          disabled={loading}
          className="bg-blue-600 text-white rounded-md px-4 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Filter'}
        </button>
      </div>

      {result && (
        <>
          <p className="text-xs text-gray-400 mb-2">{result.total} entries</p>
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
                  </div>
                  <span className="text-gray-400 text-xs shrink-0">{log.actorRole}</span>
                </button>
                {expandedId === log._id && (
                  <div className="border-t px-4 py-3 bg-gray-50 text-xs space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="font-semibold text-gray-500 mb-1">Before</p>
                        <pre className="bg-white border rounded p-2 overflow-x-auto">
                          {log.beforeState ? JSON.stringify(log.beforeState, null, 2) : 'null'}
                        </pre>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-500 mb-1">After</p>
                        <pre className="bg-white border rounded p-2 overflow-x-auto">
                          {log.afterState ? JSON.stringify(log.afterState, null, 2) : 'null'}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
