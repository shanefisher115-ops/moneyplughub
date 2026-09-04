import { chromium } from 'playwright';

async function verify() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Set localStorage to bypass onboarding
  await page.goto('http://localhost:3001');
  await page.evaluate(() => {
    localStorage.setItem('moneyplug_onboarding_done', 'true');
  });

  // Now navigate to syndicates
  await page.goto('http://localhost:3001/syndicates');
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: '/home/jules/verification/syndicates_page.png', fullPage: true });

  await browser.close();
  console.log('Verification screenshot taken');
}

verify().catch(console.error);
