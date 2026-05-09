export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, MapPin, Palette, Download, ChevronDown } from "lucide-react";

const GH_RAW =
  "https://raw.githubusercontent.com/EvanGruhlkey/poster-forge/main/posters";

const HERO_POSTER = {
  src: `${GH_RAW}/barcelona_warm_beige_20260118_140048.png`,
  alt: "Barcelona warm beige poster",
  caption: "Our First Home",
  sub: "New York, New York",
};

const EXAMPLE_POSTERS = [
  {
    src: `${GH_RAW}/marrakech_terracotta_20260118_143253.png`,
    title: "Where We Met",
    city: "Marrakech",
    theme: "Terracotta",
  },
  {
    src: `${GH_RAW}/venice_blueprint_20260118_140505.png`,
    title: "Our First Home",
    city: "Venice",
    theme: "Blueprint",
  },
  {
    src: `${GH_RAW}/dubai_midnight_blue_20260118_140807.png`,
    title: "NIGHT",
    city: "Dubai",
    theme: "Midnight Blue",
  },
];

const GALLERY = [
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
    num: 1,
    title: "Pick a Location",
    desc: "Search for any city, address, or drop a pin on coordinates.",
    icon: MapPin,
  },
  {
    num: 2,
    title: "Customize Your Design",
    desc: "Choose a theme, adjust the map radius, and add your own text.",
    icon: Palette,
  },
  {
    num: 3,
    title: "Download & Print",
    desc: "Get high-res PDF and PNG files ready for any frame size.",
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
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Transform Your Memories
              <br />
              into{" "}
              <span className="text-primary underline decoration-primary/30 underline-offset-4">
                Custom Map Art
              </span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Create beautiful map posters in minutes.
              <br />
              Free to try — 5 designs every month, no credit card.
            </p>
            <ul className="space-y-2">
              {[
                "Personalize any location",
                "Choose from stylish themes",
                "Instantly download print ready files",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="mt-4">
              <Link href="/app">Start Free</Link>
            </Button>
          </div>

          {/* Hero poster preview — real generated poster */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="overflow-hidden rounded-lg border shadow-2xl">
              <Image
                src={HERO_POSTER.src}
                alt={HERO_POSTER.alt}
                width={600}
                height={800}
                className="h-auto w-full"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works — Example posters */}
      <section className="border-t bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-10 text-center text-3xl font-bold">
            How It Works
          </h2>

          {/* Three showcase posters */}
          <div className="mb-16 grid gap-6 sm:grid-cols-3">
            {EXAMPLE_POSTERS.map((poster) => (
              <div
                key={poster.title}
                className="group overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  <Image
                    src={poster.src}
                    alt={`${poster.city} ${poster.theme} poster`}
                    fill
                    className="object-cover transition-transform group-hover:scale-[1.02]"
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                </div>
                <div className="bg-background p-3 text-center">
                  <p className="text-sm font-semibold">{poster.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {poster.city} &middot; {poster.theme}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Numbered steps */}
          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((step) => (
              <Card key={step.num} className="text-center">
                <CardContent className="pt-6">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary text-lg font-bold text-primary">
                    {step.num}
                  </div>
                  <h3 className="mb-2 font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Demo video */}
      <section className="border-t py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-center text-3xl font-bold">See it in action</h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-muted-foreground">
            Watch how easy it is to go from a place you love to a print-ready map poster.
          </p>
          <div className="relative mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border bg-black shadow-2xl ring-1 ring-border">
            <video
              className="absolute inset-0 block h-full w-full object-cover object-center outline-none"
              controls
              playsInline
              preload="metadata"
              aria-label="Poster Armory demo: creating a map poster"
            >
              <source src="/demo.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </section>

      {/* Gallery — More examples */}
      <section className="border-t bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-center text-3xl font-bold">
            Stunning Results, Every City
          </h2>
          <p className="mb-10 text-center text-muted-foreground">
            17 hand-crafted themes. Thousands of cities. Infinite possibilities.
          </p>

          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {GALLERY.map((poster) => (
              <div
                key={poster.city}
                className="group overflow-hidden rounded-lg border transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  <Image
                    src={poster.src}
                    alt={`${poster.city} ${poster.theme} map poster`}
                    fill
                    className="object-cover transition-transform group-hover:scale-[1.02]"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                </div>
                <div className="bg-background p-2 text-center">
                  <p className="text-sm font-medium">{poster.city}</p>
                  <p className="text-xs text-muted-foreground">
                    {poster.theme}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-center text-3xl font-bold">Frequently asked questions</h2>
          <p className="mb-10 text-center text-muted-foreground">
            Quick answers about creating and printing your map art.
          </p>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow open:shadow-md"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="border-t px-5 pb-4 pt-0">
                  <p className="pt-3 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/30 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="mb-4 text-3xl font-bold">Ready to get started?</h2>
          <p className="mb-8 text-muted-foreground">
            Sign up for free and create your first map poster in minutes.
          </p>
          <Button asChild size="lg">
            <Link href="/app">Start Free</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
