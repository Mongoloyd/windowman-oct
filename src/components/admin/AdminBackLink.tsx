import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function AdminBackLink() {
  return (
    <Link
      to="/admin"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-blue-600 transition-colors"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to Dashboard
    </Link>
  );
}
