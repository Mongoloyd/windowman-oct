import { Link } from "react-router-dom";

export function ProphecyNavigation() {
  return (
    <header className="relative z-20 border-b border-white/8 px-5 py-4 sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <span className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-b from-[#3B82F6] to-[#1E40AF] text-[12px] font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
            W
          </span>
          <span className="text-[15px] font-bold tracking-tight text-white">
            WINDOW<span className="text-cyan-300">MAN</span>
          </span>
        </span>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Independent · not a contractor
        </span>
      </div>
    </header>
  );
}

export function ProphecyFooter() {
  return (
    <footer className="relative z-10 border-t border-white/8 px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-slate-400">
            © {new Date().getFullYear()} WindowMan. Independent quote
            intelligence.
          </p>
          <nav className="flex flex-wrap gap-x-2 gap-y-1 text-[12.5px] text-slate-400">
            <Link
              className="inline-flex min-h-11 items-center px-1.5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
              to="/privacy"
            >
              Privacy
            </Link>
            <Link
              className="inline-flex min-h-11 items-center px-1.5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
              to="/terms"
            >
              Terms
            </Link>
            <Link
              className="inline-flex min-h-11 items-center px-1.5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
              to="/disclaimer"
            >
              Disclaimer
            </Link>
          </nav>
        </div>
        <p className="mt-6 max-w-4xl text-[11.5px] leading-relaxed text-slate-400">
          WindowMan is independent software and is not an installing contractor,
          window manufacturer, law firm, insurance company, government agency or
          building department. Analysis is informational and based on the written
          estimate provided. It is not an appraisal, inspection, legal advice or
          a guarantee of savings. Final pricing and scope remain subject to
          contractor site verification and the signed construction agreement.
        </p>
      </div>
    </footer>
  );
}
