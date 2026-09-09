from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:3000/sigil-forge')
    page.evaluate("() => localStorage.setItem('moneyplug_onboarding_done', 'true')")
    page.goto('http://localhost:3000/sigil-forge')
    time.sleep(2)
    page.mouse.click(500, 500)
    time.sleep(3)
    page.screenshot(path='/home/jules/verification/sigil_forge_3d.png', full_page=True)
    browser.close()
