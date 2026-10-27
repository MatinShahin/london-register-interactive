#!/usr/bin/env python3
"""Build index.html: one self-contained page that works offline.

Usage:  python3 build.py
Inputs: src/ (page, styles, scripts, fonts, images, vendor libraries) and data/.
Output: index.html in the repository root.
"""
import base64, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC, DATA = ROOT / "src", ROOT / "data"

def b64(path, mime):
    return f"data:{mime};base64," + base64.b64encode(Path(path).read_bytes()).decode()

def script(text):
    return "<script>\n" + text.replace("</script", "<\\/script") + "\n</script>\n"

# Styles, with the two typefaces embedded
css = (SRC / "brand.css").read_text(encoding="utf-8")
css = css.replace("__GEIST__", b64(SRC / "fonts/Geist-Variable.woff2", "font/woff2"))
css = css.replace("__MONO__", b64(SRC / "fonts/GeistMono-Variable.woff2", "font/woff2"))

# Page body: strip the external stylesheet and script references used in the dashboard build
body = (SRC / "page.html").read_text(encoding="utf-8")
body = body.replace('<link rel="stylesheet" href="brand.css">\n', "")
body = re.sub(r'<script src="[^"]+"></script>\n?', "", body)

# Images (portrait and report covers) and the world map
images = {"photo": b64(SRC / "img/matin-shahin.jpg", "image/jpeg")}
for key in ["ar_2026", "dnv_2026", "meth_2026", "ar_2025", "dnv_2025"]:
    images[key] = b64(SRC / f"img/cover_{key}.jpg", "image/jpeg")
world = json.loads((SRC / "vendor/countries-110m.json").read_text())
world["objects"] = {"countries": world["objects"]["countries"]}

data = {
    "register": (DATA / "london_register_2026.csv").read_text(encoding="utf-8"),
    "reports": json.loads((DATA / "register_reports.json").read_text(encoding="utf-8")),
}

host = """
:root{color-scheme:light;--color-bg:#ffffff;--color-panel:#ffffff;--color-border-line:#e3e8ee;--color-fg:#0b1b2b;--color-fg-muted:#5a6b7c}
html.dark{color-scheme:dark;--color-bg:#0d1520;--color-panel:#131e2b;--color-border-line:#223042;--color-fg:#e7edf4;--color-fg-muted:#97a6b5}
html,body{margin:0;background:var(--color-bg);color:var(--color-fg)}
body{padding:24px max(20px,env(safe-area-inset-right,0px)) 32px max(20px,env(safe-area-inset-left,0px))}
[hidden]{display:none!important}
"""

head = (
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    "<title>London Register of Subsurface CO₂ Storage · Interactive edition</title>\n"
    '<meta name="description" content="Interactive edition of The London Register of Subsurface CO2 Storage, redesigned and developed by Matin Shahin.">\n'
    '<meta name="author" content="Matin Shahin">\n'
    f'<link rel="icon" type="image/svg+xml" href="{b64(ROOT / "assets/logo/register-mark.svg", "image/svg+xml")}">\n'
    f"<style>{host}</style>\n<style>\n{css}\n</style>\n</head>\n<body>\n"
)

parts = [
    head, body, "\n",
    script((SRC / "vendor/d3.min.js").read_text(encoding="utf-8")),
    script("window.LR_DATA = " + json.dumps(data, ensure_ascii=False) + ";"),
    script((SRC / "shim.js").read_text(encoding="utf-8")),
    script("window.LR_IMG = " + json.dumps(images) + ";"),
    script("window.LR_WORLD = " + json.dumps(world, separators=(",", ":")) + ";"),
]
for name in ["calcs.js", "app.js", "quality.js", "standalone.js"]:
    parts.append(script((SRC / name).read_text(encoding="utf-8")))
parts.append("</body>\n</html>\n")

out = ROOT / "index.html"
out.write_text("".join(parts), encoding="utf-8")
print(f"Wrote {out.name} ({out.stat().st_size / 1024:.0f} KB)")
