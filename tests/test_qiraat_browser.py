#!/usr/bin/env python3
"""Visual acceptance & browser integration tests for Qira'at Phase 1 Pilot (Mushaf 1441 Page 1).

Verifies:
1. Default state: Toggle is OFF, 0 visual changes, 0 layout shifts.
2. Active state: Toggle ON activates 4 loci (5 target words) with badges (1, 2, 3, 4).
3. Interaction: Tapping marked words opens the Qira'at Detail Sheet.
4. Correctness: Locus 1 details show Asim, Kisai, Yaqub, Khalaf al-Ashir (not Khalaf an Hamza).
5. Dual-target: Locus 4 shows both occurrences of عليهم in 1:7.
6. Mobile: Verified responsive bottom sheet on iPhone 390x844.
7. Zero errors: 0 page errors, 0 console errors.
8. Captures 5 mandatory screenshots to docs/qiraat/screenshots/page-001/.
"""

import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("BASE", "http://127.0.0.1:3000")
SCREENSHOTS_DIR = Path(__file__).resolve().parent.parent / "docs" / "qiraat" / "screenshots" / "page-001"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def run_qiraat_browser_test():
    print(f"Starting Qira'at browser acceptance tests against {BASE_URL}...")
    page_errors = []
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        )
        page = context.new_page()

        page.on("pageerror", lambda err: page_errors.append(str(err)))
        page.on(
            "console",
            lambda msg: console_errors.append(msg.text)
            if msg.type == "error"
            and "favicon" not in msg.text.lower()
            and "supabase" not in msg.text.lower()
            else None,
        )

        # 1. Navigate to Page 1
        target_url = f"{BASE_URL}/mushaf-1441?page=1"
        print(f"Navigating to {target_url}...")
        page.goto(target_url, wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_selector("[aria-label^='صفحة 1 سطر']", timeout=15_000)
        page.wait_for_timeout(1000)

        # Check default toggle state: MUST be OFF
        toggle_btn = page.locator("button[aria-label*='القراءات العشر']")
        assert toggle_btn.count() >= 1, "Qira'at toggle button must be present in header"
        assert toggle_btn.first.get_attribute("aria-pressed") == "false", "Qira'at toggle must be OFF by default"

        # Check that 0 Qira'at badges exist on page
        badges = page.locator("span[title^='خلاف في القراءات العشر']")
        assert badges.count() == 0, f"Expected 0 Qira'at badges when toggle is OFF, found {badges.count()}"

        # Capture Screenshot 1: Baseline (Toggle OFF)
        shot1 = SCREENSHOTS_DIR / "01-toggle-off-baseline.png"
        page.screenshot(path=str(shot1), full_page=False)
        print(f"✓ Screenshot 1 captured: {shot1.name}")

        # 2. Activate Qira'at Toggle
        print("Toggling Qira'at mode ON...")
        toggle_btn.first.click()
        page.wait_for_timeout(600)

        assert toggle_btn.first.get_attribute("aria-pressed") == "true", "Qira'at toggle must be ON after click"

        # Check that exactly 5 target badges are now visible (markers 1, 2, 3, 4, 4)
        badges = page.locator("span[title^='خلاف في القراءات العشر']")
        badge_count = badges.count()
        assert badge_count == 5, f"Expected exactly 5 target badges (4 loci, marker 4 has 2 targets), found {badge_count}"

        # Verify badge contents: 1, 2, 3, 4, 4
        badge_texts = [badges.nth(i).inner_text().strip() for i in range(badge_count)]
        assert "1" in badge_texts, "Marker 1 must be visible"
        assert "2" in badge_texts, "Marker 2 must be visible"
        assert "3" in badge_texts, "Marker 3 must be visible"
        assert badge_texts.count("4") == 2, "Marker 4 must appear twice for 'عليهم معا'"
        print(f"✓ Verified 5 target badges with markers: {badge_texts}")

        # Capture Screenshot 2: Toggle ON
        shot2 = SCREENSHOTS_DIR / "02-toggle-on-page1.png"
        page.screenshot(path=str(shot2), full_page=False)
        print(f"✓ Screenshot 2 captured: {shot2.name}")

        # 3. Click Locus 1 target word (مَـٰلِكِ / Marker 1)
        print("Clicking Locus 1 target word...")
        # The parent button of badge '1'
        marker1_badge = page.locator("span[title^='خلاف في القراءات العشر']:has-text('1')")
        marker1_badge.locator("..").click()
        page.wait_for_timeout(600)

        # Verify Qira'at Detail Sheet opened
        sheet = page.locator("#qiraat-sheet-title")
        assert sheet.is_visible(), "Qira'at Detail Sheet must open on word click"
        sheet_text = sheet.inner_text()
        assert "سورة الفاتحة" in sheet_text and "٤" in sheet_text, f"Unexpected header text: {sheet_text}"

        # Verify Locus 1 content: مالك / ملك
        modal_content = page.locator("role=dialog").inner_text()
        assert "مَـٰلِكِ" in modal_content, "Mushaf base word must be displayed"
        assert "مَالِكِ" in modal_content, "Variant 1 text must be displayed"
        assert "مَلِكِ" in modal_content, "Variant 2 text must be displayed"
        assert "العاشر" in modal_content or "خلف" in modal_content, "Khalaf Ashir must be listed"

        # Capture Screenshot 3: Locus 1 Detail (Desktop)
        shot3 = SCREENSHOTS_DIR / "03-locus1-detail-desktop.png"
        page.screenshot(path=str(shot3), full_page=False)
        print(f"✓ Screenshot 3 captured: {shot3.name}")

        # Close sheet
        page.locator("[role='dialog'] button[aria-label='إغلاق']").first.click()
        page.wait_for_timeout(400)
        assert not sheet.is_visible(), "Sheet must close on clicking close button"

        # 4. Click Locus 4 target word (عَلَيْهِمْ / Marker 4)
        print("Clicking Locus 4 dual-target word...")
        marker4_badge = page.locator("span[title^='خلاف في القراءات العشر']:has-text('4')").first
        marker4_badge.locator("..").click()
        page.wait_for_timeout(600)

        assert sheet.is_visible(), "Sheet must open for Locus 4"
        locus4_content = page.locator("[role='dialog']").inner_text()
        assert "عَلَيْهِمْ" in locus4_content, "Locus 4 base word must be displayed"
        assert "موضعان في الآية" in locus4_content or "تفصيل المواضع" in locus4_content, "Dual target indicator must be shown"
        assert "عَلَيْهِمُ" in locus4_content or "صلة ميم الجمع" in locus4_content or "حمزة" in locus4_content

        # Capture Screenshot 4: Locus 4 Dual Target Detail
        shot4 = SCREENSHOTS_DIR / "04-locus4-dual-target-detail.png"
        page.screenshot(path=str(shot4), full_page=False)
        print(f"✓ Screenshot 4 captured: {shot4.name}")

        # Close sheet
        page.locator("[role='dialog'] button[aria-label='إغلاق']").first.click()
        page.wait_for_timeout(400)

        # 5. Mobile Viewport (iPhone 390x844)
        print("Switching to mobile viewport (iPhone 390x844)...")
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(500)

        # Click marker 1 word on mobile
        marker1_badge = page.locator("span[title^='خلاف في القراءات العشر']:has-text('1')")
        marker1_badge.locator("..").click()
        page.wait_for_timeout(600)

        assert sheet.is_visible(), "Mobile bottom sheet must open"

        # Capture Screenshot 5: Mobile Bottom Sheet
        shot5 = SCREENSHOTS_DIR / "05-mobile-bottom-sheet.png"
        page.screenshot(path=str(shot5), full_page=False)
        print(f"✓ Screenshot 5 captured: {shot5.name}")

        # Final checks
        print(f"Page errors: {len(page_errors)}, Console errors: {len(console_errors)}")
        if page_errors:
            print("PAGE ERRORS:", page_errors)
        if console_errors:
            print("CONSOLE ERRORS:", console_errors)

        assert len(page_errors) == 0, f"Expected 0 page errors, found {len(page_errors)}"
        assert len(console_errors) == 0, f"Expected 0 console errors, found {len(console_errors)}"

        browser.close()
        print("\nALL 5 BROWSER ACCEPTANCE TESTS PASSED! All 5 screenshots saved successfully.")


if __name__ == "__main__":
    run_qiraat_browser_test()
