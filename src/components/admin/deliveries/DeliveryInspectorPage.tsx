/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Sprint 6 PR-1 — Delivery Inspector (READ-ONLY)
 * ═══════════════════════════════════════════════════════════════════════════
 * Surfaces the four v_admin_*deliveries* views and the immutable
 * webhook_delivery_attempts log. No requeue, no replay, no dispatcher
 * invocation. Read path only — every fetch goes through src/services/leadDelivery.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import {
  fetchRecentDeliveries,
  fetchFailedDeliveries,
  fetchDeliveriesByClient,
  fetchDeliveriesByContractor,
} from "@/services/leadDelivery";
import type {
  RecentDeliveryRow,
  FailedDeliveryRow,
  DeliveriesByClientRow,
  DeliveriesByContractorRow,
} from "@/types/leadDelivery";

import { RecentDeliveriesTable } from "./RecentDeliveriesTable";
import { FailedDeliveriesTable } from "./FailedDeliveriesTable";
import { DeliveriesByClientTable } from "./DeliveriesByClientTable";
import { DeliveriesByContractorTable } from "./DeliveriesByContractorTable";
import { DeliveryAttemptLogDrawer } from "./DeliveryAttemptLogDrawer";

export function DeliveryInspectorPage() {
  const [recent, setRecent] = useState<RecentDeliveryRow[]>([]);
  const [failed, setFailed] = useState<FailedDeliveryRow[]>([]);
  const [byClient, setByClient] = useState<DeliveriesByClientRow[]>([]);
  const [byContractor, setByContractor] = useState<DeliveriesByContractorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [r, f, bc, bk] = await Promise.all([
        fetchRecentDeliveries(),
        fetchFailedDeliveries(),
        fetchDeliveriesByClient(),
        fetchDeliveriesByContractor(),
      ]);
      setRecent(r);
      setFailed(f);
      setByClient(bc);
      setByContractor(bk);
      setLastSyncedAt(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.warn("[DeliveryInspector] fetch error:", msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const lastSyncLabel = lastSyncedAt
    ? `Updated ${formatDistanceToNow(lastSyncedAt, { addSuffix: true })}`
    : isLoading
      ? "Loading…"
      : "Not yet loaded";

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Delivery Inspector</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Read-only view of webhook deliveries and the immutable attempt log. {lastSyncLabel}.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAll}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <div className="font-semibold text-destructive">Failed to load delivery data</div>
            <div className="text-muted-foreground mt-0.5 break-all">{error}</div>
          </div>
        </Card>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile label="Recent (24h view)" value={recent.length} />
        <KpiTile label="Failed / dead" value={failed.length} tone={failed.length > 0 ? "warn" : "neutral"} />
        <KpiTile label="Clients seen" value={byClient.length} />
        <KpiTile label="Contractors seen" value={byContractor.length} />
      </div>

      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList className="flex w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="recent" className="flex-1 min-w-[110px]">Recent</TabsTrigger>
          <TabsTrigger value="failed" className="flex-1 min-w-[110px]">
            Failed
            {failed.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-destructive text-destructive-foreground">
                {failed.length > 99 ? "99+" : failed.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="by-client" className="flex-1 min-w-[110px]">By Client</TabsTrigger>
          <TabsTrigger value="by-contractor" className="flex-1 min-w-[120px]">By Contractor</TabsTrigger>
        </TabsList>

        <TabsContent value="recent">
          <RecentDeliveriesTable
            rows={recent}
            isLoading={isLoading}
            onSelectDelivery={setSelectedDeliveryId}
          />
        </TabsContent>

        <TabsContent value="failed">
          <FailedDeliveriesTable
            rows={failed}
            isLoading={isLoading}
            onSelectDelivery={setSelectedDeliveryId}
          />
        </TabsContent>

        <TabsContent value="by-client">
          <DeliveriesByClientTable rows={byClient} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="by-contractor">
          <DeliveriesByContractorTable rows={byContractor} isLoading={isLoading} />
        </TabsContent>
      </Tabs>

      <DeliveryAttemptLogDrawer
        deliveryId={selectedDeliveryId}
        onClose={() => setSelectedDeliveryId(null)}
      />
    </div>
  );
}

function KpiTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warn";
}) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`text-2xl font-bold mt-1 ${
          tone === "warn" && value > 0 ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </Card>
  );
}
