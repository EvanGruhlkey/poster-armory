export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HeroLocationForm } from "@/components/hero-location-form";
import { Button } from "@/components/ui/button";
import { MapPin, Palette, Download, ChevronDown } from "lucide-react";

const GALLERY = [
  {
    src: "/images/gallery/chicago.jpg",
    city: "Chicago",
    theme: "Classic",
  },
  {
    src: "/images/gallery/tokyo.jpg",
    city: "Tokyo",
    theme: "Noir",
  },
  {
    src: "/images/gallery/paris.jpg",
    city: "Paris",
    theme: "Watercolor",
  },
  {
    src: "/images/gallery/venice.jpg",
    city: "Venice",
    theme: "Vintage",
  },
  {
    src: "/images/gallery/new-york.jpg",
    city: "New York",
    theme: "Blueprint",
  },
  {
    src: "/images/gallery/seattle.jpg",
    city: "Seattle",
    theme: "Organic",
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

const EARLY_FEEDBACK = [
  {
    quote: "The editor made it easy to turn our favorite trip into something personal.",
    name: "Maya R.",
    initials: "MR",
  },
  {
    quote: "I found our neighborhood, chose a style, and had a poster ready in minutes.",
    name: "Noah T.",
    initials: "NT",
  },
  {
    quote: "A thoughtful housewarming gift that still felt simple to create.",
    name: "Elena P.",
    initials: "EP",
  },
  {
    quote: "The live preview helped me get the colors and text exactly where I wanted them.",
    name: "Jordan K.",
    initials: "JK",
  },
  {
    quote: "Clean, modern, and much easier to customize than I expected.",
    name: "Sam W.",
    initials: "SW",
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
    a: "20 high-resolution downloads per month for $10/month, in PNG and PDF. The allowance resets each billing month and you can cancel anytime.",
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
    a: "Everything, for free: map framing, rotation and tilt, layer presets, labels, water and parks, all 21 themes, the poster size, and the title, subtitle, date line and optional coordinates.",
  },
  {
    q: "Are my designs saved?",
    a: "Your in-progress design is kept in the editor, and every high-resolution file you download is saved to your library so you can access it again later.",
  },
  {
    q: "Will it look good printed?",
    a: "Download high-resolution PNG and PDF files at standard poster aspect ratios. Use a quality print shop, or let us print and ship it for you.",
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
      <section data-testid="home-hero" className="grid overflow-hidden border-b bg-[#fbfaf8] lg:min-h-[calc(100svh-4rem)] lg:grid-cols-2" style={{ backgroundImage: "linear-gradient(to right, rgba(24,52,75,.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(24,52,75,.045) 1px, transparent 1px)", backgroundSize: "28px 28px" }}>
        <div className="relative flex items-center px-6 py-16 sm:px-12 lg:px-[clamp(3rem,6vw,8rem)] lg:py-20">
          <div className="relative mx-auto w-full max-w-[560px] lg:ml-auto lg:mr-0">
            <h1 className="text-[clamp(2.75rem,3.5vw,4.25rem)] font-bold leading-[1.06] tracking-tight text-[#18344b]">
              Pick a place.<br />We&apos;ll print it.
            </h1>
            <p className="mt-5 text-xl text-slate-500 sm:text-2xl">Custom map posters.</p>
            <HeroLocationForm />
          </div>
        </div>
        <div data-testid="hero-room" className="relative min-h-[520px] overflow-hidden sm:min-h-[650px] lg:min-h-full">
          <Image
            src="/images/hero-room-san-francisco-v2.png"
            alt="San Francisco custom map poster in a sunlit room"
            fill
            priority
            className="hero-room-photo object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
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
            Made in the editor. Make one yours.
          </p>

          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0">
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
                <p className="p-2 text-center text-xs text-muted-foreground">{poster.theme}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {process.env.NODE_ENV === "development" && (
      <section aria-label="Sample customer reviews" className="overflow-hidden border-y border-[#e5ded3] bg-[#f7f3ec] py-6">
        <div className="feedback-rail">
          <div className="feedback-marquee flex w-max hover:[animation-play-state:paused]">
            {[false, true].map((duplicate) => (
              <div key={String(duplicate)} aria-hidden={duplicate || undefined} className="flex shrink-0 gap-4 pr-4">
                {EARLY_FEEDBACK.map((review) => (
                  <blockquote key={review.quote} className="flex w-[300px] shrink-0 flex-col justify-between rounded-xl border border-[#ded6ca] bg-white/90 p-4 shadow-[0_8px_24px_rgba(24,52,75,0.05)] sm:w-[360px]">
                    <p className="text-sm leading-6 text-[#18344b]">“{review.quote}”</p>
                    <footer className="mt-4 flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#18344b] text-[10px] font-semibold text-white">
                        {review.initials}
                      </span>
                      <span>
                        <span className="block text-xs font-semibold text-[#18344b]">{review.name}</span>
                        <span className="block text-[10px] text-slate-500">Review</span>
                      </span>
                    </footer>
                  </blockquote>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

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
