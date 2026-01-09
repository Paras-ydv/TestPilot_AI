import { Page } from "playwright";
import { launchBrowser } from "./browser";
import { discoverActions } from "./discoverActions";
import { waitForPageStability } from "./waitForStability";
import { ActionContract, Observation, UIState } from "./types";

let page: Page | null = null;

// -------------------------------------
// Discover UI (Prompt-1)
// -------------------------------------
export async function discoverUI(url: string, headless: boolean = true): Promise<UIState> {
  try {
    if (!page) {
      page = await launchBrowser(headless);
      await page.goto(url, { waitUntil: "load", timeout: 30000 });
    }

    await waitForPageStability(page);

    // Check for modals and prioritize them
    const hasModal = await page.evaluate(() => {
      return document.querySelector('[role="dialog"], .modal, .popup, .overlay') !== null;
    });

    if (hasModal) {
      console.log('🔍 Modal detected - prioritizing modal elements');
    }

    const actions = await discoverActions(page);

    // Prioritize modal actions - put them first in available_actions
    const modalActions = actions.filter(a => a.isModal && a.viewportSafe);
    const nonModalActions = actions.filter(a => !a.isModal && a.viewportSafe);
    const prioritizedActions = [...modalActions, ...nonModalActions];

    if (modalActions.length > 0) {
      console.log(`🚨 Found ${modalActions.length} modal elements - prioritizing:`, modalActions.map(a => a.id));
    }

    return {
      state_id: crypto.randomUUID(),
      route: new URL(page.url()).pathname,
      title: await page.title(),
      available_actions: prioritizedActions.map(a => a.id),
      entities: {}
    };
  } catch (error) {
    console.error("❌ UI discovery failed:", error instanceof Error ? error.message : String(error));
    return {
      state_id: crypto.randomUUID(),
      route: "/error",
      title: "Error",
      available_actions: [],
      entities: {}
    };
  }
}

// -------------------------------------
// Execute Action (SINGLE SOURCE OF TRUTH)
// -------------------------------------
export async function executeAction(
  action: ActionContract
): Promise<Observation> {
  try {
    if (!page) throw new Error("Browser not initialized");
    if (!action?.action_id) throw new Error("Invalid action: missing action_id");

    const networkCalls: Observation["networkCalls"] = [];
    const consoleErrors: string[] = [];

    const onResponse = (res: any) => {
      try {
        networkCalls.push({
          method: res.request().method(),
          url: res.url(),
          status: res.status()
        });
      } catch (err) {
        console.warn("⚠️ Failed to capture network call:", err);
      }
    };

    const onConsole = (msg: any) => {
      try {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      } catch (err) {
        console.warn("⚠️ Failed to capture console message:", err);
      }
    };

    page.on("response", onResponse);
    page.on("console", onConsole);

    let skipped = false;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        // Re-discover elements on retry (modal might have appeared)
        if (retryCount > 0) {
          console.log(`🔄 Retry ${retryCount}: Re-discovering elements...`);
          await page.waitForTimeout(1000);
        }

        // Special Action: Backtracking
        if (action.action_id === "BROWSER_BACK") {
          console.log("🔙 Executing Browser Back...");
          try {
            await page.goBack({ waitUntil: 'load', timeout: 5000 });
            await waitForPageStability(page);
            console.log("✅ Back navigation successful");
            break;
          } catch (err) {
            console.warn("⚠️ Back navigation failed:", err);
            skipped = true;
            break;
          }
        }

        console.log(`🎯 Looking for element matching: ${action.action_id}`);

        // Try to find element using multiple strategies
        let target = null;

        // Strategy 1: Direct selector match
        const elements = await page.$$("button, a, input, textarea, select");

        for (const el of elements) {
          try {
            const tagName = await el.evaluate(e => e.tagName.toLowerCase());
            let identifier = "";

            if (tagName === "input" || tagName === "textarea" || tagName === "select") {
              const placeholder = await el.evaluate((e: any) => e.placeholder || e.name || "");
              identifier = `${tagName}_${placeholder.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
            } else {
              const text = await el.innerText();
              identifier = `${tagName}_${text?.toLowerCase().replace(/[^a-z0-9]+/g, "_") || ""}`;
            }

            if (action.action_id === identifier) {
              // Check if element is actually interactable
              const isInteractable = await el.evaluate(e => {
                const rect = e.getBoundingClientRect();
                const style = window.getComputedStyle(e);
                return rect.width > 0 && rect.height > 0 &&
                  style.visibility !== 'hidden' &&
                  style.display !== 'none' &&
                  style.opacity !== '0';
              });

              if (isInteractable) {
                console.log(`✅ Found interactable match: ${identifier}`);
                target = el;
                break;
              }
            }
          } catch (err) {
            continue;
          }
        }

        // Strategy 2: If no exact match, try partial text match for buttons
        if (!target && action.action_id.startsWith('button_')) {
          const buttonText = action.action_id.replace('button_', '').replace(/_/g, ' ');
          try {
            target = await page.locator(`button:has-text("${buttonText}")`).first();
            if (await target.count() === 0) {
              target = null;
            } else {
              console.log(`✅ Found button by text: ${buttonText}`);
            }
          } catch (err) {
            target = null;
          }
        }

        if (!target) {
          if (retryCount < maxRetries) {
            console.log(`❌ No element found for: ${action.action_id} - retrying...`);
            retryCount++;
            continue;
          } else {
            console.log(`❌ No element found for: ${action.action_id} after ${maxRetries} retries`);
            skipped = true;
            break;
          }
        }

        try {
          console.log(`🖱️ Clicking element: ${action.action_id}`);

          // For Playwright locators, use different methods
          if (target.click) {
            await target.click({ timeout: 5000, force: true });
          } else {
            // For ElementHandle objects
            await target.scrollIntoViewIfNeeded();

            // Cast target to ElementHandle to resolve the call signature ambiguity
            const elementHandle = target as unknown as import('playwright').ElementHandle<HTMLElement>;

            // Explicitly verify elementHandle before operations
            if (elementHandle) {
              const tagName = await elementHandle.evaluate((e) => e.tagName.toLowerCase());
              const inputType = await elementHandle.evaluate((e: any) => e.type || "");

              if (tagName === "input" || tagName === "textarea") {
                if (inputType === "checkbox" || inputType === "radio") {
                  await elementHandle.click({ timeout: 5000, force: true });
                } else {
                  await elementHandle.fill("test input", { timeout: 5000 });
                }
              } else if (tagName === "select") {
                const options = await elementHandle.evaluate((e: any) => Array.from(e.options).map((opt: any) => opt.value));
                if (options.length > 0) {
                  await elementHandle.selectOption(options[0], { timeout: 5000 });
                }
              } else {
                await elementHandle.click({ timeout: 5000, force: true });
              }
            }
          }

          console.log(`✅ Successfully interacted with: ${action.action_id}`);
          break; // Success - exit retry loop

        } catch (err) {
          const errorMsg = String(err);
          console.log(`❌ Failed to interact with: ${action.action_id} - ${errorMsg}`);

          // 🚨 CAPTURE MODAL BLOCKING ERRORS
          if (errorMsg.includes('subtree intercepts pointer events') ||
            errorMsg.includes('TimeoutError') ||
            errorMsg.includes('modal') ||
            errorMsg.includes('Element is not attached to the DOM')) {
            consoleErrors.push(`MODAL_BLOCKING: ${errorMsg}`);

            if (retryCount < maxRetries) {
              console.log(`🔄 Modal blocking detected - retrying...`);
              retryCount++;
              continue;
            }
          }

          skipped = true;
          break;
        }
      } catch (error) {
        console.error("❌ Action execution failed:", error instanceof Error ? error.message : String(error));
        if (retryCount < maxRetries) {
          retryCount++;
          continue;
        }
        skipped = true;
        break;
      }
    }

    await waitForPageStability(page);

    let screenshotPath = "";
    try {
      screenshotPath = `screenshots/${action.action_id}_${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });
    } catch (error) {
      console.warn("⚠️ Screenshot failed:", error instanceof Error ? error.message : String(error));
    }

    page.off("response", onResponse);
    page.off("console", onConsole);

    return {
      actionId: action.action_id,
      networkCalls,
      consoleErrors,
      screenshotPath,
      skipped
    };
  } catch (error) {
    console.error("❌ Execute action failed:", error instanceof Error ? error.message : String(error));
    return {
      actionId: action?.action_id || "unknown",
      networkCalls: [],
      consoleErrors: [],
      screenshotPath: "",
      skipped: true
    };
  }
}
