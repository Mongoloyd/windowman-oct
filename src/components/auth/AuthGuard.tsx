/**
 * AuthGuard — Ensures user has an active session before rendering children.
 * Unauthenticated visitors see a sign-in required fallback with a home link.
 * Role-level enforcement is handled inside each protected page component.
 */

import { useState, useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AuthGuardProps {
  children: ReactNode;
}

const authGuardDevBypass =
  import.meta.env.DEV && import.meta.env.VITE_AUTH_GUARD_DEV_BYPASS === "true";

/**
 * Guards rendering of `children` behind an active Supabase session.
 *
 * While the session is being resolved, displays a full-screen loading UI.
 * Unauthenticated visitors see a sign-in required fallback with a home link.
 * Renders `children` only when an authenticated session is confirmed.
 *
 * @param children - Content to render when an authenticated session is present
 */
export function AuthGuard({ children }: AuthGuardProps) {
  if (authGuardDevBypass) {
    return <>{children}</>;
  }

  return <ProductionAuthGuard>{children}</ProductionAuthGuard>;
}

function AuthRequiredFallback() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold text-slate-900">Sign in required</h1>
        <p className="text-sm text-slate-600">
          You must be signed in to access this page.
        </p>
        <Link to="/" className="text-sm font-medium text-blue-600 hover:underline">
          Go to Home
        </Link>
      </div>
    </div>
  );
}

function ProductionAuthGuard({ children }: AuthGuardProps) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        const isAuthed = !!data?.session?.user;
        setAuthenticated(isAuthed);
        setChecking(false);
      })
      .catch((err) => {
        console.error("[AuthGuard] Failed to get auth session:", err);
        setAuthenticated(false);
        setChecking(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const isAuthed = !!session?.user;
      setAuthenticated(isAuthed);
      setChecking(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-slate-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) return <AuthRequiredFallback />;

  return <>{children}</>;
}
