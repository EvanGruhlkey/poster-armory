"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  MapPin,
  ChevronRight,
  Loader2,
  ChevronDown,
  Heart,
  Home,
  KeyRound,
  Plane,
} from "lucide-react";
import { toast } from "sonner";

const OCCASIONS = [
  { label: "Where we met", value: "Where We Met", icon: Heart },
  { label: "Our first home", value: "Our First Home", icon: KeyRound },
  { label: "My hometown", value: "Hometown", icon: Home },
  { label: "A favorite trip", value: "A Favorite Trip", icon: Plane },
] as const;

const ONBOARDING_STEPS = ["Place", "Style", "Words", "Layout", "Preview"];

export default function PickLocationPage() {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [locationText, setLocationText] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [found, setFound] = useState(false);
  const [occasion, setOccasion] = useState("");

  async function reverseGeocode(latitude: string, longitude: string) {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
      { headers: { "User-Agent": "PosterArmory/1.0" } }
    );
    const data = await res.json();
    if (data?.address) {
      if (!city && (data.address.city || data.address.town || data.address.village)) {
        setCity(data.address.city || data.address.town || data.address.village);
      }
      if (data.address.country) {
        setCountry(data.address.country);
      }
    }
    return data;
  }

  async function handleFindLocation() {
    if (!city && !locationText && !lat && !lon) {
      toast.error("Enter a city or place name.");
      return;
    }
    setLoading(true);

    try {
      if (!city && !locationText && lat && lon) {
        const data = await reverseGeocode(lat, lon);
        if (data?.display_name) {
          setFound(true);
          toast.success(`Found: ${data.display_name}`);
        } else {
          toast.error("Could not identify this location.");
        }
        return;
      }

      const query = locationText || `${city}${country ? `, ${country}` : ""}`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { "User-Agent": "PosterArmory/1.0" } }
      );
      const data = await res.json();

      if (data && data.length > 0) {
        const result = data[0];
        setLat(parseFloat(result.lat).toFixed(4));
        setLon(parseFloat(result.lon).toFixed(4));

        if (!city) {
          const fallbackCity = result.address?.city || result.address?.town || result.address?.village;
          if (fallbackCity) {
            setCity(fallbackCity);
          } else if (result.display_name) {
            setCity(result.display_name.split(",")[0]?.trim() || "");
          }
        }

        if (result.address?.country) {
          setCountry(result.address.country);
        } else if (!country && result.display_name) {
          const parts = result.display_name.split(",");
          setCountry(parts[parts.length - 1]?.trim() || "");
        }

        setFound(true);
        toast.success(`Found: ${result.display_name}`);
      } else {
        toast.error("Location not found. Try a different search.");
      }
    } catch {
      toast.error("Failed to look up location. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleNext() {
    if (!lat || !lon) {
      toast.error("Find a location first.");
      return;
    }

    let finalCity = city;
    let finalCountry = country;

    if (!finalCity || !finalCountry) {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
          { headers: { "User-Agent": "PosterArmory/1.0" } }
        );
        const data = await res.json();
        if (data?.address) {
          if (!finalCity) {
            finalCity = data.address.city || data.address.town || data.address.village || "Unknown";
          }
          if (!finalCountry) {
            finalCountry = data.address.country || "";
          }
          setCity(finalCity);
          setCountry(finalCountry);
        }
      } catch {
        // proceed with what we have
      } finally {
        setLoading(false);
      }
    }

    if (!finalCity) {
      toast.error("Please enter a city name.");
      return;
    }

    const params = new URLSearchParams({
      city: finalCity,
      country: finalCountry,
      lat,
      lon,
    });
    if (occasion) params.set("occasion", occasion);
    const draftId = crypto.randomUUID();
    router.push(`/app/design/${draftId}?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:py-10 sm:pb-10 lg:px-8">
      <div className="mb-8 hidden sm:block">
        <ol className="mx-auto flex max-w-2xl items-center" aria-label="Poster creation progress">
          {ONBOARDING_STEPS.map((step, index) => (
            <li key={step} className="flex min-w-0 flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    index === 0
                      ? "bg-primary text-primary-foreground"
                      : "border bg-card text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </span>
                <span className={`text-xs ${index === 0 ? "font-medium" : "text-muted-foreground"}`}>
                  {step}
                </span>
              </div>
              {index < ONBOARDING_STEPS.length - 1 && (
                <span className="mx-2 mb-5 h-px min-w-4 flex-1 bg-border" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
        <div>
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Step 1 of 5 · Choose a place
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Where did your story happen?
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Search for a city, address, landmark, or meaningful place. You can
              refine the exact map area before creating your free preview.
            </p>
          </div>

          <Card className="shadow-sm">
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label htmlFor="location">Place</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="location"
                    placeholder="Paris, France or Eiffel Tower"
                    value={locationText}
                    onChange={(e) => {
                      setLocationText(e.target.value);
                      setFound(false);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleFindLocation()}
                    className="h-11 flex-1"
                  />
                  <Button
                    onClick={handleFindLocation}
                    disabled={loading}
                    className="h-11 shrink-0 sm:px-5"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <MapPin className="mr-2 h-4 w-4 shrink-0" />
                    )}
                    Find place
                  </Button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  What makes this place meaningful?
                </p>
                <div className="flex flex-wrap gap-2">
                  {OCCASIONS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setOccasion(occasion === item.value ? "" : item.value)}
                      aria-pressed={occasion === item.value}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        occasion === item.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {found && lat && lon && (
                <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                    {city || "Location"}
                    {country && <span className="text-muted-foreground">, {country}</span>}
                  </p>
                  <p className="ml-6 mt-0.5 text-xs text-muted-foreground">
                    {lat}, {lon}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                />
                Enter coordinates manually
              </button>

              {showAdvanced && (
                <div className="space-y-3 border-t pt-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="city" className="text-xs">City</Label>
                      <Input id="city" placeholder="Paris" value={city} onChange={(e) => setCity(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="country" className="text-xs">Country</Label>
                      <Input id="country" placeholder="France" value={country} onChange={(e) => setCountry(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="lat" className="text-xs">Latitude</Label>
                      <Input
                        id="lat"
                        placeholder="48.8566"
                        value={lat}
                        onChange={(e) => {
                          setLat(e.target.value);
                          if (e.target.value && lon) setFound(true);
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lon" className="text-xs">Longitude</Label>
                      <Input
                        id="lon"
                        placeholder="2.3522"
                        value={lon}
                        onChange={(e) => {
                          setLon(e.target.value);
                          if (lat && e.target.value) setFound(true);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={handleNext} disabled={!found} size="lg" className="hidden w-full sm:flex">
                Choose a style
                <ChevronRight className="ml-2 h-5 w-5 shrink-0" />
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Free to preview · No account or credit card required
              </p>
            </CardContent>
          </Card>
        </div>

        <aside className="hidden lg:block" aria-label="Example personalized poster">
          <div className="sticky top-24">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Your starting point
              </p>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                LIVE SAMPLE
              </span>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card p-3 shadow-lg shadow-primary/5">
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
                <Image
                  src="/example-posters/venice-blueprint.webp"
                  alt="Example Venice Blueprint map poster"
                  fill
                  priority
                  className="object-cover"
                  sizes="380px"
                />
              </div>
              <div className="flex items-start justify-between gap-4 px-1 pb-1 pt-3">
                <div>
                  <p className="text-sm font-semibold">Venice · Blueprint</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Every place starts with a polished design.
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-primary">17 themes</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-4 backdrop-blur sm:hidden">
        <Button onClick={handleNext} disabled={!found} size="lg" className="h-12 w-full gap-2">
          Choose a style
          <ChevronRight className="h-5 w-5 shrink-0" />
        </Button>
      </div>
    </div>
  );
}
