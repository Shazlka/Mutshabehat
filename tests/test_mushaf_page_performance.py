"""Browser regressions for instant Mushaf page navigation.

Run against a production build started on port 3222 by default, or set BASE to
exercise another deployment.
"""

from __future__ import annotations

import os
from urllib.parse import urljoin

from playwright.sync_api import Page, sync_playwright


BASE = os.environ.get("BASE", "http://127.0.0.1:3222")


def _open_mushaf(page: Page, page_number: int = 106) -> None:
    page.goto(
        urljoin(BASE, f"/mushaf-1441?page={page_number}"),
        wait_until="domcontentloaded",
        timeout=60_000,
    )
    page.wait_for_selector(f"[aria-label^='صفحة {page_number} سطر']", timeout=30_000)


def _jump_with_quick_slider(page: Page, page_number: int) -> None:
    page.evaluate(
        """(targetPage) => {
          window.__mushafPerfStart = performance.now()
          window.__mushafPerfReady = null
          const selector = `[aria-label^='صفحة ${targetPage} سطر'] [data-role='line-words']`
          const recordReady = () => {
            if (document.querySelector(selector) && window.__mushafPerfReady === null) {
              window.__mushafPerfReady = performance.now()
              return true
            }
            return false
          }
          const observer = new MutationObserver(() => {
            if (recordReady()) observer.disconnect()
          })
          observer.observe(document.body, { childList: true, subtree: true })

          const slider = document.querySelector('[aria-label="انتقال سريع للصفحة"]')
          slider.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
          const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
          valueSetter.call(slider, String(targetPage))
          slider.dispatchEvent(new Event('input', { bubbles: true }))
          slider.dispatchEvent(new Event('change', { bubbles: true }))
          setTimeout(() => slider.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })), 0)
        }""",
        page_number,
    )


def test_page_words_render_while_qcf_font_is_unavailable() -> None:
    """Removing the Unicode fallback would leave the next page skeleton visible."""
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            reduced_motion="reduce",
        )
        page = context.new_page()
        page.route("**/fonts/quran/hafs/v2/woff2/p300.woff2", lambda route: route.abort())
        _open_mushaf(page)

        _jump_with_quick_slider(page, 300)
        page.wait_for_selector(
            "[aria-label^='صفحة 300 سطر'] [data-role='line-words']",
            state="visible",
            timeout=400,
        )
        elapsed_ms = page.evaluate("window.__mushafPerfReady - window.__mushafPerfStart")
        data_to_render_ms = page.evaluate(
            """() => {
              const resource = performance.getEntriesByType('resource').find((entry) =>
                entry.name.includes('/api/mushaf-1441/page-words?page=300')
              )
              return resource ? window.__mushafPerfReady - resource.responseEnd : null
            }"""
        )

        assert elapsed_ms < 400, f"readable page took {elapsed_ms:.1f} ms"
        assert data_to_render_ms is not None
        assert data_to_render_ms < 50, f"page data took {data_to_render_ms:.1f} ms to render"
        assert page.locator("[aria-label^='صفحة 300 سطر'] [data-role='line-words']").first.inner_text().strip()
        assert not page.evaluate(
            """() => [...document.fonts].some((font) =>
              font.family.replaceAll('"', '') === 'QCFV2-P300' && font.status === 'loaded'
            )"""
        )

        context.close()
        browser.close()


def test_neighbor_prefetch_deduplicates_inflight_requests() -> None:
    """Removing bundled metadata or request sharing would refetch the neighbor."""
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            reduced_motion="reduce",
        )
        page = context.new_page()
        requested_urls: list[str] = []
        page.on("request", lambda request: requested_urls.append(request.url))
        _open_mushaf(page)
        page.wait_for_timeout(1_500)

        page_words_107 = [
            url for url in requested_urls if "/api/mushaf-1441/page-words?page=107" in url
        ]
        page_metadata_107 = [
            url for url in requested_urls if "/api/mushaf-1441/page-metadata?page=107" in url
        ]

        assert len(page_words_107) == 1, page_words_107
        assert len(page_metadata_107) == 0, page_metadata_107

        context.close()
        browser.close()


def test_initial_qcf_font_is_preloaded_before_hydration() -> None:
    """Removing the resource hint would start the exact page font after hydration."""
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()
        page.goto(
            urljoin(BASE, "/mushaf-1441?page=106"),
            wait_until="domcontentloaded",
            timeout=60_000,
        )
        page.wait_for_function(
            """() => performance.getEntriesByType('resource').some((entry) =>
              entry.name.endsWith('/fonts/quran/hafs/v2/woff2/p106.woff2')
            )""",
            timeout=30_000,
        )
        timing = page.evaluate(
            """() => {
              const navigation = performance.getEntriesByType('navigation')[0]
              const font = performance.getEntriesByType('resource').find((entry) =>
                entry.name.endsWith('/fonts/quran/hafs/v2/woff2/p106.woff2')
              )
              return { fontStart: font.startTime, domContentLoaded: navigation.domContentLoadedEventEnd }
            }"""
        )

        assert timing["fontStart"] < timing["domContentLoaded"], timing

        context.close()
        browser.close()


def test_reader_does_not_prefetch_the_database_home_route() -> None:
    """Restoring automatic home-link prefetch would compete with Mushaf resources."""
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()
        requested_urls: list[str] = []
        page.on("request", lambda request: requested_urls.append(request.url))
        _open_mushaf(page)
        page.wait_for_timeout(750)

        home_prefetches = [
            url for url in requested_urls if "/?_rsc=" in url
        ]
        assert not home_prefetches, home_prefetches

        context.close()
        browser.close()
