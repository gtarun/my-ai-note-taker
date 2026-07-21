#!/bin/bash
# Builds the shipping asset set from the palette in src/theme.ts.
#
# The mark is the app's level meter: quiet bars for the room, and one warm bar
# in the middle for the sound actually being captured. It is the system's own
# rule — saturation is earned, and clay only ever means record — made into a
# shape. Chosen over a waveform-into-text mark and a serif quote mark because
# it was the only one of the three still legible at 80px, which is the size an
# icon is actually seen at.
set -euo pipefail
OUT="$1"; mkdir -p "$OUT"

STAGE_CORE="#1b2422"; STAGE_EDGE="#0e1312"
CLAY="#c2603c"; LIT="#37d6a8"

# scale = fraction of the 1024 canvas the mark occupies.
bars() {
  local scale="$1"
  python3 - "$scale" "$CLAY" "$LIT" <<'PY'
import sys
scale, clay, lit = float(sys.argv[1]), sys.argv[2], sys.argv[3]
# Symmetrical, rising to the centre. The outer pair is deliberately not tiny:
# below roughly a sixth of the tallest bar they disappear at icon size.
heights = [170, 300, 440, 580, 440, 300, 170]
width, gap = 56, 30
span = len(heights) * width + (len(heights) - 1) * gap
k = (1024 * scale) / span
w, g = width * k, gap * k
x = 512 - (len(heights) * w + (len(heights) - 1) * g) / 2
for i, h in enumerate(heights):
    hh = h * k
    fill, op = (clay, "1") if i == len(heights) // 2 else (lit, "0.88")
    print(f'  <rect x="{x:.1f}" y="{512 - hh / 2:.1f}" width="{w:.1f}" '
          f'height="{hh:.1f}" rx="{w / 2:.1f}" fill="{fill}" opacity="{op}"/>')
    x += w + g
PY
}

# ── iOS icon: full bleed, opaque, square (iOS applies its own mask) ───────────
cat > "$OUT/icon.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs><radialGradient id="g" cx="50%" cy="42%" r="72%">
    <stop offset="0%" stop-color="$STAGE_CORE"/><stop offset="100%" stop-color="$STAGE_EDGE"/>
  </radialGradient></defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
$(bars 0.62)
</svg>
SVG

# ── Android adaptive foreground: transparent, inside the 66% safe zone ────────
# The launcher mask can crop anything outside that circle, so the mark is
# scaled down rather than trusting the mask to be generous.
cat > "$OUT/adaptive-icon.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
$(bars 0.42)
</svg>
SVG

# ── Splash: the mark alone; Expo composites it on splash.backgroundColor ──────
cat > "$OUT/splash-icon.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
$(bars 0.55)
</svg>
SVG

for name in icon adaptive-icon splash-icon; do
  rsvg-convert -w 1024 -h 1024 "$OUT/$name.svg" -o "$OUT/$name.png"
done

# The App Store rejects a marketing icon carrying an alpha channel, and rsvg
# always emits RGBA. Flattening leaves the pixels identical and drops the channel.
magick "$OUT/icon.png" -background "$STAGE_EDGE" -alpha remove -alpha off "$OUT/icon.png"

# Favicon needs its own ground — it is composited by the browser, not by Expo.
magick "$OUT/splash-icon.png" -background "$STAGE_EDGE" -alpha remove -alpha off \
  -resize 48x48 "$OUT/favicon.png"

magick "$OUT/icon.png" -resize 80x80 "$OUT/_check-80.png"
magick "$OUT/icon.png" -resize 40x40 "$OUT/_check-40.png"
echo "generated"
