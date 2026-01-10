import { launchBrowser } from "./browser.js";
import { discoverActions } from "./discoverActions.js";
import { executeAction, discoverUI } from "./agentRuntime.js";
import { waitForPageStability } from "./waitForStability.js";
import { ActionContract } from "./types.js";

const URL = process.argv[2];

if (!URL) {
  console.error("Usage: node index.js <url>");
  process.exit(1);
}

(async () => {
  console.log("[Runtime] Starting manual discovery for:", URL);

  // 🔹 Boot browser
  const page = await launchBrowser();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await waitForPageStability(page);

  // 🔹 Initial scroll to reveal actions
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(1000);

  // 🔹 Discover actions
  const actions = await discoverActions(page);

  console.log(
    "\nDiscovered Actions:",
    actions.map(a => `${a.type} → ${a.label} (${a.viewportSafe ? "safe" : "offscreen"})`)
  );

  // 🔹 Execute each action once
  for (const action of actions) {
    const contract: ActionContract = {
      action_id: action.id,
      parameters: {}
    };

    try {
      const observation = await executeAction(contract);

      console.log("\n[Observation]");
      console.log(JSON.stringify(observation, null, 2));
    } catch (err: any) {
      console.log(
        JSON.stringify(
          {
            actionId: action.id,
            skipped: true,
            reason: err.message
          },
          null,
          2
        )
      );
    }
  }

  console.log("\n✅ Manual runtime test complete");
  process.exit(0);
})();
