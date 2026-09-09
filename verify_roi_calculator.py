from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto("http://localhost:5173", wait_until="networkidle")
        page.evaluate("localStorage.setItem('money_plug_onboarding_completed', 'true')")
        page.reload(wait_until="networkidle")

        # Navigate to pricing page if navigation button exists or direct route click
        # Look for element containing "Pricing" or click pricing in header
        pricing_btn = page.locator("button:has-text('Pricing'), a:has-text('Pricing')").first
        if pricing_btn.is_visible():
            pricing_btn.click()
            page.wait_for_timeout(1000)

        # Scroll to Creator ROI Calculator
        roi_section = page.locator("text=Creator ROI & Revenue Calculator")
        roi_section.scroll_into_view_if_needed()
        page.wait_for_timeout(500)

        page.screenshot(path="/home/jules/verification/roi_calculator.png", full_page=False)
        browser.close()

if __name__ == "__main__":
    verify()
