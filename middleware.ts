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

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

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

  const requiresRealAuth = REAL_AUTH_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (requiresRealAuth && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set(
      "redirect",
      request.nextUrl.pathname + request.nextUrl.search
    );
    return NextResponse.redirect(redirectUrl);
  }

  if (request.nextUrl.pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/login"],
};
