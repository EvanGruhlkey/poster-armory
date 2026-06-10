export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HeroMapAnimation } from "@/components/hero-map-animation";
import { Button } from "@/components/ui/button";
import { MapPin, Palette, Download, ChevronDown } from "lucide-react";

const GH_RAW =
  "https://raw.githubusercontent.com/EvanGruhlkey/poster-forge/main/posters";

const GALLERY = [
  {
    src: `${GH_RAW}/marrakech_terracotta_20260118_143253.png`,
    city: "Marrakech",
    theme: "Terracotta",
  },
  {
    src: `${GH_RAW}/venice_blueprint_20260118_140505.png`,
    city: "Venice",
    theme: "Blueprint",
  },
  {
    src: `${GH_RAW}/dubai_midnight_blue_20260118_140807.png`,
    city: "Dubai",
    theme: "Midnight Blue",
  },
  {
    src: `${GH_RAW}/tokyo_japanese_ink_20260118_142446.png`,
    city: "Tokyo",
    theme: "Japanese Ink",
  },
  {
    src: `${GH_RAW}/san_francisco_sunset_20260118_144726.png`,
    city: "San Francisco",
    theme: "Sunset",
  },
  {
    src: `${GH_RAW}/singapore_neon_cyberpunk_20260118_153328.png`,
    city: "Singapore",
    theme: "Neon Cyberpunk",
  },
  {
    src: `${GH_RAW}/seattle_emerald_20260124_162244.png`,
    city: "Seattle",
    theme: "Emerald",
  },
];

const STEPS = [
  {
    title: "Pick a location",
    desc: "Search any city or address worldwide.",
    icon: MapPin,
  },
  {
    title: "Customize",
    desc: "Choose a theme and add your text.",
    icon: Palette,
  },
  {
    title: "Download",
    desc: "Get print-ready PDF and PNG files.",
    icon: Download,
  },
];

const FAQ_ITEMS = [
  {
    q: "What do I get when I create a poster?",
    a: "You get preview designs in the app, then high-resolution downloads (PDF and PNG sizes for your plan) ready to print or send to a professional printer.",
  },
  {
    q: "How long does a download take?",
    a: "Roughly up to five minutes, depending on the map area and theme. We fetch real map data and render high-resolution files. You can click away, use another tab, or leave the app; your poster keeps generating and will show in your library when it is ready.",
  },
  {
    q: "Do I need a subscription?",
    a: "No. Every account starts on the free plan, which includes 5 design previews per month so you can try the full experience. Upgrade to a paid plan whenever you want to download print-ready files.",
  },
  {
    q: "Can I use any location?",
    a: "Yes. Search for cities worldwide, fine-tune the map area with radius and position, and add your own title and subtitle.",
  },
  {
    q: "Will it look good printed?",
    a: "Exports are built for print: vector PDF where available and crisp PNGs at standard poster aspect ratios. Use a quality print shop or home printer that supports your chosen size.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. You can cancel from Billing; recurring plans stay active through the period you already paid for. See our Terms for details.",
  },
  {
    q: "Where do I get help?",
    a: "Use the in-app flows for billing and downloads. For account or payment issues, contact support through the same email you use for your account.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <HeroMapAnimation />

        {/* Light vignette: map visible at edges, copy readable in center */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/50" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_45%_at_50%_48%,hsl(var(--background)/0.92)_0%,hsl(var(--background)/0.55)_45%,transparent_72%)]" />

        <div className="relative z-10 mx-auto flex min-h-[min(88vh,760px)] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 sm:py-20">
          <p className="mb-4 rounded-full border bg-background/80 px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground backdrop-blur-sm sm:text-sm">
            Free to try, 5 designs every month
          </p>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
            Turn any place into
            <br />
            <span className="text-primary">custom map art</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
            Pick a city, choose from 17 themes, and download a print-ready poster in minutes.
          </p>
          <div className="mt-8 flex w-full max-w-sm flex-col items-center gap-3 sm:mt-10">
            <Button asChild size="lg" className="h-12 w-full px-8 text-base shadow-lg sm:w-auto">
              <Link href="/app">Start Free</Link>
            </Button>
            <p className="text-sm text-muted-foreground">No credit card required</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-muted/30 py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">
            Three steps
          </h2>
          <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
            {STEPS.map((step) => (
              <div
                key={step.title}
                className="rounded-xl border bg-card p-5 text-center shadow-sm"
              >
                <div className="mx-auto mb-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 sm:h-12 sm:w-12">
                  <step.icon className="h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" />
                </div>
                <h3 className="mb-1 font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="border-t py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-2 text-center text-2xl font-bold sm:text-3xl">
            Example posters
          </h2>
          <p className="mb-8 text-center text-sm text-muted-foreground sm:text-base">
            17 themes. Any city.
          </p>

          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
            {GALLERY.map((poster) => (
              <div
                key={poster.city}
                className="w-[42vw] shrink-0 snap-start overflow-hidden rounded-lg border sm:w-auto"
              >
                <div className="relative aspect-[3/4]">
                  <Image
                    src={poster.src}
                    alt={`${poster.city} ${poster.theme} map poster`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 42vw, (max-width: 1024px) 33vw, 25vw"
                  />
                </div>
                <div className="p-2 text-center">
                  <p className="text-sm font-medium">{poster.city}</p>
                  <p className="text-xs text-muted-foreground">{poster.theme}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo video */}
      <section className="border-t bg-muted/30 py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-center text-2xl font-bold sm:text-3xl">
            See it in action
          </h2>
          <div className="relative mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-xl border bg-black shadow-lg">
            <video
              className="absolute inset-0 block h-full w-full object-cover"
              controls
              playsInline
              preload="metadata"
              aria-label="Poster Armory demo"
            >
              <source src="/demo.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t py-10 sm:py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-center text-2xl font-bold sm:text-3xl">
            Frequently asked questions
          </h2>
          <p className="mb-8 text-center text-sm text-muted-foreground sm:text-base">
            Quick answers about creating and printing your map art.
          </p>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="group rounded-lg border bg-card"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-left text-sm font-medium sm:px-5 sm:text-base [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 pr-2">{item.q}</span>
                  <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="border-t px-4 py-3 text-sm leading-relaxed text-muted-foreground sm:px-5">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/30 py-10 sm:py-14">
        <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
          <h2 className="mb-3 text-2xl font-bold sm:text-3xl">Ready to create?</h2>
          <p className="mb-6 text-sm text-muted-foreground sm:text-base">
            Free to start. No credit card.
          </p>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/app">Start Free</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
