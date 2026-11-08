import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeReturnPath } from "@/lib/auth-return";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const saved =
    safeReturnPath(searchParams.get("next")) ||
    safeReturnPath(request.cookies.get("pa_auth_return")?.value);

  if (code) {
    const response = NextResponse.redirect(`${origin}${saved || "/app"}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: "", ...options });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const fromAccount = safeReturnPath(
        typeof data.user?.user_metadata?.return_to === "string"
          ? data.user.user_metadata.return_to
          : null
      );
      response.headers.set("Location", `${origin}${saved || fromAccount || "/app"}`);
      response.cookies.set({ name: "pa_auth_return", value: "", path: "/", maxAge: 0 });
      return response;
    }
    console.error("Auth callback error:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
