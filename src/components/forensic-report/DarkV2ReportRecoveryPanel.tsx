import { Loader2 } from "lucide-react";

export default function DarkV2ReportRecoveryPanel({
  message = "Restoring your secured report…",
}: {
  message?: string;
}) {
  return (
    <div className="report-dark min-h-screen flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-400 mx-auto" aria-hidden />
        <p className="text-sm text-slate-300">{message}</p>
      </div>
    </div>
  );
}
