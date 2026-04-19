import { Link } from "react-router-dom";

export default function AboutHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-slate-100/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-8">
        {/* Logo / Wordmark */}
        <Link to="/" className="flex items-center gap-2">
          <span className="font-display text-2xl font-bold tracking-tight">
            <span className="text-foreground">WINDOW</span>
            <span style={{ color: "#448df7" }}>MAN</span>
            <span className="text-primary">.PRO</span>
          </span>
        </Link>

        {/* Sign In Link */}
        <Link
          to="/"
          className="text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground"
        >
          Sign In
        </Link>
      </div>
    </header>
  );
}
