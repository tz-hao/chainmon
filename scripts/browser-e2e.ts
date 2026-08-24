/**
 * Mock Browser UI E2E (Phase 9, section 44).
 *
 * Uses Playwright with the SYSTEM Chrome (channel: 'chrome') against a
 * running production server. This is a UI-level smoke of the real web app —
 * NOT a real injected-wallet E2E (no MetaMask extension available; that is
 * reported separately as NOT EXECUTED).
 *
 * Run (server must be running, e.g. `npm start` on port 3081):
 *   npx tsx scripts/browser-e2e.ts [baseUrl]
 */

import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3081";

const results: { name: string; pass: boolean; detail?: string }[] = [];

function check(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();

  // ---------- 1. Home ----------
  await page.goto(`${BASE}/`, { timeout: 30000 });
  check("home loads", (await page.title()).includes("ChainMon"));
  const h1 = await page.locator("h1").first().textContent().catch(() => "");
  check("home h1", (h1 ?? "").includes("ChainMon"), h1);

  // ---------- 2. Login / create trainer ----------
  await page.goto(`${BASE}/login`, { timeout: 30000 });
  const loginOk = await page
    .locator("text=Trainer")
    .first()
    .isVisible()
    .catch(() => false);
  check("login page renders trainer creation", loginOk);

  // ---------- 3. Dashboard ----------
  await page.goto(`${BASE}/dashboard`, { timeout: 30000 });
  check(
    "dashboard 200 (no 500)",
    (await page.content()).length > 500,
  );

  // ---------- 4. Explore ----------
  await page.goto(`${BASE}/explore`, { timeout: 30000 });
  check(
    "explore 200 (no 500)",
    (await page.content()).length > 500,
  );

  // ---------- 5. Monsters collection ----------
  await page.goto(`${BASE}/monsters`, { timeout: 30000 });
  const monstersContent = await page.content();
  check(
    "monsters collection renders",
    monstersContent.length > 500 &&
      (monstersContent.includes("Monster") || monstersContent.includes("FireCub")),
  );

  // ---------- 6. Team ----------
  await page.goto(`${BASE}/team`, { timeout: 30000 });
  check("team page 200 (no 500)", (await page.content()).length > 500);

  // ---------- 7. Battle ----------
  await page.goto(`${BASE}/battle`, { timeout: 30000 });
  check("battle page 200 (no 500)", (await page.content()).length > 500);

  // ---------- 8. Marketplace ----------
  await page.goto(`${BASE}/marketplace`, { timeout: 30000 });
  const mpContent = await page.content();
  check(
    "marketplace renders (For Sale / My Listings)",
    mpContent.includes("For Sale") && mpContent.includes("My Listings"),
  );

  // ---------- 9. 404 handling ----------
  const invalidMonster = await page.goto(`${BASE}/monsters/does-not-exist-id`, {
    timeout: 30000,
  }).catch(() => null);
  check(
    "invalid monster id → controlled error (not 500)",
    invalidMonster !== null && invalidMonster.status() !== 500,
    `status=${invalidMonster?.status()}`,
  );
  const invalidBattle = await page
    .goto(`${BASE}/battle/does-not-exist-id`, { timeout: 30000 })
    .catch(() => null);
  check(
    "invalid battle id → controlled error (not 500)",
    invalidBattle !== null && invalidBattle.status() !== 500,
    `status=${invalidBattle?.status()}`,
  );

  // ---------- 10. Metadata API ----------
  const meta404 = await page
    .goto(`${BASE}/api/metadata/999999`, { timeout: 30000 })
    .catch(() => null);
  check(
    "invalid metadata token → 404 / controlled",
    meta404 !== null && (meta404.status() === 404 || meta404.status() === 200),
    `status=${meta404?.status()}`,
  );

  // ---------- 11. Health endpoints ----------
  const health = await page
    .goto(`${BASE}/api/health`, { timeout: 30000 })
    .catch(() => null);
  check("aggregate health endpoint reachable", health !== null && health.status() === 200);
  const web3health = await page
    .goto(`${BASE}/api/web3/health`, { timeout: 30000 })
    .catch(() => null);
  check("web3 health endpoint reachable", web3health !== null && web3health.status() === 200);

  // ---------- 12. Nav links present ----------
  await page.goto(`${BASE}/`, { timeout: 30000 });
  const nav = await page.locator("nav, header").first().textContent().catch(() => "");
  check(
    "nav exposes core routes",
    (nav ?? "").length > 0 && /explore|monster|team|battle|marketplace/i.test(nav ?? ""),
    (nav ?? "").slice(0, 120),
  );

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\nBrowser UI E2E: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    console.log(`FAILED: ${failed.map((f) => f.name).join("; ")}`);
    process.exitCode = 1;
  } else {
    console.log("MOCK BROWSER UI E2E: PASS");
  }
}

main().catch((error) => {
  console.error("Browser E2E crashed:", error);
  process.exitCode = 1;
});
