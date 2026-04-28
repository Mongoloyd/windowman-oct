import { Inbox } from "lucide-react";

export function ContractorLeadEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-slate-100 p-2 text-slate-700">
          <Inbox className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-black tracking-tight text-slate-950">No assigned opportunities</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{message}</p>
        </div>
      </div>
    </div>
  );
}
