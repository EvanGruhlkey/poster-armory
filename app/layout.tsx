import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
