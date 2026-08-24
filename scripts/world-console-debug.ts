/**
 * Debug helper — loads /world and dumps browser console errors.
 * Run: npx tsx scripts/world-console-debug.ts [baseUrl]
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3081";

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      console.log(`[console:${msg.type()}] ${msg.text().slice(0, 400)}`);
    }
  });
  page.on("pageerror", (err) => console.log(`[pageerror] ${err.message.slice(0, 500)}`));
  await page.goto(`${BASE}/world`, { timeout: 60000 });
  await page.waitForTimeout(5000);
  await browser.close();
}

main().catch((e) => {
  console.error("debug crashed:", e);
  process.exitCode = 1;
});
