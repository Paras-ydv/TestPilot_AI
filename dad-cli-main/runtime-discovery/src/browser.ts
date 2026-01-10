import { chromium, Browser, BrowserContext, Page } from "playwright";

export async function launchBrowser(headless: boolean = true): Promise<{ page: Page; browser: Browser; context: BrowserContext }> {
  console.log(`🌍 Launching browser (headless: ${headless})`);
  if (!headless) {
    console.log("👁️ Browser window should now be visible");
  }
  
  try {
    const browser = await chromium.launch({ 
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Add stability args
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    
    // Add error handling for page crashes
    page.on('crash', () => {
      console.error('❌ Page crashed');
    });
    
    page.on('close', () => {
      console.log('📝 Page closed');
    });
    
    return { page, browser, context };
  } catch (error) {
    console.error("❌ Browser launch failed:", error instanceof Error ? error.message : String(error));
    throw new Error("Failed to initialize browser");
  }
}
