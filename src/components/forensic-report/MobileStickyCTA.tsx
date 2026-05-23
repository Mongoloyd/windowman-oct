type MobileStickyCTAProps = {
  onClick: () => void;
};

export default function MobileStickyCTA({ onClick }: MobileStickyCTAProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 md:hidden border-t border-[hsl(var(--fr-cyan)/0.25)] bg-[hsl(var(--fr-surface)/0.88)] backdrop-blur-md pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
      style={{
        boxShadow:
          "inset 0 1px 0 hsl(var(--fr-cyan) / 0.12), 0 -8px 32px hsl(var(--fr-bg) / 0.55)",
      }}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 pt-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
          style={{
            background: "linear-gradient(180deg, hsl(var(--fr-cyan) / 0.9), hsl(var(--fr-cyan) / 0.55))",
            boxShadow: "0 2px 8px hsl(var(--fr-cyan) / 0.35)",
          }}
          aria-hidden
        >
          WM
        </div>
        <div className="min-w-0 flex-1">
          <div className="fr-mono text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--fr-cyan))]">
            Next Move Ready
          </div>
          <button
            type="button"
            onClick={onClick}
            className="fr-cta-primary mt-1 w-full active:scale-[0.98] transition-transform shadow-[0_4px_14px_hsl(var(--fr-cyan)/0.25)]"
          >
            Get Second Opinion
          </button>
        </div>
      </div>
    </div>
  );
}
