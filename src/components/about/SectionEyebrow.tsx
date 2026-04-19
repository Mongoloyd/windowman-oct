interface SectionEyebrowProps {
  children: React.ReactNode;
  className?: string;
}

export default function SectionEyebrow({ children, className = "" }: SectionEyebrowProps) {
  return (
    <p className={`font-mono text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground ${className}`}>
      {children}
    </p>
  );
}
