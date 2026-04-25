/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONTRACTOR ACCOUNTS TAB — Admin credit & account management
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Coins, Plus, Minus, History, Unlock, Building2, RefreshCw,
} from "lucide-react";
import { invokeAdminData } from "@/services/adminDataService";

/* ── Types ────────────────────────────────────────────────────────────── */

interface ContractorAccount {
  id: string;
  company_name: string;
  contact_email: string;
  status: string;
  created_at: string;
  credit_balance: number;
  unlock_count: number;
  auth_email: string | null;
  last_sign_in: string | null;
  has_contractor_record: boolean;
  contractor_record_id: string | null;
  marketplace_company_name: string | null;
  routing_setup_completed_at: string | null;
}

interface LedgerEntry {
  id: string;
  contractor_id: string;
  delta: number;
  balance_after: number;
  entry_type: string;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

interface UnlockEntry {
  id: string;
  contractor_id: string;
  lead_id: string;
  unlocked_at: string;
  lead: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    county: string | null;
    grade: string | null;
    window_count: number | null;
    quote_amount: number | null;
  } | null;
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function statusColor(status: string) {
  switch (status) {
    case "active": return "default";
    case "suspended": return "destructive";
    case "delinquent": return "secondary";
    default: return "outline";
  }
}

function entryTypeLabel(t: string) {
  switch (t) {
    case "seed": return "Seed";
    case "unlock_debit": return "Unlock";
    case "admin_adjustment": return "Adjustment";
    case "refund": return "Refund";
    case "correction": return "Correction";
    default: return t;
  }
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── Component ────────────────────────────────────────────────────────── */

export function ContractorAccountsTab() {
  const [accounts, setAccounts] = useState<ContractorAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Adjust credits modal
  const [adjustTarget, setAdjustTarget] = useState<ContractorAccount | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustType, setAdjustType] = useState("admin_adjustment");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // Ledger drawer
  const [ledgerTarget, setLedgerTarget] = useState<ContractorAccount | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Unlock history drawer
  const [unlockTarget, setUnlockTarget] = useState<ContractorAccount | null>(null);
  const [unlockEntries, setUnlockEntries] = useState<UnlockEntry[]>([]);
  const [unlockLoading, setUnlockLoading] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await invokeAdminData("list_contractor_accounts" as any);
      setAccounts(data ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load contractor accounts";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  /* ── Adjust Credits ──────────────────────────────────────────────── */

  const handleAdjust = async () => {
    if (!adjustTarget) return;
    const delta = parseInt(adjustDelta, 10);
    if (isNaN(delta) || delta === 0) {
      toast.error("Enter a non-zero integer");
      return;
    }
    setAdjusting(true);
    try {
      const result = await invokeAdminData("adjust_contractor_credits" as any, {
        contractor_id: adjustTarget.id,
        delta,
        entry_type: adjustType,
        notes: adjustNotes || null,
      } as any);
      if (result?.success === false) {
        toast.error(result.message || "Adjustment failed");
      } else {
        toast.success(`Credits adjusted: ${delta > 0 ? "+" : ""}${delta}. New balance: ${result?.new_balance ?? "?"}`);
        setAdjustTarget(null);
        setAdjustDelta("");
        setAdjustNotes("");
        fetchAccounts();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Adjustment failed");
    } finally {
      setAdjusting(false);
    }
  };

  /* ── Ledger ──────────────────────────────────────────────────────── */

  const openLedger = async (acct: ContractorAccount) => {
    setLedgerTarget(acct);
    setLedgerLoading(true);
    try {
      const data = await invokeAdminData("get_contractor_ledger" as any, {
        contractor_id: acct.id,
      } as any);
      setLedgerEntries(data ?? []);
    } catch {
      toast.error("Failed to load ledger");
    } finally {
      setLedgerLoading(false);
    }
  };

  /* ── Unlock History ──────────────────────────────────────────────── */

  const openUnlocks = async (acct: ContractorAccount) => {
    setUnlockTarget(acct);
    setUnlockLoading(true);
    try {
      const data = await invokeAdminData("get_contractor_unlocks" as any, {
        contractor_id: acct.id,
      } as any);
      setUnlockEntries(data ?? []);
    } catch {
      toast.error("Failed to load unlock history");
    } finally {
      setUnlockLoading(false);
    }
  };

  /* ── Render ──────────────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-slate-700 mb-3" />
          <p className="text-slate-700">No contractor accounts found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Contractor Accounts</h2>
        <Button variant="outline" size="sm" onClick={fetchAccounts}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-700">Total Accounts</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{accounts.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-700">Total Credits Outstanding</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{accounts.reduce((s, a) => s + a.credit_balance, 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-700">Total Unlocks</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{accounts.reduce((s, a) => s + a.unlock_count, 0)}</p></CardContent>
        </Card>
      </div>

      {/* ── Accounts Table ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Auth Email</TableHead>
                <TableHead className="text-center">Credits</TableHead>
                <TableHead className="text-center">Unlocks</TableHead>
                <TableHead>Bridge</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acct) => (
                <TableRow key={acct.id}>
                  <TableCell className="font-medium">
                    {acct.company_name}
                    <span className="block text-xs text-slate-700">{acct.contact_email}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={statusColor(acct.status) as any}>{acct.status}</Badge>
                      {acct.has_contractor_record && !acct.routing_setup_completed_at && (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-sm">Needs Setup</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{acct.auth_email ?? "—"}</span>
                    {acct.last_sign_in && (
                      <span className="block text-xs text-slate-700">
                        Last login: {fmtDate(acct.last_sign_in)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold">
                      <Coins className="h-3.5 w-3.5 text-amber-500" />
                      {acct.credit_balance}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm">{acct.unlock_count}</TableCell>
                  <TableCell>
                    {acct.has_contractor_record ? (
                      <Badge variant="outline" className="text-xs">Linked</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">No bridge</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Add / Remove Credits"
                        onClick={() => {
                          setAdjustTarget(acct);
                          setAdjustDelta("");
                          setAdjustNotes("");
                          setAdjustType("admin_adjustment");
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="View Ledger"
                        onClick={() => openLedger(acct)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Unlock History"
                        onClick={() => openUnlocks(acct)}
                      >
                        <Unlock className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Adjust Credits Dialog ──────────────────────────────────── */}
      <Dialog open={!!adjustTarget} onOpenChange={(o) => !o && setAdjustTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Credits — {adjustTarget?.company_name}</DialogTitle>
            <DialogDescription>
              Current balance: <strong>{adjustTarget?.credit_balance ?? 0}</strong> credits
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button
                variant={adjustDelta.startsWith("-") ? "outline" : "default"}
                size="sm"
                onClick={() => setAdjustDelta((d) => {
                  const n = Math.abs(parseInt(d, 10) || 0);
                  return String(n || "");
                })}
              >
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
              <Button
                variant={adjustDelta.startsWith("-") ? "default" : "outline"}
                size="sm"
                onClick={() => setAdjustDelta((d) => {
                  const n = Math.abs(parseInt(d, 10) || 0);
                  return n ? `-${n}` : "-";
                })}
              >
                <Minus className="h-3 w-3 mr-1" /> Remove
              </Button>
            </div>
            <Input
              type="number"
              placeholder="Amount (e.g. 10 or -5)"
              value={adjustDelta}
              onChange={(e) => setAdjustDelta(e.target.value)}
            />
            <Select value={adjustType} onValueChange={setAdjustType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin_adjustment">Adjustment</SelectItem>
                <SelectItem value="seed">Seed (initial load)</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
                <SelectItem value="correction">Correction</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Notes (optional)"
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustTarget(null)}>Cancel</Button>
            <Button onClick={handleAdjust} disabled={adjusting}>
              {adjusting ? "Processing…" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Ledger Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!ledgerTarget} onOpenChange={(o) => !o && setLedgerTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Credit Ledger — {ledgerTarget?.company_name}</DialogTitle>
            <DialogDescription>All credit changes for this contractor account.</DialogDescription>
          </DialogHeader>
          {ledgerLoading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : ledgerEntries.length === 0 ? (
            <p className="py-8 text-center text-slate-700">No ledger entries.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(e.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={e.delta > 0 ? "default" : "destructive"} className="text-xs">
                        {entryTypeLabel(e.entry_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm ${e.delta > 0 ? "text-green-600" : "text-red-600"}`}>
                      {e.delta > 0 ? `+${e.delta}` : e.delta}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{e.balance_after}</TableCell>
                    <TableCell className="text-xs text-slate-700 max-w-[200px] truncate">{e.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Unlock History Dialog ──────────────────────────────────── */}
      <Dialog open={!!unlockTarget} onOpenChange={(o) => !o && setUnlockTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Unlock History — {unlockTarget?.company_name}</DialogTitle>
            <DialogDescription>All leads unlocked by this contractor.</DialogDescription>
          </DialogHeader>
          {unlockLoading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : unlockEntries.length === 0 ? (
            <p className="py-8 text-center text-slate-700">No unlocks yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>County</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">Windows</TableHead>
                  <TableHead className="text-right">Quote</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unlockEntries.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(u.unlocked_at)}</TableCell>
                    <TableCell className="text-sm">
                      {u.lead
                        ? `${u.lead.first_name ?? ""} ${u.lead.last_name ?? ""}`.trim() || u.lead_id.slice(0, 8)
                        : u.lead_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-sm">{u.lead?.county ?? "—"}</TableCell>
                    <TableCell>
                      {u.lead?.grade ? (
                        <Badge variant="outline">{u.lead.grade}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">{u.lead?.window_count ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {u.lead?.quote_amount
                        ? `$${Number(u.lead.quote_amount).toLocaleString()}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
