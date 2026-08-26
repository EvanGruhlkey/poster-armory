import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/auth-provider";
import { SubscriptionProvider } from "@/components/subscription-provider";
import { createClient } from "@/lib/supabase/server";
import {
  getSubscriptionSummary,
  SIGNED_OUT_SUMMARY,
  type SubscriptionSummary,
} from "@/lib/subscription-summary";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://posterarmory.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Poster Armory - Custom Map Art Posters",
    template: "%s | Poster Armory",
  },
  description:
    "Create beautiful, customizable city map posters. Pick any location, choose your style, and download print-ready files.",
  openGraph: {
    type: "website",
    siteName: "Poster Armory",
    title: "Poster Armory - Custom Map Art Posters",
    description:
      "Create beautiful, customizable city map posters. Pick any location, choose your style, and download print-ready files.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Poster Armory: Custom Map Art Posters",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Poster Armory - Custom Map Art Posters",
    description:
      "Create beautiful, customizable city map posters. Pick any location, choose your style, and download print-ready files.",
    images: ["/og-image.png"],
  },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initialUser = null;
  try {
    const { data } = await createClient().auth.getUser();
    initialUser = data.user;
  } catch {
    // Keep public pages available if authentication is not configured.
  }

  // Resolve membership state before the first paint so a reload never flashes
  // signed-out pricing at a subscriber. Stripe is deliberately not called
  // here; the provider reconciles those fields client-side.
  let initialSubscription: SubscriptionSummary = SIGNED_OUT_SUMMARY;
  if (initialUser && !initialUser.is_anonymous) {
    try {
      initialSubscription = await getSubscriptionSummary(initialUser.id);
    } catch {
      // Fall back to the signed-out shape rather than failing the render.
    }
  }

  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthProvider initialUser={initialUser}>
          <SubscriptionProvider initialSubscription={initialSubscription}>
            {children}
            <Toaster position="bottom-center" richColors />
          </SubscriptionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
