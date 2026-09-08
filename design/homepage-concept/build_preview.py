"""Build the standalone homepage from its editable HTML fragment."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
head = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ajwad Rauf — Homepage concept</title>
<meta name="description" content="A portfolio concept for Ajwad Rauf: applied AI, creative technology and production systems.">
<meta name="robots" content="noindex,nofollow">
<link rel="stylesheet" href="styles.css">
<style>html{color-scheme:light;scroll-behavior:smooth}body{margin:0}</style>
</head><body>
'''
tail = '\n<script src="assets/wordmark.js"></script><script src="app.js"></script></body></html>\n'
(ROOT / 'index.html').write_text(
    head + (ROOT / 'page-fragment.html').read_text(encoding='utf-8') + tail,
    encoding='utf-8',
)
print('Built index.html')
