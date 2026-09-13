import re

with open("landing/dex1.checkpoint-2026-09-03.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. Update .landing-nav CSS so it is ALWAYS visible and sticky throughout scrolling
old_nav_css = """.landing-nav {
      position: fixed;
      top: 0;
      left: 0;
      transform: none;
      width: 100%;
      z-index: 200;
      transition: background 0.35s var(--ease), border-color 0.35s var(--ease),
        backdrop-filter 0.35s var(--ease), box-shadow 0.35s var(--ease),
        opacity 0.28s var(--ease), transform 0.28s var(--ease);
      border-bottom: 1px solid rgba(191, 219, 254, 0.45);
      background: linear-gradient(120deg, rgba(8, 19, 28, 0.94), rgba(11, 114, 133, 0.88) 54%, rgba(17, 100, 102, 0.86));
      backdrop-filter: blur(10px);
      border-radius: 0;
      opacity: 0;
      transform: translateY(-110%);
      pointer-events: none;
    }"""

new_nav_css = """.landing-nav {
      position: fixed;
      top: 0;
      left: 0;
      transform: none;
      width: 100%;
      z-index: 200;
      border-bottom: 1px solid rgba(191, 219, 254, 0.35);
      background: rgba(8, 19, 28, 0.92);
      backdrop-filter: blur(14px);
      border-radius: 0;
      opacity: 1 !important;
      transform: translateY(0) !important;
      pointer-events: auto !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    .nav-reveal-btn {
      display: none !important;
    }"""

if old_nav_css in html:
    html = html.replace(old_nav_css, new_nav_css)
else:
    print("WARNING: old_nav_css not exact match, using regex")
    html = re.sub(r"\.landing-nav\s*\{[^}]*opacity:\s*0;[^}]*\}", new_nav_css, html)

# 2. Update Header HTML to have the brand on left and "Launch Radar / Monitor" on right
old_header = """<header class="landing-nav" id="landing-nav" aria-label="Primary">
    <div class="nav-inner">
      <ul class="nav-links">
        <li><a class="focus-visible" href="#how-it-works">Open console</a></li>
        <li><a class="focus-visible pill-cta" href="#destinations">Trace a signal</a></li>
      </ul>
    </div>
  </header>"""

new_header = """<header class="landing-nav" id="landing-nav" aria-label="Primary">
    <div class="nav-inner">
      <div style="display: flex; align-items: center; gap: 10px;">
        <a href="/" style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 1.15rem; color: #f8fafc; text-decoration: none; letter-spacing: -0.02em;">
          <span style="font-size: 1.3rem;">🔥</span> ThermoTrace <span style="color: #38bdf8; font-size: 0.9rem; font-weight: 700; background: rgba(56, 189, 248, 0.15); padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.3);">AI</span>
        </a>
      </div>
      <ul class="nav-links">
        <li><a class="focus-visible" href="#how-it-works">Overview</a></li>
        <li><a class="focus-visible" href="#destinations">Evidence</a></li>
        <li><a class="focus-visible pill-cta" href="/monitor" style="background: rgba(34, 197, 94, 0.15) !important; border: 1.5px solid #22c55e !important; color: #22c55e !important; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;">Launch Radar / Monitor &rarr;</a></li>
      </ul>
    </div>
  </header>"""

html = html.replace(old_header, new_header)

# 3. Update Hero action button to launch /monitor
old_hero_action = '<a class="btn-primary focus-visible" href="#how-it-works">Open live console</a>'
new_hero_action = '<a class="btn-primary focus-visible" href="/monitor" style="background: #f97316; border-color: #ea580c; font-weight: 800; display: inline-flex; align-items: center; gap: 8px;">Launch Live Thermal Radar &rarr;</a>'
html = html.replace(old_hero_action, new_hero_action)

# 4. Add Post-Scroll Action button in footer
old_footer_links = """      <nav class="footer-links" aria-label="Footer links">
        <a href="#destinations">The pipeline</a>
        <a href="#how-it-works">How it works</a>
        <a href="#how-it-works">Live events</a>
        <a href="#how-it-works">Sign in</a>
      </nav>"""

new_footer_links = """      <nav class="footer-links" aria-label="Footer links">
        <a href="/monitor" style="font-weight: 800; color: #22c55e;">Launch Monitor &rarr;</a>
        <a href="#destinations">The pipeline</a>
        <a href="#how-it-works">How it works</a>
        <a href="#how-it-works">Live events</a>
      </nav>"""
html = html.replace(old_footer_links, new_footer_links)

# Ensure all image paths start with /assets/ for absolute robustness in Next.js
html = html.replace('src="assets/', 'src="/assets/')
html = html.replace("url('assets/", "url('/assets/")
html = html.replace('url("assets/', 'url("/assets/')

# Write outputs
with open("frontend/public/landing.html", "w", encoding="utf-8") as f:
    f.write(html)

with open("landing/index.html", "w", encoding="utf-8") as f:
    f.write(html)

print("Successfully updated landing.html in frontend/public/ and landing/index.html")
