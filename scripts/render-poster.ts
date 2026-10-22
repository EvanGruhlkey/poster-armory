import * as fs from "node:fs/promises";
import puppeteer from "puppeteer-core";

export function printPixelSize(widthInches: number, heightInches: number) {
  return {
    width: Math.round(widthInches * 300),
    height: Math.round(heightInches * 300),
  };
}

export function isClientRenderedJob(input: { render_engine?: string; print_size_key?: string } | null): boolean {
  return input?.render_engine === "webgl" && !input.print_size_key;
}

export async function renderPrintPoster(
  config: Record<string, unknown>,
  outputFile: string,
  widthPx: number,
  heightPx: number,
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is required for print rendering.");
  const executablePath = process.env.CHROME_PATH || (process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/chromium");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader"],
  });
  try {
    const page = await browser.newPage();
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
    page.setDefaultTimeout(180_000);
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await page.goto(`${appUrl.replace(/\/$/, "")}/internal/render`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof (window as Window & { renderPosterForWorker?: unknown }).renderPosterForWorker === "function");
    const dataUrl = await page.evaluate(async ({ config, widthPx, heightPx }) => {
      const render = (window as Window & {
        renderPosterForWorker: (config: Record<string, unknown>, width: number, height: number) => Promise<string>;
      }).renderPosterForWorker;
      try { return await render(config, widthPx, heightPx); }
      catch (error) { throw new Error(error instanceof Error ? error.stack ?? error.message : String(error)); }
    }, { config, widthPx, heightPx }).catch((error) => {
      throw new Error(`Print render failed: ${error instanceof Error ? error.message : String(error)}; browser: ${browserErrors.slice(-3).join(" | ")}`);
    });
    if (!dataUrl.startsWith("data:image/png;base64,")) throw new Error("The render page did not return a PNG.");
    const png = Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");
    if (png.readUInt32BE(16) !== widthPx || png.readUInt32BE(20) !== heightPx) {
      throw new Error("Print renderer returned the wrong pixel dimensions.");
    }
    await fs.writeFile(outputFile, png);
  } finally {
    await browser.close();
  }
}
