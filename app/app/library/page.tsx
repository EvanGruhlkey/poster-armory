export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { PosterCard } from "@/components/poster-card";
import { MapPin, Plus, Crown, ChevronLeft, ChevronRight } from "lucide-react";
import type { Poster, PosterJob } from "@/lib/types";

const PAGE_SIZE = 20;
const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_EXPIRY = 3600;

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan_slug")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const planSlug = sub?.plan_slug;

  if (!planSlug || planSlug === "basic") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <Crown className="mx-auto mb-4 h-12 w-12 text-amber-500" />
        <h1 className="text-2xl font-bold mb-2">Poster Library</h1>
        <p className="text-muted-foreground mb-6">
          Save and revisit your poster designs anytime. The poster library is available on Pro and Pro+ plans.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/app">Create a Poster</Link>
          </Button>
          <Button asChild>
            <Link href="/app/billing">Upgrade to Pro</Link>
          </Button>
        </div>
      </div>
    );
  }

  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [postersResult, countResult, jobsResult] = await Promise.all([
    supabase
      .from("posters")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to),
    supabase
      .from("posters")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    page === 1
      ? supabase
          .from("poster_jobs")
          .select("*")
          .eq("user_id", user.id)
          .in("status", ["queued", "running"])
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const posters = (postersResult.data as Poster[]) || [];
  const totalPosters = countResult.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalPosters / PAGE_SIZE));
  const activeJobs = (page === 1 ? (jobsResult.data as PosterJob[]) : []) || [];

  // Generate signed preview URLs with smaller thumbnail transforms
  const postersWithPreviews = await Promise.all(
    posters.map(async (poster) => {
      const previewPath = poster.storage_paths?.preview;
      if (!previewPath) return poster;

      const { data } = await admin.storage
        .from("posters")
        .createSignedUrl(previewPath, THUMBNAIL_EXPIRY, {
          transform: { width: THUMBNAIL_WIDTH, resize: "contain" },
        });

      return {
        ...poster,
        preview_url: data?.signedUrl || null,
      };
    })
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalPosters} poster{totalPosters !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/app">
            <Plus className="mr-2 h-4 w-4" />
            New Poster
          </Link>
        </Button>
      </div>

      {activeJobs.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground sm:mb-4 sm:text-base sm:text-foreground">
            In progress
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {activeJobs.map((job) => (
              <PosterCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}

      {postersWithPreviews.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {postersWithPreviews.map((poster) => (
              <PosterCard key={poster.id} poster={poster} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className={page <= 1 ? "pointer-events-none opacity-50" : ""}
              >
                <Link href={`/app/library?page=${page - 1}`}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Link>
              </Button>
              <span className="px-3 text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                asChild
                className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
              >
                <Link href={`/app/library?page=${page + 1}`}>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-20">
          <MapPin className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <h3 className="mb-2 text-lg font-semibold">No posters yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Create your first map poster to get started.
          </p>
          <Button asChild>
            <Link href="/app">Create Your First Poster</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
