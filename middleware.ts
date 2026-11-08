import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// `/app` and `/app/design/*` are intentionally open: guests can browse and
// generate previews without signing up. Everything that costs money,
// persists across devices, or has commercial value requires a real
// (non-anonymous) account. An anonymous Supabase session counts as
// logged-out for these gates.
const REAL_AUTH_PATHS = [
  "/app/order",
  "/app/orders",
  "/app/library",
  "/app/billing",
  "/app/account",
];

function safeRedirect(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("://") ||
    value.includes("\\")
  ) {
    return "/app";
  }
  return value;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const requiresRealAuth = REAL_AUTH_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // The location picker and live designer are deliberately public. Avoid
  // touching Supabase on those routes so the free workflow remains available
  // even when auth is temporarily unavailable or not configured locally.
  if (!requiresRealAuth && request.nextUrl.pathname !== "/login") {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isRealUser = Boolean(user && !user.is_anonymous);

  if (requiresRealAuth && !isRealUser) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set(
      "redirect",
      request.nextUrl.pathname + request.nextUrl.search
    );
    return NextResponse.redirect(redirectUrl);
  }

  if (request.nextUrl.pathname === "/login" && isRealUser) {
    const next = safeRedirect(request.nextUrl.searchParams.get("redirect"));
    return NextResponse.redirect(new URL(next, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/login"],
};
