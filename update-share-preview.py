"""Copy the tab icon and link-preview settings from config.json into index.html.

Messenger, Instagram, Facebook, Viber and other apps build a link preview by reading the
<head> of index.html directly; they don't run the page's JavaScript. So these settings have
to be written into the HTML itself. Run this after changing "site" in config.json:

    python update-share-preview.py

Only the block between the "share-preview:start" and "share-preview:end" markers is replaced.
"""
import hashlib
import html
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / 'config.json'
INDEX = ROOT / 'index.html'
START = '<!-- share-preview:start'
END = '<!-- share-preview:end -->'


def image_size(path):
    """Width and height of a PNG, JPEG or WebP file, without needing extra packages."""
    data = path.read_bytes()
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', data[16:24])
    if data[:2] == b'\xff\xd8':
        i = 2
        while i < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                h, w = struct.unpack('>HH', data[i + 5:i + 9])
                return w, h
            i += 2 + struct.unpack('>H', data[i + 2:i + 4])[0]
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        if data[12:16] == b'VP8X':
            return 1 + int.from_bytes(data[24:27], 'little'), 1 + int.from_bytes(data[27:30], 'little')
        if data[12:16] == b'VP8 ':
            w, h = struct.unpack('<HH', data[26:30])
            return w & 0x3FFF, h & 0x3FFF
    return None


def mime(path):
    return {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'}.get(path.suffix.lower(), 'image/jpeg')


def main():
    # the Windows console can't print emoji by default; never crash over the summary text
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    config = json.loads(CONFIG.read_text(encoding='utf-8'))
    site = config['site']
    share = site.get('share', {})
    colors = config.get('theme', {}).get('colors', {})
    esc = lambda value: html.escape(str(value), quote=True)
    warnings = []

    base = site.get('url', '').strip().rstrip('/')
    if not base.startswith(('http://', 'https://')):
        warnings.append('site.url is missing or does not start with https:// - Messenger/Facebook will not show the preview picture.')
    absolute = lambda path: f'{base}/{path.lstrip("/")}' if base else path

    title = share.get('title') or site['title']
    description = share.get('description') or site.get('description', '')

    lines = [
        f'<title>{esc(site["title"])}</title>',
        f'<meta name="description" content="{esc(site.get("description", ""))}">',
        f'<meta name="theme-color" content="{esc(colors.get("rust", "#ae4a2f"))}">',
    ]
    for key, rel in (('tabIcon', 'icon'), ('appleTouchIcon', 'apple-touch-icon')):
        if site.get(key):
            icon = ROOT / site[key]
            if not icon.exists():
                warnings.append(f'site.{key} file not found: {site[key]}')
            kind = f' type="{mime(icon)}"' if rel == 'icon' else ''
            lines.append(f'<link rel="{rel}"{kind} href="{esc(site[key])}">')
    if base:
        lines.append(f'<link rel="canonical" href="{esc(base)}/">')

    lines += [
        '<meta property="og:type" content="website">',
        f'<meta property="og:site_name" content="{esc(share.get("siteName", site["title"]))}">',
        f'<meta property="og:title" content="{esc(title)}">',
        f'<meta property="og:description" content="{esc(description)}">',
    ]
    if base:
        lines.append(f'<meta property="og:url" content="{esc(base)}/">')

    if share.get('image'):
        image = ROOT / share['image']
        url = absolute(share['image'])
        if image.exists():
            # a version stamp makes apps fetch the new picture when it changes
            url += '?v=' + hashlib.md5(image.read_bytes()).hexdigest()[:8]
            size = image_size(image)
            lines.append(f'<meta property="og:image" content="{esc(url)}">')
            lines.append(f'<meta property="og:image:type" content="{mime(image)}">')
            if size:
                lines.append(f'<meta property="og:image:width" content="{size[0]}">')
                lines.append(f'<meta property="og:image:height" content="{size[1]}">')
                if size[0] < 600 or size[1] < 315:
                    warnings.append(f'share image is only {size[0]}x{size[1]}; 1200x630 looks best.')
            if image.stat().st_size > 1_000_000:
                warnings.append('share image is over 1 MB; some apps skip large images.')
        else:
            warnings.append(f'share.image file not found: {share["image"]}')
            lines.append(f'<meta property="og:image" content="{esc(url)}">')
        if share.get('imageAlt'):
            lines.append(f'<meta property="og:image:alt" content="{esc(share["imageAlt"])}">')

    lines += [
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{esc(title)}">',
        f'<meta name="twitter:description" content="{esc(description)}">',
    ]
    if share.get('image'):
        lines.append(f'<meta name="twitter:image" content="{esc(url)}">')

    block = ('<!-- share-preview:start · written by update-share-preview.py from config.json; edit config.json, not this block -->\n'
             + ''.join(f'  {line}\n' for line in lines) + '  ' + END)

    page = INDEX.read_text(encoding='utf-8')
    start, end = page.find(START), page.find(END)
    if start == -1 or end == -1:
        sys.exit('Could not find the share-preview markers in index.html.')
    page = page[:start] + block + page[end + len(END):]
    INDEX.write_text(page, encoding='utf-8')

    print('index.html updated:')
    print(f'  tab title    {site["title"]}')
    print(f'  tab icon     {site.get("tabIcon", "-")}')
    print(f'  preview      {title}')
    print(f'               {description}')
    print(f'  image        {url if share.get("image") else "-"}')
    for w in warnings:
        print('  WARNING:', w)
    print('\nAfter uploading, refresh the preview Facebook/Messenger has cached:'
          '\n  https://developers.facebook.com/tools/debug/  (paste your link, click "Scrape Again")')


if __name__ == '__main__':
    main()
