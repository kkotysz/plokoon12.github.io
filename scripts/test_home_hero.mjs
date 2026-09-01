import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.AUDIT_BASE_URL || "http://127.0.0.1:4001").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
const failures = [];

async function runTest(name, test) {
  try {
    await test();
    console.log(`[hero] ${name}: OK`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`[hero] ${name}: FAILED`);
  }
}

async function openHome(options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 360, height: 800 },
    reducedMotion: options.reducedMotion || "no-preference"
  });

  if (options.saveData) {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: { saveData: true }
      });
    });
  }

  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  const response = await page.goto(`${baseUrl}/`, { waitUntil: "load", timeout: 30_000 });
  assert.ok(response?.ok(), `Home returned HTTP ${response?.status() ?? "no response"}`);

  return { context, page, consoleErrors };
}

async function closeHome(context, consoleErrors) {
  await context.close();
  assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join(" | ")}`);
}

await runTest("responsive sources and first viewport", async () => {
  const viewports = [
    { width: 360, height: 800, source: "home-telescope-960.mp4" },
    { width: 768, height: 1024, source: "home-telescope-960.mp4" },
    { width: 1440, height: 900, source: "home-telescope-1600.mp4" }
  ];

  for (const viewport of viewports) {
    const { context, page, consoleErrors } = await openHome({ viewport });

    try {
      await page.waitForFunction(() => {
        const video = document.querySelector("[data-hero-video]");
        return video && video.readyState >= HTMLMediaElement.HAVE_METADATA;
      }, null, { timeout: 15_000 });

      const state = await page.evaluate(() => {
        const scene = document.querySelector("[data-hero-timelapse]");
        const hero = document.querySelector(".home-hero");
        const video = document.querySelector("[data-hero-video]");
        const cue = document.querySelector(".hero-scroll");
        const buttons = Array.from(document.querySelectorAll(".hero-actions .button"));
        const cueBox = cue.getBoundingClientRect();

        return {
          sceneEnabled: scene.classList.contains("is-timelapse-enabled"),
          sceneHeight: scene.offsetHeight,
          heroHeight: hero.offsetHeight,
          source: video.currentSrc,
          cueText: cue.innerText.replace(/\s+/g, " ").trim(),
          cueVisible: cueBox.top >= 0 && cueBox.bottom <= innerHeight,
          buttonsVisible: buttons.every((button) => {
            const box = button.getBoundingClientRect();
            return box.top >= 0 && box.bottom <= innerHeight;
          }),
          overflow: document.documentElement.scrollWidth - innerWidth
        };
      });

      assert.equal(state.sceneEnabled, true);
      assert.ok(Math.abs(state.sceneHeight - viewport.height * 1.8) <= 2, `Unexpected scene height: ${state.sceneHeight}`);
      assert.ok(Math.abs(state.heroHeight - viewport.height) <= 2, `Unexpected hero height: ${state.heroHeight}`);
      assert.ok(state.source.includes(viewport.source), `Unexpected source: ${state.source}`);
      assert.match(state.cueText, /SCROLL TO MOVE THE TELESCOPE/i);
      assert.equal(state.cueVisible, true);
      assert.equal(state.buttonsVisible, true);
      assert.ok(state.overflow <= 0, `Horizontal overflow: ${state.overflow}px`);
    } finally {
      await closeHome(context, consoleErrors);
    }
  }
});

await runTest("scroll controls frames and releases the sticky scene", async () => {
  const { context, page, consoleErrors } = await openHome({ viewport: { width: 360, height: 800 } });

  try {
    await page.waitForFunction(() => {
      const video = document.querySelector("[data-hero-video]");
      return video && video.readyState >= HTMLMediaElement.HAVE_METADATA && Number.isFinite(video.duration);
    }, null, { timeout: 15_000 });

    const metrics = await page.evaluate(() => ({
      distance: document.querySelector("[data-hero-timelapse]").offsetHeight - innerHeight,
      duration: document.querySelector("[data-hero-video]").duration
    }));

    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      await page.evaluate((position) => window.scrollTo(0, position), metrics.distance * progress);
      const expectedTime = Math.round(progress * (Math.round(metrics.duration * 12) - 1)) / 12;

      await page.waitForFunction((expected) => {
        const video = document.querySelector("[data-hero-video]");
        return !video.seeking && Math.abs(video.currentTime - expected) < 0.12;
      }, expectedTime, { timeout: 10_000 });

      const state = await page.evaluate(() => {
        const scene = document.querySelector("[data-hero-timelapse]");
        const hero = document.querySelector(".home-hero");
        return {
          progress: Number(getComputedStyle(scene).getPropertyValue("--hero-progress")),
          heroTop: hero.getBoundingClientRect().top
        };
      });

      assert.ok(Math.abs(state.progress - progress) < 0.01, `Progress mismatch at ${progress}: ${state.progress}`);
      assert.ok(Math.abs(state.heroTop) <= 1, `Hero is not sticky at ${progress}: ${state.heroTop}`);
    }

    await page.locator(".hero-scroll").focus();
    assert.equal(await page.locator(".hero-scroll").isVisible(), true);
    await page.locator(".hero-scroll").click();
    await page.waitForFunction(() => window.location.hash === "#evidence" && document.querySelector("#evidence").getBoundingClientRect().top < innerHeight);

    const released = await page.evaluate(() => document.querySelector("#evidence").getBoundingClientRect().top < innerHeight);
    assert.equal(released, true);
  } finally {
    await closeHome(context, consoleErrors);
  }
});

await runTest("reduced motion keeps the static poster", async () => {
  const { context, page, consoleErrors } = await openHome({ reducedMotion: "reduce" });

  try {
    const state = await page.evaluate(() => {
      const scene = document.querySelector("[data-hero-timelapse]");
      const video = document.querySelector("[data-hero-video]");
      return {
        enabled: scene.classList.contains("is-timelapse-enabled"),
        height: scene.offsetHeight,
        viewportHeight: innerHeight,
        source: video.currentSrc,
        videoDisplay: getComputedStyle(video).display,
        label: document.querySelector(".hero-scroll").innerText.replace(/\s+/g, " ").trim()
      };
    });

    assert.equal(state.enabled, false);
    assert.ok(Math.abs(state.height - state.viewportHeight) <= 2);
    assert.equal(state.source, "");
    assert.equal(state.videoDisplay, "none");
    assert.match(state.label, /CONTINUE TO SELECTED EVIDENCE/i);
  } finally {
    await closeHome(context, consoleErrors);
  }
});

await runTest("data saver keeps the static poster", async () => {
  const { context, page, consoleErrors } = await openHome({ saveData: true });

  try {
    const state = await page.evaluate(() => {
      const scene = document.querySelector("[data-hero-timelapse]");
      const video = document.querySelector("[data-hero-video]");
      return {
        enabled: scene.classList.contains("is-timelapse-enabled"),
        height: scene.offsetHeight,
        viewportHeight: innerHeight,
        source: video.currentSrc,
        label: document.querySelector(".hero-scroll").innerText.replace(/\s+/g, " ").trim()
      };
    });

    assert.equal(state.enabled, false);
    assert.ok(Math.abs(state.height - state.viewportHeight) <= 2);
    assert.equal(state.source, "");
    assert.match(state.label, /CONTINUE TO SELECTED EVIDENCE/i);
  } finally {
    await closeHome(context, consoleErrors);
  }
});

await runTest("video failure falls back to the poster", async () => {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await context.newPage();
  await page.route("**/home-telescope-*.mp4*", (route) => route.abort());

  try {
    const response = await page.goto(`${baseUrl}/`, { waitUntil: "load", timeout: 30_000 });
    assert.ok(response?.ok());
    await page.waitForFunction(() => !document.querySelector("[data-hero-timelapse]").classList.contains("is-timelapse-enabled"), null, { timeout: 10_000 });

    const state = await page.evaluate(() => {
      const scene = document.querySelector("[data-hero-timelapse]");
      return {
        static: scene.classList.contains("is-timelapse-static"),
        height: scene.offsetHeight,
        viewportHeight: innerHeight
      };
    });

    assert.equal(state.static, true);
    assert.ok(Math.abs(state.height - state.viewportHeight) <= 2);
  } finally {
    await context.close();
  }
});

await browser.close();

if (failures.length > 0) {
  console.error(`\n[hero] ${failures.length} failure(s):`);
  for (const failure of failures) {
    console.error(`- ${failure.name}: ${failure.error instanceof Error ? failure.error.stack : failure.error}`);
  }
  process.exit(1);
}

console.log("\n[hero] OK: scroll-driven hero, responsive sources and static fallbacks verified");
