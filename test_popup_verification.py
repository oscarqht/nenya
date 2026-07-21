from playwright.sync_api import sync_playwright
import os

os.makedirs("/home/jules/verification/videos", exist_ok=True)
os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

def run_cuj(page, browser):
    page.goto(f"http://localhost:8000/src/popup/index.html")
    page.wait_for_timeout(1000)

    # Let's set the viewport size to simulate a side panel
    page.set_viewport_size({"width": 800, "height": 1000})
    page.wait_for_timeout(1000)

    page.screenshot(path="/home/jules/verification/screenshots/popup_sidepanel.png")

if __name__ == "__main__":
    import subprocess
    import time
    server = subprocess.Popen(["python3", "-m", "http.server", "8000"])
    time.sleep(1) # wait for server to start
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                record_video_dir="/home/jules/verification/videos"
            )
            page = context.new_page()
            try:
                run_cuj(page, browser)
            finally:
                context.close()
                browser.close()
    finally:
        server.terminate()
