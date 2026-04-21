/**
 * PartnerGuard — Route guard for partner portal pages.
 *
 * Handles:
 * - unauthenticated → redirect to /partner/login
 * - unlinked → show "pending invitation" state
 * - suspended + status='pending_review' → "Account Pending Review" (sky/clock)
 * - suspended (any other non-active status) → "Account Suspended" (amber)
 * - active → render children
 */

import { usePartnerAuth } from "@/hooks/usePartnerAuth";
import { Navigate } from "react-router-dom";
import { AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface PartnerGuardProps {
  children: React.ReactNode;
}

function StatusScreen({ icon, title, description, action }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-sky-500/10 flex items-center justify-center">
          {icon}
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">{title}</h1>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">{description}</p>
        {action}
      </div>
    </div>
  );
}

export default function PartnerGuard({ children }: PartnerGuardProps) {
  const { state, status } = usePartnerAuth();

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-[hsl(222,47%,6%)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-sky-500/30 border-t-sky-400 animate-spin" />
          <p className="text-xs text-slate-500 font-mono">Verifying partner access…</p>
        </div>
      </div>
    );
  }

  if (state === "unauthenticated") {
    return <Navigate to="/partner/login" replace />;
  }

  if (state === "unlinked") {
    return (
      <StatusScreen
        icon={<Clock className="h-8 w-8 text-sky-400" />}
        title="Account Not Linked"
        description="Your account is not yet connected to a contractor partner profile. If you received an invitation, please use the invite link to complete setup."
        action={
          <Button
            variant="outline"
            className="border-white/10 text-slate-300 hover:bg-white/5"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/partner/login";
            }}
          >
            Sign Out
          </Button>
        }
      />
    );
  }

  if (state === "suspended") {
    if (status === "pending_review") {
      return (
        <StatusScreen
          icon={<Clock className="h-8 w-8 text-sky-400" />}
          title="Account Pending Review"
          description="Your partner account request is under review. We'll email you within 1 business day once approved."
          action={
            <Button
              variant="outline"
              className="border-white/10 text-slate-300 hover:bg-white/5"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/partner/login";
              }}
            >
              Sign Out
            </Button>
          }
        />
      );
    }

    return (
      <StatusScreen
        icon={<AlertTriangle className="h-8 w-8 text-amber-400" />}
        title="Account Suspended"
        description="Your partner account has been suspended. Please contact ops@windowman.app for assistance."
        action={
          <Button
            variant="outline"
            className="border-white/10 text-slate-300 hover:bg-white/5"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/partner/login";
            }}
          >
            Sign Out
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
