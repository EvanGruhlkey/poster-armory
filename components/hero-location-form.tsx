"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroLocationForm() {
  const router = useRouter();
  const [place, setPlace] = useState("");

  function startDesign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = place.trim();
    router.push(query ? `/app?place=${encodeURIComponent(query)}` : "/app");
  }

  return (
    <form onSubmit={startDesign} className="mt-9 w-full max-w-[500px]">
      <label htmlFor="hero-place" className="sr-only">City or place</label>
      <div className="flex h-14 items-center gap-3 rounded-full border border-[#d9dedf] bg-white/90 px-5 shadow-sm focus-within:border-[#18344b] focus-within:ring-2 focus-within:ring-[#18344b]/15 sm:h-16">
        <Search className="h-5 w-5 shrink-0 text-[#18344b]" aria-hidden="true" />
        <input id="hero-place" value={place} onChange={event => setPlace(event.target.value)} placeholder="Enter a city or place" autoComplete="off" className="min-w-0 flex-1 bg-transparent text-base text-[#18344b] outline-none placeholder:text-slate-400" />
      </div>
      <Button data-testid="hero-submit" type="submit" size="lg" className="mt-4 h-14 w-full bg-[#18344b] text-base text-white hover:bg-[#10283a] sm:w-[290px]">Design for free</Button>
      <p className="mt-3 text-center text-sm text-slate-500 sm:w-[290px]">No card required</p>
    </form>
  );
}
