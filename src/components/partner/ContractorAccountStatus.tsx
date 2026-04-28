import { AlertTriangle, BadgeCheck, Building2, ShieldCheck } from "lucide-react";
import {
  type ContractorAccountContext,
  formatContractorAccessStatus,
} from "@/services/contractorAccess";

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "amber" | "red" | "blue" }) {
  const tones = {
    slate: "border-slate-300 bg-white text-slate-950",
    green: "border-emerald-300 bg-emerald-50 text-emerald-950",
    amber: "border-amber-300 bg-amber-50 text-amber-950",
    red: "border-red-300 bg-red-50 text-red-950",
    blue: "border-sky-300 bg-sky-50 text-sky-950",
  };

  return (
    <span className={`inline-flex min-h-7 items-center rounded-md border px-2.5 py-1 text-xs font-extrabold uppercase ${tones[tone]}`}>
      {children}
    </span>
  );
}

function statusTone(status: ContractorAccountContext["accessStatus"]): "green" | "amber" | "red" | "blue" {
  if (status === "active") return "green";
  if (status === "suspended" || status === "revoked") return "red";
  if (status === "invited") return "blue";
  return "amber";
}

function roleLabel(role: ContractorAccountContext["portalRole"]): string {
  return role.replace("contractor_", "").replace(/_/g, " ");
}

export function ContractorAccountStatus({ account }: { account: ContractorAccountContext | null }) {
  if (!account) {
    return (
      <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="amber">Not linked</Badge>
          <Badge>Account unresolved</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-slate-700">
              <Building2 className="h-4 w-4" aria-hidden />
              <span className="text-xs font-extrabold uppercase tracking-wide">Contractor Account</span>
            </div>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              {account.displayName}
            </h2>
            <p className="mt-1 font-mono text-xs font-bold text-slate-600">
              ID {account.contractorAccountIdMasked}
            </p>
          </div>
          <Badge tone={statusTone(account.accessStatus)}>
            {formatContractorAccessStatus(account.accessStatus)}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge tone="blue">Client {account.clientSlug}</Badge>
          <Badge>{roleLabel(account.portalRole)}</Badge>
          <Badge tone={account.isActive ? "green" : "amber"}>
            {account.isActive ? "Linked" : "Inactive"}
          </Badge>
        </div>

        {account.warnings.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>Multiple contractor accounts were found. Internal manual review is required before operational access expands.</span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-sky-700" aria-hidden />
            <p className="text-sm font-semibold text-slate-800">Context is resolved from authenticated identity and RLS-scoped account rows.</p>
          </div>
          <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <BadgeCheck className="mt-0.5 h-4 w-4 text-emerald-700" aria-hidden />
            <p className="text-sm font-semibold text-slate-800">This sprint exposes account metadata only, not homeowner or quote data.</p>
          </div>
        </div>
      </div>
    </div>
  );
}