/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Sprint 5 — Lead Delivery service (READ-ONLY admin queries)
 * ═══════════════════════════════════════════════════════════════════════════
 * Wraps the four v_admin_* delivery views and exposes a typed reader for
 * the immutable webhook_delivery_attempts log.
 *
 * NOTHING here writes. The dispatch-lead edge function is the only producer.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  DeliveriesByClientRow,
  DeliveriesByContractorRow,
  DeliveryAttemptRow,
  FailedDeliveryRow,
  RecentDeliveryRow,
} from "@/types/leadDelivery";

export async function fetchRecentDeliveries(): Promise<RecentDeliveryRow[]> {
  const { data, error } = await supabase
    .from("v_admin_recent_deliveries" as never)
    .select("*");
  if (error) throw error;
  return (data ?? []) as RecentDeliveryRow[];
}

export async function fetchFailedDeliveries(): Promise<FailedDeliveryRow[]> {
  const { data, error } = await supabase
    .from("v_admin_failed_deliveries" as never)
    .select("*");
  if (error) throw error;
  return (data ?? []) as FailedDeliveryRow[];
}

export async function fetchDeliveriesByClient(): Promise<DeliveriesByClientRow[]> {
  const { data, error } = await supabase
    .from("v_admin_deliveries_by_client" as never)
    .select("*");
  if (error) throw error;
  return (data ?? []) as DeliveriesByClientRow[];
}

export async function fetchDeliveriesByContractor(): Promise<DeliveriesByContractorRow[]> {
  const { data, error } = await supabase
    .from("v_admin_deliveries_by_contractor" as never)
    .select("*");
  if (error) throw error;
  return (data ?? []) as DeliveriesByContractorRow[];
}

/** Drill into the immutable per-attempt audit log for a single delivery. */
export async function fetchAttemptsForDelivery(deliveryId: string): Promise<DeliveryAttemptRow[]> {
  const { data, error } = await supabase
    .from("webhook_delivery_attempts" as never)
    .select("*")
    .eq("delivery_id", deliveryId)
    .order("attempt_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DeliveryAttemptRow[];
}
