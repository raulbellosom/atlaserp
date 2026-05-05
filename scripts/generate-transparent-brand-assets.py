from PIL import Image
from pathlib import Path
from collections import deque

ROOT = Path(__file__).resolve().parents[1]
IDENTITY = ROOT / 'identity'
OUT_DIR = ROOT / 'apps' / 'desktop' / 'public' / 'brand'
OUT_DIR.mkdir(parents=True, exist_ok=True)

MAPPING = {
    'atlas-erp_primary_logo.png': 'atlas-logo-primary.png',
    'atlas-erp_horizontal_logo.png': 'atlas-logo-horizontal.png',
    'atlas-erp_vertical_logo.png': 'atlas-logo-vertical.png',
    'atlas-erp_isotype_only.png': 'atlas-logo-isotype.png',
    'atlas-erp_monochrome_light.png': 'atlas-logo-monochrome-light.png',
    'atlas-erp_monochrome_dark.png': 'atlas-logo-monochrome-dark.png',
}


def _dist2(a, b):
    dr = int(a[0]) - int(b[0])
    dg = int(a[1]) - int(b[1])
    db = int(a[2]) - int(b[2])
    return dr * dr + dg * dg + db * db


def remove_bg_by_region_grow(img, step_threshold=30):
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    bg = [[False] * w for _ in range(h)]
    q = deque()

    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))

    threshold2 = step_threshold * step_threshold

    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        if bg[y][x]:
            continue

        cur = px[x, y]
        bg[y][x] = True

        for nx, ny in (
            (x + 1, y),
            (x - 1, y),
            (x, y + 1),
            (x, y - 1),
            (x + 1, y + 1),
            (x - 1, y - 1),
            (x + 1, y - 1),
            (x - 1, y + 1),
        ):
            if nx < 0 or ny < 0 or nx >= w or ny >= h or bg[ny][nx]:
                continue
            nxt = px[nx, ny]
            if _dist2(cur, nxt) <= threshold2:
                q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if bg[y][x]:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    return img


def remove_bg_by_border_chroma(img, threshold=38):
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size

    samples = []
    for x in range(w):
        samples.append(px[x, 0][:3])
        samples.append(px[x, h - 1][:3])
    for y in range(h):
        samples.append(px[0, y][:3])
        samples.append(px[w - 1, y][:3])

    rs = sorted(v[0] for v in samples)
    gs = sorted(v[1] for v in samples)
    bs = sorted(v[2] for v in samples)
    mid = len(samples) // 2
    bg = (rs[mid], gs[mid], bs[mid])

    t2 = threshold * threshold
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if _dist2((r, g, b), bg) <= t2:
                px[x, y] = (r, g, b, 0)

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    return img


def main():
    for src_name, out_name in MAPPING.items():
        src = IDENTITY / src_name
        if not src.exists():
            raise FileNotFoundError(f'Missing source: {src}')

        original = Image.open(src)
        if src_name == 'atlas-erp_monochrome_light.png':
            out = remove_bg_by_border_chroma(original, threshold=38)
        else:
            out = remove_bg_by_region_grow(original, step_threshold=30)

        out_path = OUT_DIR / out_name
        out.save(out_path, format='PNG', optimize=True)
        print(f'Generated {out_path.name}: {out.size[0]}x{out.size[1]}')


if __name__ == '__main__':
    main()
