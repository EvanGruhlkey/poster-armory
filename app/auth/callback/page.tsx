"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearAuthReturn, readAuthReturn, safeReturnPath } from "@/lib/auth-return";
import { Loader2 } from "lucide-react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") || searchParams.get("code");

    if (!code) {
      router.replace("/login?error=no_code");
      return;
    }

    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
      if (error) {
        console.error("Auth callback error:", error.message);
        router.replace("/login?error=auth_callback_failed");
        return;
      }
      const fromAccount =
        typeof data.user?.user_metadata?.return_to === "string"
          ? data.user.user_metadata.return_to
          : null;
      const next =
        safeReturnPath(params.get("next")) ||
        readAuthReturn() ||
        safeReturnPath(fromAccount) ||
        "/app";
      clearAuthReturn();
      window.location.assign(next);
    });
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
