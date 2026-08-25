"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, ChevronRight, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

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
    const draftId = crypto.randomUUID();
    router.push(`/app/design/${draftId}?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-28 sm:px-6 sm:py-10 sm:pb-10">
      <div className="mb-6 text-center sm:mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Where should we map?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Search for a city, address, or landmark.
        </p>
      </div>

          <Card className="shadow-sm">
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="location">Place</Label>
                  <Input
                    id="location"
                    placeholder="Paris, France or Eiffel Tower"
                    value={locationText}
                    onChange={(e) => {
                      setLocationText(e.target.value);
                      setFound(false);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleFindLocation()}
                  />
              </div>

              <Button onClick={handleFindLocation} disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" />
                ) : (
                  <MapPin className="mr-2 h-5 w-5 shrink-0" />
                )}
                Find Location
              </Button>

              {found && lat && lon && (
                <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
                  <p className="font-medium">
                    {city || "Location"}
                    {country && <span className="text-muted-foreground">, {country}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
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
                Manual entry
              </button>

              {showAdvanced && (
                <div className="space-y-3 border-t pt-3">
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

            </CardContent>
          </Card>

      <div className="mt-6 hidden sm:flex sm:justify-end">
        <Button onClick={handleNext} disabled={!found} size="lg">
          Next
          <ChevronRight className="ml-2 h-5 w-5 shrink-0" />
        </Button>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-4 backdrop-blur sm:hidden">
        <Button onClick={handleNext} disabled={!found} size="lg" className="h-12 w-full gap-2">
          Next
          <ChevronRight className="h-5 w-5 shrink-0" />
        </Button>
      </div>
    </div>
  );
}
