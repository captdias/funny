import { chromium } from "@playwright/test";
import robotsParser from "robots-parser";
import { access, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { recipeNode, toRecipe } from "./lib/matprat";
import type { Recipe } from "../src/lib/types";

const ROOT = "https://www.matprat.no";
const USER_AGENT = "MiddagPlanner/1.0";
const DEFAULT_URLS = [
  `${ROOT}/oppskrifter/familien/glutenfrie-pizzasnurrer/`,
  `${ROOT}/oppskrifter/familien/glutenfrie-fylte-horn/`,
  `${ROOT}/oppskrifter/kos/grove-glutenfrie-pannekaker/`,
];

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "Bruk: npm run scrape -- [--merge] [--limit 8] [--url https://www.matprat.no/oppskrifter/.../] [--discover]\nUten URL-er hentes tre glutenfrie småretter. --discover bruker lenker fra Matprats glutenfri-side.\n--merge bevarer eksisterende oppskrifter. Alle sidenavigasjoner har minst 2 sekunders pause.",
    );
    return;
  }
  const allowed = new Set(["--merge", "--limit", "--url", "--discover"]);
  let limit = 8;
  const urls: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i])) throw new Error(`Ukjent argument: ${args[i]}`);
    if (args[i] === "--limit") {
      limit = Number(args[++i]);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50)
        throw new Error("--limit må være et heltall mellom 1 og 50.");
    } else if (args[i] === "--url") {
      const url = new URL(args[++i]);
      if (
        url.origin !== ROOT ||
        !/^\/oppskrifter\/[^/]+\/[^/]+\/$/.test(url.pathname)
      )
        throw new Error("Bruk en HTTPS-oppskriftsadresse på www.matprat.no.");
      urls.push(url.href);
    }
  }
  let executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (!executablePath) {
    try {
      await access("/usr/bin/chromium");
      executablePath = "/usr/bin/chromium";
    } catch {
      /* Use Playwright's installed browser. */
    }
  }
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  const proxy = proxyUrl ? new URL(proxyUrl) : null;
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    proxy: proxy
      ? {
          server: `${proxy.protocol}//${proxy.host}`,
          ...(proxy.username
            ? {
                username: decodeURIComponent(proxy.username),
                password: decodeURIComponent(proxy.password),
              }
            : {}),
        }
      : undefined,
  });
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const robotsResponse = await context.request.get(`${ROOT}/robots.txt`, {
      timeout: 30_000,
    });
    if (!robotsResponse.ok())
      throw new Error(
        `robots.txt kunne ikke kontrolleres: HTTP ${robotsResponse.status()}`,
      );
    const robots = robotsParser(
      `${ROOT}/robots.txt`,
      await robotsResponse.text(),
    );
    const page = await context.newPage();
    // Third-party trackers and images are not necessary for recipe extraction.
    await page.route("**/*", async (route) => {
      const request = route.request();
      const host = new URL(request.url()).hostname;
      if (
        ["image", "media", "font"].includes(request.resourceType()) ||
        !["www.matprat.no", "matprat.no"].includes(host)
      )
        return route.abort();
      // The API client honors the host's trusted CA configuration. Feed verified
      // responses into Chromium without modifying its certificate store or disabling TLS.
      try {
        const response = await route.fetch({ timeout: 30_000 });
        await route.fulfill({ response });
      } catch {
        // Background requests may be cancelled during navigation or shutdown.
        // Do not print request headers or cookies from transport errors.
        await route.abort().catch(() => {});
      }
    });
    let visited = false;
    const visit = async (url: string) => {
      if (robots.isAllowed(url, USER_AGENT) === false)
        throw new Error(`robots.txt tillater ikke ${url}`);
      if (visited) await pause(2_000);
      visited = true;
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      if (!response?.ok())
        throw new Error(`HTTP ${response?.status() ?? "ukjent"} ved ${url}`);
      if (new URL(page.url()).origin !== ROOT)
        throw new Error("Uventet videresending utenfor Matprat.");
    };
    const curated = new Set<string>();
    if (args.includes("--discover")) {
      await visit(`${ROOT}/glutenfri/`);
      await page
        .locator('main a[href*="/oppskrifter/"]')
        .first()
        .waitFor({ timeout: 15_000 });
      const links = await page
        .locator('main a[href*="/oppskrifter/"]')
        .evaluateAll((anchors) =>
          anchors.map((a) => (a as HTMLAnchorElement).href),
        );
      for (const url of links)
        if (
          url.startsWith(`${ROOT}/oppskrifter/`) &&
          new URL(url).pathname.split("/").filter(Boolean).length === 3
        )
          curated.add(url);
      urls.push(...curated);
    }
    if (!urls.length) urls.push(...DEFAULT_URLS);
    const results: Recipe[] = [];
    const failures: string[] = [];
    for (const url of [...new Set(urls)].slice(0, limit)) {
      console.log(`Henter ${url}`);
      try {
        await visit(url);
        await page
          .locator('script[type="application/ld+json"]')
          .first()
          .waitFor({ state: "attached", timeout: 15_000 });
        const scripts = await page
          .locator('script[type="application/ld+json"]')
          .allTextContents();
        let found = null;
        for (const script of scripts) {
          try {
            found = recipeNode(JSON.parse(script));
          } catch {
            /* Other schema blocks can be malformed. */
          }
          if (found) break;
        }
        if (!found)
          throw new Error("Fant ingen Recipe-data i den ferdiglastede siden.");
        results.push(toRecipe(found, url, curated.has(url)));
      } catch (error) {
        failures.push(url);
        console.error(
          `Hoppet over: ${error instanceof Error ? error.message : "Ukjent feil"}`,
        );
      }
    }
    if (!results.length)
      throw new Error(
        "Ingen oppskrifter ble hentet. Eksisterende recipes.json er urørt.",
      );
    const output = resolve(process.cwd(), "src/data/recipes.json");
    let recipes: Recipe[] = results;
    if (args.includes("--merge")) {
      const previous: Recipe[] = JSON.parse(await readFile(output, "utf8"));
      const byId = new Map(previous.map((recipe) => [recipe.id, recipe]));
      for (const recipe of results) byId.set(recipe.id, recipe);
      recipes = [...byId.values()];
    }
    await writeFile(
      `${output}.tmp`,
      `${JSON.stringify(recipes, null, 2)}\n`,
      "utf8",
    );
    await rename(`${output}.tmp`, output);
    console.log(
      `Lagret ${results.length} Matprat-oppskrifter (${recipes.length} totalt) i src/data/recipes.json.`,
    );
    if (failures.length) {
      console.error(
        `${failures.length} sider feilet. Vellykkede oppskrifter er lagret.`,
      );
      process.exitCode = 1;
    }
  } finally {
    for (const context of browser.contexts()) {
      for (const page of context.pages())
        await page.unrouteAll({ behavior: "ignoreErrors" });
      await context.request.dispose();
      await context.close();
    }
    await browser.close();
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Skrapingen feilet.");
  process.exitCode = 1;
});
