import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Clock, Loader2, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { ContractorAccountStatus } from "./ContractorAccountStatus";
import {
  fetchContractorAccountContext,
  isContractorAccessAllowed,
  type ContractorAccessResult,
} from "@/services/contractorAccess";

function StatePanel({ icon: Icon, title, body, tone = "slate" }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tone?: "slate" | "amber" | "red" | "blue";
}) {
  const tones = {
    slate: "border-slate-300 bg-white text-slate-950",
    amber: "border-amber-300 bg-amber-50 text-amber-950",
    red: "border-red-300 bg-red-50 text-red-950",
    blue: "border-sky-300 bg-sky-50 text-sky-950",
  };

  return (
    <div className={`rounded-lg border p-6 shadow-sm ${tones[tone]}`}>
      <div className="flex items-start gap-3">
        <div className="rounded-md border border-current/20 bg-white/70 p-2">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-black tracking-tight">{title}</h2>
          <p className="mt-2 text-sm font-semibold leading-6">{body}</p>
        </div>
      </div>
    </div>
  );
}

function AccessState({ result }: { result: ContractorAccessResult }) {
  if (result.state === "unauthenticated") {
    return <StatePanel icon={Lock} title="Sign-in required" body="Use the invited contractor login to access the internal pilot portal shell." tone="blue" />;
  }

  if (result.state === "not_linked") {
    return <StatePanel icon={ShieldAlert} title="Account not linked" body="This login is authenticated but is not mapped to a contractor account." tone="amber" />;
  }

  if (result.state === "pending") {
    return <StatePanel icon={Clock} title="Access pending" body="This contractor account is not active for operational portal access yet." tone="amber" />;
  }

  if (result.state === "suspended" || result.state === "revoked") {
    return <StatePanel icon={ShieldAlert} title="Access restricted" body="This contractor account cannot access operational portal data." tone="red" />;
  }

  if (result.state === "error") {
    return <StatePanel icon={AlertCircle} title="Access check unavailable" body="Contractor access could not be verified. No account or lead data is exposed." tone="red" />;
  }

  return null;
}

export function ContractorPortalShell() {
  const { data: result, isLoading } = useQuery({
    queryKey: ["contractor-account-context"],
    queryFn: fetchContractorAccountContext,
    staleTime: 60_000,
  });

  if (isLoading || !result) {
    return (
      <main className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-800">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span className="text-sm font-extrabold uppercase tracking-wide">Resolving contractor access</span>
          </div>
        </div>
      </main>
    );
  }

  const allowed = isContractorAccessAllowed(result);

  return (
    <main className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="flex flex-col gap-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-700 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-sky-700" aria-hidden />
            Internal Pilot Access Model
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Contractor Portal
          </h1>
          <p className="max-w-3xl text-sm font-semibold leading-6 text-slate-700">
            Account context only. Lead details, homeowner contact data, quote files, outcomes, and dashboards are not exposed in Phase 4A.
          </p>
        </section>

        <ContractorAccountStatus account={result.account} />
        <AccessState result={result} />

        {allowed && (
          <section className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-sky-50 p-2 text-sky-800">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-black tracking-tight text-slate-950">Safe shell active</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                  Lead details are not exposed in this access-model sprint. Assigned lead view will be added in Phase 4B.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}