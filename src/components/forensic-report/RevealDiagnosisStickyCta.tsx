import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';

interface RevealDiagnosisStickyCtaProps {
  onClick?: () => void;
  enabled?: boolean;
}

export default function RevealDiagnosisStickyCta({
  onClick,
  enabled = true,
}: RevealDiagnosisStickyCtaProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled || !onClick) return;
    const handleScroll = () => setVisible(window.scrollY > 480);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [enabled, onClick]);

  if (!enabled || !onClick || !visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div
        className="h-4 bg-gradient-to-t from-[hsl(var(--fr-bg))] to-transparent"
        aria-hidden="true"
      />
      <div className="border-t border-[hsl(var(--fr-cyan)/0.35)] bg-slate-950/90 px-4 py-3 shadow-[0_-12px_40px_hsl(var(--fr-bg)/0.85)] backdrop-blur-md fr-glow--info">
        <button
          type="button"
          onClick={onClick}
          className="fr-cta-primary flex w-full items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold"
        >
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Get a Better Quote Plan
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
