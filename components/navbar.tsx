"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, LogOut, Library, CreditCard, Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { useEffect, useState } from "react";
import type { User as SupaUser } from "@supabase/supabase-js";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SupaUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoaded(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoaded(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const isApp = pathname.startsWith("/app");

  const navLinkClass = (href: string) =>
    `block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted ${
      pathname === href ? "text-foreground" : "text-muted-foreground"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-bold text-base sm:text-lg">
          <Logo className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
          <span className="truncate">Poster Armory</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-5 md:flex">
          <Link
            href="/pricing"
            className={`text-sm font-medium transition-colors hover:text-foreground ${
              pathname === "/pricing" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Pricing
          </Link>

          {!authLoaded ? (
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          ) : user ? (
            <>
              {isApp && (
                <Link
                  href="/app/library"
                  className={`text-sm font-medium transition-colors hover:text-foreground ${
                    pathname === "/app/library"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  Library
                </Link>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2.5 px-3">
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarFallback className="text-xs">
                        {user.email?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden lg:inline">Account</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => router.push("/app")}>
                    <MapPin className="mr-2 h-4 w-4" />
                    New Poster
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/app/library")}>
                    <Library className="mr-2 h-4 w-4" />
                    Library
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/app/billing")}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Billing
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign In
              </Link>
              <Button asChild size="sm">
                <Link href="/login">Get Started</Link>
              </Button>
            </>
          )}
        </nav>

        {/* Mobile: CTA + menu */}
        <div className="flex items-center gap-2 md:hidden">
          {!authLoaded ? null : !user ? (
            <Button asChild size="sm">
              <Link href="/login">Start</Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline" className="h-9 w-9 shrink-0 p-0">
              <Link href="/app" aria-label="New poster">
                <MapPin className="h-4 w-4 shrink-0" />
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? (
              <X className="h-5 w-5 shrink-0" />
            ) : (
              <Menu className="h-5 w-5 shrink-0" />
            )}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t bg-background px-4 py-3 md:hidden">
          <div className="space-y-1">
            <Link href="/pricing" className={navLinkClass("/pricing")}>
              Pricing
            </Link>
            {user && (
              <>
                <Link href="/app" className={navLinkClass("/app")}>
                  New Poster
                </Link>
                <Link href="/app/library" className={navLinkClass("/app/library")}>
                  Library
                </Link>
                <Link href="/app/billing" className={navLinkClass("/app/billing")}>
                  Billing
                </Link>
              </>
            )}
            {!authLoaded ? null : user ? (
              <button
                onClick={handleSignOut}
                className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </button>
            ) : (
              <Link href="/login" className={navLinkClass("/login")}>
                Sign In
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
