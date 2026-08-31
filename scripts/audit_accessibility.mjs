import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const baseUrl = (process.env.AUDIT_BASE_URL || "http://127.0.0.1:4001").replace(/\/$/, "");
const routes = [
  "/",
  "/projects/",
  "/projects/bhtom/",
  "/projects/alps/",
  "/projects/scientific-data-processing/",
  "/projects/telescope-software-automation/",
  "/experience/",
  "/about/",
  "/cv/",
  "/contact/",
  "/personal/",
  "/gallery/",
  "/gallery/photo/2022-03-23_03-38-50/",
  "/posts/",
  "/teaching/",
  "/slowo-analyzer/",
  "/404.html"
];
const blockingImpacts = new Set(["serious", "critical"]);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce"
});
const failures = [];

try {
  for (const route of routes) {
    const page = await context.newPage();
    const url = `${baseUrl}${route}`;

    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      if (!response || !response.ok()) {
        failures.push({ route, error: `HTTP ${response?.status() ?? "no response"}` });
        continue;
      }

      await page.waitForTimeout(500);
      const result = await new AxeBuilder({ page }).analyze();
      const violations = result.violations.filter((violation) => blockingImpacts.has(violation.impact));

      for (const violation of violations) {
        failures.push({
          route,
          error: `${violation.impact}: ${violation.id} — ${violation.help}`,
          nodes: violation.nodes.map((node) => node.target.join(" "))
        });
      }

      console.log(`[axe] ${route}: ${violations.length === 0 ? "OK" : `${violations.length} blocking violation(s)`}`);
    } catch (error) {
      failures.push({ route, error: error instanceof Error ? error.message : String(error) });
    } finally {
      await page.close();
    }
  }
} finally {
  await context.close();
  await browser.close();
}

if (failures.length > 0) {
  console.error(`\n[axe] ${failures.length} blocking failure(s):`);
  for (const failure of failures) {
    console.error(`- ${failure.route}: ${failure.error}`);
    for (const target of failure.nodes || []) console.error(`  ${target}`);
  }
  process.exit(1);
}

console.log(`\n[axe] OK: ${routes.length} representative routes have no serious or critical violations`);
