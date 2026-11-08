const STORAGE_KEY = "pa-auth-return";
const COOKIE = "pa_auth_return";

/** A same-origin path, or null. Decodes a value Supabase may leave percent-encoded. */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value) return null;
  let path = value.trim();
  for (let i = 0; i < 2 && path.includes("%"); i++) {
    try {
      const decoded = decodeURIComponent(path);
      if (decoded === path) break;
      path = decoded;
    } catch {
      break;
    }
  }
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("://") ||
    path.includes("\\")
  ) {
    return null;
  }
  return path;
}

/** Remember where to send the user after Google sends them back. */
export function rememberAuthReturn(path: string) {
  const safe = safeReturnPath(path);
  if (!safe || typeof document === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, safe);
  } catch {
    // sessionStorage can be blocked; the cookie still carries the path.
  }
  document.cookie = `${COOKIE}=${encodeURIComponent(safe)}; Path=/; Max-Age=86400; SameSite=Lax`;
}

export function clearAuthReturn() {
  if (typeof document === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
  document.cookie = `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Path saved before the provider redirect. Left in place until sign-in succeeds. */
export function readAuthReturn(): string | null {
  if (typeof document === "undefined") return null;
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  const fromCookie = match ? safeReturnPath(match[1]) : null;
  return safeReturnPath(stored) || fromCookie;
}
