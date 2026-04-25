/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VOICE FOLLOWUPS PANEL — Uses canonical invokeAdminData path
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Refactored: Removed legacy direct supabase.functions.invoke calls and
 * adminPassword prop. Now uses the shared invokeAdminData service which
 * handles session JWT auth (production) and X-Dev-Secret bypass (dev).
 */

import { useState, useEffect, useCallback } from "react";
import { invokeAdminData } from "@/services/adminDataService";
import { trackGtmEvent } from "@/lib/trackConversion";

interface VoiceFollowup {
  id: string;
  created_at: string;
  phone_e164: string;
  lead_id: string;
  scan_session_id: string | null;
  opportunity_id: string | null;
}

export default function VoiceFollowupsPanel() {
  const [followups, setFollowups] = useState<VoiceFollowup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callingId, setCallingId] = useState<string | null>(null);

  const fetchFollowups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invokeAdminData("fetch_voice_followups");
      setFollowups(data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load voice followups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  const handleManualCall = async (log: VoiceFollowup) => {
    if (!log.scan_session_id) return;
    setCallingId(log.id);
    setError(null);
    try {
      await invokeAdminData("trigger_voice_followup", {
        scan_session_id: log.scan_session_id,
        phone_e164: log.phone_e164,
        opportunity_id: log.opportunity_id ?? undefined,
      });
      trackGtmEvent("voice_call_triggered", {
        lead_id: log.lead_id,
        trigger: "manual_admin",
      });
    } catch (err: unknown) {
      setError("Call failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setCallingId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-slate-700 p-5">
        Loading voice logs…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive p-5">
        {error}
      </div>
    );
  }

  if (followups.length === 0) {
    return (
      <div className="text-sm text-slate-700 p-10 text-center">
        No recent voice follow-ups found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/50">
            {["Date & Time", "Phone Number", "Lead ID", "Opportunity ID", "Actions"].map((col) => (
              <th
                key={col}
                className="text-left px-3 py-2 font-medium text-slate-700 uppercase tracking-wider border-b"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {followups.map((log) => (
            <tr key={log.id} className="border-b">
              <td className="px-3 py-2.5 font-mono text-xs">
                {new Date(log.created_at).toLocaleString()}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-primary">
                {log.phone_e164}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs">
                {log.lead_id ? log.lead_id.slice(0, 8) + "…" : "—"}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs">
                {log.opportunity_id ? log.opportunity_id.slice(0, 8) + "…" : "—"}
              </td>
              <td className="px-3 py-2.5">
                <button
                  onClick={() => handleManualCall(log)}
                  disabled={callingId === log.id || !log.scan_session_id}
                  className="text-xs font-mono uppercase tracking-wide px-2.5 py-1 rounded bg-primary text-primary-foreground disabled:opacity-100 disabled:cursor-not-allowed"
                >
                  {callingId === log.id ? "Dialing…" : "Call Now"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
