/**
 * Pixel World runtime E2E — verifies the Phaser canvas actually boots,
 * the player can move with WASD and the world HUD renders.
 * Run: npx tsx scripts/world-runtime-e2e.ts [baseUrl]
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3081";

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const results: { name: string; pass: boolean; detail?: string }[] = [];
  const check = (name: string, pass: boolean, detail?: string) => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  };

  const getWorldState = () =>
    page.evaluate(async () => {
      const response = await fetch("/api/world/state");
      return response.json();
    });

  const setServerPositionAndReload = async (x: number, y: number) => {
    const result = await page.evaluate(async ({ x, y }) => {
      const response = await fetch("/api/world/position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y }),
      });
      return { ok: response.ok, body: await response.json() };
    }, { x, y });
    if (!result.ok) throw new Error(`Could not set local test position: ${JSON.stringify(result.body)}`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("canvas").first().waitFor({ timeout: 60000 });
    await page.locator("canvas").first().click({ force: true });
    await page.waitForTimeout(500); // let WorldScene resolve nearby interactables
  };

  const pressInteract = async () => {
    await page.keyboard.down("KeyE");
    await page.waitForTimeout(100);
    await page.keyboard.up("KeyE");
  };

  const runEncounterAt = async (spawn: { spawnId: string; x: number; y: number }) => {
    await setServerPositionAndReload(spawn.x, spawn.y);
    const encounterResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/world/encounter") && response.request().method() === "POST",
      { timeout: 15000 },
    );
    await pressInteract();
    const encounterResponse = await encounterResponsePromise.catch(() => null);
    const throwButton = page.getByRole("button", { name: "Throw Capsule" });
    const captureOverlayVisible = Boolean(encounterResponse) && await throwButton.isVisible({ timeout: 8000 }).catch(() => false);
    if (!captureOverlayVisible) return false;

    const runResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/world/run") && response.request().method() === "POST",
      { timeout: 8000 },
    );
    await page.getByRole("button", { name: "Run" }).click();
    const runResponse = await runResponsePromise.catch(() => null);
    const runResult = runResponse ? await runResponse.json() as { ok?: boolean } : null;
    return Boolean(runResult?.ok);
  };

  await page.goto(`${BASE}/world`, { timeout: 60000, waitUntil: "domcontentloaded" });
  await page.locator("canvas").first().waitFor({ timeout: 60000 }); // Phaser boot
  await setServerPositionAndReload(30, 24); // predictable open camp tile for movement verification

  // 1. Phaser canvas exists
  const canvasCount = await page.locator("canvas").count();
  check("Phaser canvas mounted", canvasCount >= 1, `canvasCount=${canvasCount}`);

  // 2. HUD renders
  const hud = await page.locator("text=Monad Testnet").first().isVisible().catch(() => false);
  check("HUD shows Monad Testnet badge", hud);
  const wasd = await page.locator("text=WASD").first().isVisible().catch(() => false);
  check("HUD shows WASD controls", wasd);

  // 3. Move with WASD (Phaser owns movement; we verify key events don't crash
  //    and the position-save API fires)
  const initialState = await getWorldState();
  const beforePos = {
    x: initialState.trainer.worldX,
    y: initialState.trainer.worldY,
  };
  // Focus the Phaser canvas first (keyboard events need focus in headless).
  await page.locator("canvas").first().click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(300);
  // Hold D (right) long enough to cross several tiles in one direction.
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(1500);
  await page.keyboard.up("KeyD");
  await page.waitForTimeout(5000); // position save throttle (4s)
  const movedState = await getWorldState();
  const afterPos = {
    x: movedState.trainer.worldX,
    y: movedState.trainer.worldY,
  };
  check(
    "position save API fired after movement",
    beforePos.x !== afterPos.x || beforePos.y !== afterPos.y,
    `before=(${beforePos.x},${beforePos.y}) after=(${afterPos.x},${afterPos.y})`,
  );

  // 4. World state has visible spawns
  const state = await getWorldState();
  check(
    "world state exposes ≥6 wild spawns across zones",
    (state.spawns?.length ?? 0) >= 6,
    `spawns=${state.spawns?.length}`,
  );
  const zones = new Set((state.spawns ?? []).map((s: { zoneId: string }) => s.zoneId));
  check("spawns cover ≥3 distinct zones", zones.size >= 3, `zones=${[...zones].join(",")}`);

  // 5. Daily Supply is a real HUD action. If this local trainer already
  // claimed today, verify the server-backed claimed state instead.
  const dailyButton = page.getByRole("button", { name: /Daily Supply/ });
  const dailyVisible = await dailyButton.isVisible().catch(() => false);
  let dailyPass = dailyVisible;
  let dailyDetail = "button missing";
  if (dailyVisible) {
    const beforeDaily = await getWorldState();
    if (beforeDaily.dailySupply.ready) {
      await dailyButton.click();
      await page.getByRole("button", { name: /Daily Supply claimed/ }).waitFor({ timeout: 8000 });
      const afterDaily = await getWorldState();
      dailyPass = !afterDaily.dailySupply.ready;
      dailyDetail = "claim completed and server state refreshed";
    } else {
      dailyDetail = "server-backed claimed/cooldown state visible";
    }
  }
  check("Daily Supply UI and server result", dailyPass, dailyDetail);

  // 6. Pick up a visible server-provided node through actual Phaser E input.
  const pickup = state.pickups?.find(
    (item: { pickupKey: string; available: boolean }) => item.pickupKey === "volcano-spark-1" && item.available,
  ) ?? state.pickups?.find((item: { available: boolean }) => item.available);
  let pickupPass = false;
  let pickupDetail = "no available pickup";
  if (pickup) {
    // Wild monsters take interaction priority. Clear nearby encounters using
    // the real Capture overlay's Run action before collecting the node.
    let pickupClear = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const current = await getWorldState();
      const nearbySpawns = (current.spawns ?? []).filter(
        (spawn: { x: number; y: number }) => Math.hypot(spawn.x - pickup.x, spawn.y - pickup.y) < 4,
      );
      if (nearbySpawns.length === 0) {
        pickupClear = true;
        break;
      }
      const cleared = await runEncounterAt(nearbySpawns[0]);
      if (!cleared) break;
    }
    if (!pickupClear) {
      pickupDetail = `${pickup.pickupKey}: nearby wild monsters could not be cleared`;
      check("Pickup interaction and server refresh", false, pickupDetail);
    } else {
    await setServerPositionAndReload(pickup.x, pickup.y);
    const pickupResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/world/pickup") && response.request().method() === "POST",
      { timeout: 8000 },
    );
    await pressInteract();
    const pickupResponse = await pickupResponsePromise.catch(() => null);
    const pickupResult = pickupResponse ? await pickupResponse.json() as { ok?: boolean; error?: string } : null;
    await page.waitForTimeout(800);
    const afterPickup = await getWorldState();
    const picked = afterPickup.pickups?.find((item: { pickupKey: string }) => item.pickupKey === pickup.pickupKey);
    pickupPass = Boolean(pickupResult?.ok && picked && !picked.available);
    pickupDetail = pickupResult?.ok
      ? `${pickup.pickupKey}: cooldown active`
      : `${pickup.pickupKey}: ${pickupResult?.error ?? "request was not sent"}`;
      check("Pickup interaction and server refresh", pickupPass, pickupDetail);
    }
  } else {
    check("Pickup interaction and server refresh", pickupPass, pickupDetail);
  }

  // 7. Walk into the blocked merchant NPC, then interact from its adjacent tile.
  // Shop NPC is at (29, 22); (28, 22) is the adjacent camp floor tile.
  await setServerPositionAndReload(28, 22);
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(1000);
  await page.keyboard.up("KeyD");
  await page.waitForTimeout(4500);
  const afterCollision = await getWorldState();
  const collisionPass = afterCollision.trainer.worldX === 28 && afterCollision.trainer.worldY === 22;
  check("Merchant NPC collision blocks movement", collisionPass, `position=(${afterCollision.trainer.worldX},${afterCollision.trainer.worldY})`);

  await pressInteract();
  const shopTitle = page.getByRole("heading", { name: "Ball Merchant" });
  const shopVisible = await shopTitle.isVisible({ timeout: 5000 }).catch(() => false);
  check("Shop opens through Phaser interaction", shopVisible);
  if (shopVisible) {
    const beforeShop = await getWorldState();
    const buyBasic = page.getByRole("button", { name: "×1 (25g)" }).first();
    if (beforeShop.trainer.gold >= 25) {
      await buyBasic.click();
      await page.getByText(/Bought 1× Basic Capsule/).waitFor({ timeout: 8000 });
      const afterShop = await getWorldState();
      check("Shop purchase updates server state", afterShop.trainer.gold === beforeShop.trainer.gold - 25);
    } else {
      check("Shop purchase updates server state", false, `insufficient local test gold=${beforeShop.trainer.gold}`);
    }
    await page.getByRole("button", { name: "Close" }).click();
  }

  // 8. Guide opens through normal interaction and exposes the Daily Supply entry.
  // Guide NPC is at (34, 22); (33, 22) is adjacent.
  await setServerPositionAndReload(33, 22);
  await pressInteract();
  const guideText = page.getByText(/Daily Supply box is here at camp/);
  const guideVisible = await guideText.isVisible({ timeout: 5000 }).catch(() => false);
  check("Guide interaction exposes Daily Supply help", guideVisible);
  if (guideVisible) await page.getByRole("button", { name: "Got it" }).click();

  // 9. Start a server-backed wild encounter through Phaser, verify the capture
  // overlay, and use Run to return to the world without throwing a capsule.
  const encounterState = await getWorldState();
  const spawn = encounterState.spawns?.[0];
  let encounterPass = false;
  let encounterDetail = "no server spawn";
  if (spawn) {
    encounterPass = await runEncounterAt(spawn);
    encounterDetail = encounterPass ? `${spawn.spawnId}: capture overlay opened and Run persisted` : "Encounter or Run did not complete";
  }
  check("Encounter and capture overlay", encounterPass, encounterDetail);

  // 10. Screenshot for the record
  await page.screenshot({ path: "scripts/world-runtime.png" });
  console.log("screenshot saved: scripts/world-runtime.png");

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\nWorld runtime E2E: ${results.length - failed.length}/${results.length} passed`);
  process.exitCode = failed.length > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error("World runtime E2E crashed:", e);
  process.exitCode = 1;
});
