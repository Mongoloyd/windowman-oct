import { Link } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";

export default function AboutHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-slate-100/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-8">
        <BrandLogo to="/" useRouterLink size="lg" ariaLabel="WindowMan.app home" />

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
