import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

import { createClient } from "@supabase/supabase-js";
import { spawn } from "child_process";
import * as fs from "fs";
import * as crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || "python";
const POSTER_CLI_PATH =
  process.env.POSTER_CLI_PATH || "./create_map_poster.py";
const POLL_INTERVAL_MS = 5000;

/** Max time for one Python CLI run. Map + some themes can exceed 5m on cold cache. */
function resolvePythonTimeoutMs(): number {
  const fromMs = process.env.POSTER_CLI_TIMEOUT_MS;
  if (fromMs) {
    const n = parseInt(fromMs, 10);
    if (!Number.isNaN(n) && n >= 60_000) return n;
  }
  const fromSec = process.env.POSTER_CLI_TIMEOUT_SEC;
  if (fromSec) {
    const n = parseInt(fromSec, 10);
    if (!Number.isNaN(n) && n >= 60) return n * 1000;
  }
  return 15 * 60 * 1000; // 15 minutes default
}

const PYTHON_TIMEOUT_MS = resolvePythonTimeoutMs();
const STUCK_JOB_CHECK_INTERVAL = 12; // check every 12 polls (~60s)
const TMP_DIR = path.resolve("tmp");

let shuttingDown = false;
let currentJobId: string | null = null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Mirrors lib/billing-period.ts — inlined so the Railway/Docker worker image
 * (which only copies scripts/, not lib/) does not need extra modules.
 */
function usageStatsPeriodBounds(sub: {
  current_period_start: string | null;
  current_period_end: string | null;
  stripe_sub_id: string | null;
  created_at: string;
}): { start: Date; end: Date } {
  const end = sub.current_period_end
    ? new Date(sub.current_period_end)
    : new Date(sub.created_at);
  let start: Date;
  if (sub.current_period_start) {
    start = new Date(sub.current_period_start);
  } else if (!sub.stripe_sub_id) {
    start = new Date(sub.created_at);
  } else {
    start = new Date(end);
    start.setUTCMonth(start.getUTCMonth() - 1);
  }
  return { start, end };
}

/**
 * Mirrors lib/plan-config.ts. Slugs that carry the paid membership, including
 * pre-014 rows that have not been re-pointed yet.
 */
const MEMBERSHIP_SLUGS = new Set([
  "membership",
  "starter",
  "pro",
  "basic",
  "pro_plus",
]);

/**
 * Settle the download allowance a job reserved when it was created.
 *
 * A failed render releases the hold, so a user is never charged a download
 * for our error. Idempotent on the database side, so a retried callback or a
 * job with no reservation (previews, physical print renders) is a no-op.
 */
async function settleDownloadReservation(
  jobId: string,
  succeeded: boolean
): Promise<void> {
  const { error } = await supabase.rpc("settle_download_reservation", {
    p_job_id: jobId,
    p_succeeded: succeeded,
  });
  if (error) {
    console.error(
      `  Failed to settle download reservation for ${jobId}:`,
      error.message
    );
  }
}

const SIZES = [
  { key: "png_24x36", width: 12, height: 18 },
  { key: "png_18x24", width: 9, height: 12 },
  { key: "png_12x18", width: 6, height: 9 },
  { key: "png_11x14", width: 5.5, height: 7 },
  { key: "png_8x10", width: 4, height: 5 },
] as const;

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
}

interface PosterMarker {
  lat: number;
  lon: number;
  label: string;
}

interface PosterConfig {
  style_id: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  distance: number;
  width: number;
  height: number;
  show_labels: boolean;
  show_water: boolean;
  show_parks: boolean;
  title: string;
  subtitle: string;
  date_line: string;
  show_coordinates?: boolean;
  format: string;
  rotation?: number;
  offset_x?: number;
  offset_y?: number;
  markers?: PosterMarker[];
  gpx_data?: string;
  /** Set on physical-order render jobs; triggers a single high-DPI print PNG. */
  print_size_key?: string;
}

function runPythonCli(
  config: PosterConfig,
  outputFile: string,
  format: string,
  width: number,
  height: number,
  dpi?: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const theme = config.style_id || "warm_beige";

    const args = [
      POSTER_CLI_PATH,
      "--city",
      config.city,
      "--latitude",
      String(config.lat),
      "--longitude",
      String(config.lon),
      "--theme",
      theme,
      "--distance",
      String(config.distance),
      "--width",
      String(width),
      "--height",
      String(height),
      "--format",
      format,
    ];

    if (dpi && Number.isFinite(dpi)) {
      args.push("--dpi", String(Math.round(dpi)));
    }

    if (config.country) {
      args.push("--country", config.country);
    }

    // Pass display copy even when blank so the renderer does not fall back to
    // the geocoding city/country used to fetch the map.
    args.push("--display-city", config.title || "");
    args.push("--display-country", config.subtitle || "");
    if (config.date_line) args.push("--date-line", config.date_line);
    if (config.show_coordinates === false) args.push("--hide-coordinates");

    // --- Advanced map framing & overlays ---
    if (config.rotation) {
      args.push("--rotation", String(config.rotation));
    }
    if (config.offset_x) {
      args.push("--offset-x", String(config.offset_x));
    }
    if (config.offset_y) {
      args.push("--offset-y", String(config.offset_y));
    }
    if (Array.isArray(config.markers)) {
      for (const m of config.markers) {
        if (
          typeof m?.lat === "number" &&
          typeof m?.lon === "number" &&
          Number.isFinite(m.lat) &&
          Number.isFinite(m.lon)
        ) {
          const label = (m.label || "").replace(/[\r\n]+/g, " ");
          args.push("--marker", `${m.lat},${m.lon},${label}`);
        }
      }
    }

    // Materialize embedded GPX XML to a temp file the CLI can read, alongside
    // the output file so it shares the job's temp dir lifecycle.
    let gpxTempPath: string | null = null;
    if (config.gpx_data && config.gpx_data.trim()) {
      gpxTempPath = `${outputFile}.route.gpx`;
      try {
        fs.writeFileSync(gpxTempPath, config.gpx_data, "utf-8");
        args.push("--gpx", gpxTempPath);
      } catch (e) {
        console.error(`  Failed to write GPX temp file: ${e}`);
        gpxTempPath = null;
      }
    }

    const cleanupGpx = () => {
      if (gpxTempPath) {
        try {
          fs.rmSync(gpxTempPath, { force: true });
        } catch {
          // ignore cleanup errors
        }
        gpxTempPath = null;
      }
    };

    console.log(
      `  Running: ${PYTHON_EXECUTABLE} ${args.join(" ").substring(0, 120)}...`
    );

    const proc = spawn(PYTHON_EXECUTABLE, args, {
      cwd: path.resolve("."),
      env: {
        ...process.env,
        CACHE_DIR: path.resolve("cache"),
        PYTHONIOENCODING: "utf-8",
      },
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timeout = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
      cleanupGpx();
      reject(new Error(`Python process timed out after ${PYTHON_TIMEOUT_MS / 1000}s`));
    }, PYTHON_TIMEOUT_MS);

    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    proc.on("close", (code, signal) => {
      clearTimeout(timeout);
      cleanupGpx();
      if (killed) return;

      if (code !== 0 || signal) {
        const reason = signal
          ? `killed by signal ${signal} (likely OOM — increase Railway memory limit)`
          : `exited with code ${code}`;
        console.error(`  Python process ${reason}`);
        console.error(`  stderr: ${stderr.substring(0, 500)}`);
        reject(new Error(`Python process ${reason}: ${stderr.substring(0, 300)}`));
        return;
      }

      const postersDir = path.resolve("posters");
      if (fs.existsSync(postersDir)) {
        const files = fs
          .readdirSync(postersDir)
          .filter((f) => f.endsWith(`.${format}`))
          .sort(
            (a, b) =>
              fs.statSync(path.join(postersDir, b)).mtimeMs -
              fs.statSync(path.join(postersDir, a)).mtimeMs
          );

        if (files.length > 0) {
          const latestFile = path.join(postersDir, files[0]);
          fs.copyFileSync(latestFile, outputFile);
          resolve();
          return;
        }
      }

      reject(new Error("Generated file not found in posters/ directory"));
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      cleanupGpx();
      reject(new Error(`Failed to spawn Python: ${err.message}`));
    });
  });
}

async function uploadFile(
  localPath: string,
  storagePath: string
): Promise<void> {
  const fileBuffer = fs.readFileSync(localPath);
  const contentType = localPath.endsWith(".pdf")
    ? "application/pdf"
    : localPath.endsWith(".svg")
      ? "image/svg+xml"
      : "image/png";

  const { error } = await supabase.storage
    .from("posters")
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Upload failed for ${storagePath}: ${error.message}`);
  }
}

/**
 * Tell the web app a render finished so it can advance any linked physical
 * order to Gelato. Fire-and-forget; the Stripe webhook is the other trigger,
 * so a failed callback here is not fatal.
 */
async function notifyJobComplete(jobId: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.WORKER_CALLBACK_SECRET;
  if (!appUrl || !secret) return;

  try {
    const res = await fetch(`${appUrl.replace(/\/$/, "")}/api/internal/job-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, secret }),
    });
    if (!res.ok) {
      console.error(`  job-complete callback for ${jobId} returned ${res.status}`);
    }
  } catch (err) {
    console.error(`  job-complete callback for ${jobId} failed:`, err);
  }
}

async function recoverStuckJobs(): Promise<void> {
  try {
    const { data: count, error } = await supabase.rpc("recover_stuck_jobs", {
      p_timeout_minutes: 10,
    });
    if (error) {
      console.error("Stuck job recovery error:", error.message);
    } else if (count > 0) {
      console.log(`  Recovered ${count} stuck job(s)`);
    }
  } catch (err) {
    console.error("Stuck job recovery failed:", err);
  }

  // Hand back allowance held by jobs that can no longer succeed — including
  // the ones just marked failed above, and any reservation orphaned by a
  // worker that died mid-render.
  try {
    const { data: released, error } = await supabase.rpc(
      "release_stale_download_reservations",
      {}
    );
    if (error) {
      console.error("Stale reservation sweep error:", error.message);
    } else if (released > 0) {
      console.log(`  Released ${released} stale download reservation(s)`);
    }
  } catch (err) {
    console.error("Stale reservation sweep failed:", err);
  }
}

async function processJob(jobId: string): Promise<void> {
  currentJobId = jobId;
  console.log(`\nProcessing job ${jobId}...`);

  // Job is already marked 'running' by claim_next_job()
  const { data: job, error } = await supabase
    .from("poster_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    console.error(`  Job ${jobId} not found`);
    return;
  }

  const config = job.input as PosterConfig;
  const userId = job.user_id;
  const isPreview = job.is_preview;
  const jobDir = path.join(TMP_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const printSizeKey = config.print_size_key;

  try {
    const output: Record<string, string> = {};

    if (printSizeKey) {
      // Physical-order render: a single print-ready PNG at the product's
      // aspect ratio. config.width/height are the render dimensions chosen by
      // the order API; 300 DPI keeps the long edge near 6000px.
      const outputFile = path.join(jobDir, "print.png");
      await runPythonCli(config, outputFile, "png", config.width, config.height, 300);
      const storagePath = `${userId}/${jobId}/print.png`;
      await uploadFile(outputFile, storagePath);
      output.print = storagePath;
      // Reuse the same image as the order preview thumbnail.
      output.preview = storagePath;
    } else if (isPreview) {
      // Generate a single small preview PNG
      const outputFile = path.join(jobDir, "preview.png");
      await runPythonCli(config, outputFile, "png", 4, 5.3);

      const storagePath = `${userId}/${jobId}/preview.png`;
      await uploadFile(outputFile, storagePath);
      output.preview = storagePath;
    } else {
      // Find the matching size key from config dimensions
      const matchedSize = SIZES.find(
        (s) => s.width === config.width && s.height === config.height
      ) || SIZES[1]; // default to 18x24

      // Generate the selected PNG size
      const pngFile = path.join(jobDir, `${matchedSize.key}.png`);
      await runPythonCli(config, pngFile, "png", matchedSize.width, matchedSize.height);
      const pngPath = `${userId}/${jobId}/${matchedSize.key}.png`;
      await uploadFile(pngFile, pngPath);
      output[matchedSize.key] = pngPath;

      // Generate PDF at standard poster dimensions (12×16) for best print quality
      const pdfFile = path.join(jobDir, "poster.pdf");
      await runPythonCli(config, pdfFile, "pdf", 12, 16);
      const pdfPath = `${userId}/${jobId}/poster.pdf`;
      await uploadFile(pdfFile, pdfPath);
      output.pdf = pdfPath;

      const { data: userSub } = await supabase
        .from("subscriptions")
        .select(
          "plan_slug, current_period_start, current_period_end, stripe_sub_id, created_at"
        )
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Every membership includes SVG export; there is only one paid plan.
      if (userSub?.plan_slug && MEMBERSHIP_SLUGS.has(userSub.plan_slug)) {
        const svgFile = path.join(jobDir, "poster.svg");
        await runPythonCli(config, svgFile, "svg", 12, 16);
        const svgPath = `${userId}/${jobId}/poster.svg`;
        await uploadFile(svgFile, svgPath);
        output.svg = svgPath;
      }

      // Use the PNG as the preview (scaled down) instead of a separate render
      const previewPath = `${userId}/${jobId}/preview.png`;
      await uploadFile(pngFile, previewPath);
      output.preview = previewPath;

      // Create poster record
      await supabase.from("posters").insert({
        user_id: userId,
        job_id: jobId,
        title: config.title || config.city,
        subtitle: config.subtitle || null,
        location_text: `${config.city}, ${config.country}`,
        config,
        config_hash: job.config_hash,
        storage_paths: output,
      });

      if (userSub) {
        const { start, end } = usageStatsPeriodBounds(userSub);
        await supabase.rpc("increment_usage", {
          p_user_id: userId,
          p_period_start: start.toISOString().split("T")[0],
          p_period_end: end.toISOString().split("T")[0],
        });
      }
    }

    // Mark done
    await supabase
      .from("poster_jobs")
      .update({
        status: "done",
        output,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    await settleDownloadReservation(jobId, true);

    console.log(`  Job ${jobId} completed successfully`);

    // Notify the web app so it can submit any paid physical order tied to this
    // render to Gelato (no-op for previews/downloads or if not configured).
    if (printSizeKey) {
      await notifyJobComplete(jobId);
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    console.error(`  Job ${jobId} failed:`, errorMessage);

    await supabase
      .from("poster_jobs")
      .update({
        status: "failed",
        error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    // Give the download back — the user must not pay for a render we lost.
    await settleDownloadReservation(jobId, false);
  } finally {
    currentJobId = null;
    try {
      fs.rmSync(jobDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

async function pollForJobs(): Promise<boolean> {
  // Atomic claim: uses FOR UPDATE SKIP LOCKED so multiple worker
  // instances never grab the same job. Returns true when a job was
  // claimed so the caller can skip the idle backoff and drain the queue.
  const { data: jobId, error } = await supabase.rpc("claim_next_job");

  if (error) {
    console.error("Claim error:", error.message);
    return false;
  }

  if (jobId) {
    await processJob(jobId);
    return true;
  }

  return false;
}

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down gracefully...`);

  if (currentJobId) {
    console.log(`  Waiting for job ${currentJobId} to finish...`);
    const waitStart = Date.now();
    while (currentJobId && Date.now() - waitStart < PYTHON_TIMEOUT_MS + 10_000) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log("Worker stopped");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

async function main() {
  console.log("Poster Armory Worker started");
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log(`  Python: ${PYTHON_EXECUTABLE}`);
  console.log(`  CLI: ${POSTER_CLI_PATH}`);
  console.log(`  Polling every ${POLL_INTERVAL_MS}ms`);
  console.log(
    `  Python timeout: ${PYTHON_TIMEOUT_MS / 1000}s (POSTER_CLI_TIMEOUT_SEC / POSTER_CLI_TIMEOUT_MS)`
  );
  console.log("");

  ensureTmpDir();

  let pollCount = 0;
  let claimedAJob = false;

  while (!shuttingDown) {
    try {
      claimedAJob = await pollForJobs();

      pollCount++;
      if (pollCount >= STUCK_JOB_CHECK_INTERVAL) {
        await recoverStuckJobs();
        pollCount = 0;
      }
    } catch (err) {
      console.error("Worker loop error:", err);
      claimedAJob = false;
    }

    // Drain the queue: if we just processed a job, loop again immediately.
    // Only sleep when the queue was empty so users with N pending jobs don't
    // wait POLL_INTERVAL_MS × N extra seconds.
    if (!claimedAJob && !shuttingDown) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

main();
