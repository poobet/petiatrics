'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { BpUserSummary, BusinessPartnerType } from '@petiatrics/types';
import { apiClient, ApiError } from '../../../lib/api-client';
import { Button } from '@petiatrics/ui/button';
import { Input } from '@petiatrics/ui/input';
import { Badge } from '@petiatrics/ui/badge';
import { Loader2, Link2, Link2Off, Search, UserCircle2, AlertCircle } from 'lucide-react';

interface SearchUser {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  role: string;
  status: string;
  businessPartners?: { id: string }[];
}

interface LinkageTabProps {
  bpId: string;
  bpType: BusinessPartnerType | string;
  currentUser: BpUserSummary | null;
  onLinkChanged: (user: BpUserSummary | null) => void;
}

const ROLE_LABEL: Record<string, string> = {
  VET: 'สัตวแพทย์',
  ASSISTANT: 'ผู้ช่วย',
  CASHIER: 'แคชเชียร์',
  STAFF: 'พนักงาน',
  CLINIC_OWNER: 'เจ้าของคลินิก',
  CUSTOMER: 'เจ้าของสัตว์',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  INVITED: 'outline',
  LOCKED: 'destructive',
  PENDING: 'outline',
};

export default function LinkageTab({ bpId, bpType, currentUser, onLinkChanged }: LinkageTabProps) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<SearchUser[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCustomer = bpType === 'CUSTOMER';
  const endpoint = isCustomer ? '/clinic/clients' : '/clinic/staff';

  // Load the candidate list once when the search panel opens
  useEffect(() => {
    if (!searching) return;
    setLoadingCandidates(true);
    setError(null);
    apiClient
      .get<SearchUser[]>(endpoint)
      .then(setCandidates)
      .catch(() => setError('ไม่สามารถโหลดรายชื่อได้'))
      .finally(() => setLoadingCandidates(false));
  }, [searching, endpoint]);

  // Focus the search input when panel opens
  useEffect(() => {
    if (searching) setTimeout(() => inputRef.current?.focus(), 50);
  }, [searching]);

  const filtered = candidates.filter((u) => {
    const q = query.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q))
    );
  });

  async function applyLink(userId: string | null) {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.patch(`/clinic/business-partners/${bpId}`, { linkUserId: userId });

      if (userId === null) {
        onLinkChanged(null);
        setSuccess('ยกเลิกการเชื่อมโยงเรียบร้อยแล้ว');
      } else {
        const chosen = candidates.find((u) => u.id === userId);
        if (chosen) {
          onLinkChanged({
            id: chosen.id,
            name: chosen.name,
            role: chosen.role as any,
            status: chosen.status,
            email: chosen.email,
            username: chosen.username,
          });
          setSuccess(`เชื่อมโยงกับ ${chosen.name} เรียบร้อยแล้ว`);
        }
      }
      setSearching(false);
      setQuery('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 pt-1">
      {/* ── Current linkage status ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">บัญชีที่เชื่อมโยงปัจจุบัน</h3>

        {currentUser ? (
          <div className="rounded-lg border bg-muted/30 p-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-primary/10 p-2">
                <UserCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ROLE_LABEL[currentUser.role] ?? currentUser.role}
                  {currentUser.username && <> · <span className="font-mono">{currentUser.username}</span></>}
                  {currentUser.email && <> · {currentUser.email}</>}
                </p>
                <div className="mt-2">
                  <Badge variant={STATUS_VARIANT[currentUser.status] ?? 'outline'} className="text-[11px]">
                    {currentUser.status}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Link
                href={isCustomer ? `/clinic/clients/${currentUser.id}` : `/clinic/staff`}
                className="text-xs text-primary hover:underline font-medium"
                target="_blank"
              >
                {isCustomer ? 'ดูโปรไฟล์ลูกค้า →' : 'ดูรายชื่อพนักงาน →'}
              </Link>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => applyLink(null)}
                className="text-destructive border-destructive/40 hover:bg-destructive/5 hover:border-destructive"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2Off className="h-3.5 w-3.5 mr-1" />
                )}
                ยกเลิกการเชื่อมโยง
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground">
            ยังไม่ได้เชื่อมโยงกับบัญชีผู้ใช้
          </div>
        )}
      </div>

      {/* ── Feedback messages ─────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && !error && (
        <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-green-800 text-sm">
          ✓ {success}
        </div>
      )}

      {/* ── Search / link panel ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            {searching ? 'เลือกบัญชีที่ต้องการเชื่อมโยง' : 'เปลี่ยนการเชื่อมโยง'}
          </h3>
          {!searching && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { setSearching(true); setSuccess(null); setError(null); }}
            >
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              {currentUser ? 'เปลี่ยนบัญชี' : 'เชื่อมโยงบัญชี'}
            </Button>
          )}
          {searching && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setSearching(false); setQuery(''); }}
              disabled={submitting}
            >
              ยกเลิก
            </Button>
          )}
        </div>

        {searching && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            {/* Search box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isCustomer ? 'ค้นหาชื่อ อีเมล หรือรหัส BP…' : 'ค้นหาชื่อ ชื่อผู้ใช้ หรืออีเมล…'}
                className="pl-9"
              />
            </div>

            {/* Results */}
            {loadingCandidates ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {query ? 'ไม่พบผลลัพธ์' : 'ไม่มีข้อมูล'}
              </p>
            ) : (
              <ul className="divide-y max-h-64 overflow-y-auto rounded-md border">
                {filtered.map((u) => {
                  const alreadyLinked = currentUser?.id === u.id;
                  return (
                    <li
                      key={u.id}
                      className={`flex items-center justify-between px-3 py-2.5 ${
                        alreadyLinked ? 'bg-primary/5' : 'hover:bg-muted/50'
                      } transition-colors`}
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {u.name}
                          {alreadyLinked && (
                            <span className="ml-2 text-[10px] font-normal text-primary">(เชื่อมโยงอยู่)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ROLE_LABEL[u.role] ?? u.role}
                          {u.username && <> · <span className="font-mono">{u.username}</span></>}
                          {u.email && <> · {u.email}</>}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={alreadyLinked ? 'secondary' : 'outline'}
                        disabled={alreadyLinked || submitting}
                        onClick={() => applyLink(u.id)}
                        className="shrink-0 ml-3"
                      >
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'เลือก'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="text-[11px] text-muted-foreground">
              * การเปลี่ยนการเชื่อมโยงจะมีผลทันที ไม่ต้องกดบันทึก
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
