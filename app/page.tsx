export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HeroMapAnimation } from "@/components/hero-map-animation";
import { Button } from "@/components/ui/button";
import { MapPin, Palette, Download, ChevronDown, Truck } from "lucide-react";

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
  {
    src: `${GH_RAW}/london_noir_20260118_150259.png`,
    city: "London",
    theme: "Noir",
  },
];

const STEPS = [
  {
    title: "Find your place",
    desc: "Search a city, address, or landmark to start your poster.",
    icon: MapPin,
  },
  {
    title: "Design it for free",
    desc: "Every theme, layer and word is free to customize, and the poster updates as you edit.",
    icon: Palette,
  },
  {
    title: "Download or print",
    desc: "Subscribe for $10/month to download high-resolution files, or order a physical print shipped to you.",
    icon: Download,
  },
];

const FAQ_ITEMS = [
  {
    q: "What does it cost?",
    a: "Designing is completely free — create and customize as many posters as you want without paying anything. One membership at $10/month adds 20 high-resolution downloads per month. Physical prints are sold separately and priced per order at checkout.",
  },
  {
    q: "Do I need to pay to design a poster?",
    a: "No. The full editor, every theme, every map layer and the live preview are free, with no card required and no limit on how many designs you create.",
  },
  {
    q: "What do I get with the membership?",
    a: "20 high-resolution downloads per month for $10/month, in PNG, PDF and SVG. The allowance resets at the start of each billing month and you can cancel anytime.",
  },
  {
    q: "What happens when I use all 20 downloads?",
    a: "You keep designing and previewing for free, and your allowance refills at the start of your next billing month. Your billing page always shows how many downloads are left and the exact reset date.",
  },
  {
    q: "Is there a yearly option?",
    a: "Yes. The same membership is $100/year — two months free — and still includes 20 high-resolution downloads every month.",
  },
  {
    q: "Are physical prints included in the membership?",
    a: "No. Printed posters are sold separately: you pay per order at checkout, including shipping, and ordering a print never uses one of your monthly downloads.",
  },
  {
    q: "How long does a download take?",
    a: "Roughly up to five minutes, depending on the map area and theme. We fetch real map data and render high-resolution files. You can click away or close the tab; your poster keeps generating and appears in your library when it's ready.",
  },
  {
    q: "Does re-downloading a poster use another download?",
    a: "No. A download is counted once, when the high-resolution render starts. Grabbing the PDF after the PNG, retrying, or coming back months later costs nothing extra. Failed renders are never charged.",
  },
  {
    q: "Can I use any location?",
    a: "Yes. Search for cities, addresses and landmarks worldwide, then drag, zoom, rotate and tilt the live map to frame it exactly how you want.",
  },
  {
    q: "What can I customize?",
    a: "Everything, for free: map framing, rotation and tilt, layer presets, labels, water and parks, all 17 themes, the poster size, and the title, subtitle, date line and optional coordinates.",
  },
  {
    q: "Are my designs saved?",
    a: "Your in-progress design is kept in the editor, and every high-resolution file you download is saved to your library so you can access it again later.",
  },
  {
    q: "Will it look good printed?",
    a: "Exports are built for print: vector PDF and SVG plus crisp PNGs at standard poster aspect ratios. Use a quality print shop, or let us print and ship it for you.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from Billing at any time and you keep your downloads through the period you already paid for. Designing stays free afterwards. See our Terms for details.",
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
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground backdrop-blur-sm sm:text-sm">
            <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Premium map posters, shipped to your door
          </p>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
            Turn a place you love
            <br />
            <span className="text-primary">into a poster</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
            Choose any city, neighborhood, or memory. We&apos;ll turn it into a
            custom map poster, print it on premium paper, and ship it straight
            to you.
          </p>
          <div className="mt-8 flex w-full max-w-sm flex-col items-center gap-3 sm:mt-10">
            <Button asChild size="lg" className="h-12 w-full px-8 text-base shadow-lg sm:w-auto">
              <Link href="/app">Design for free</Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              Free to design · No card required
            </p>
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
            Design for free. $10/month for 20 high-resolution downloads. Cancel
            anytime.
          </p>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/app">Design for free</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
