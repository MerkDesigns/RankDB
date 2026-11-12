# Renders the division numbers 1-5 (src/assets/digits/*.png) from the rank font, which stays on
# Merk's PC only (src/assets/fonts/ is git-ignored: its licence doesn't allow shipping the font).
# Each image is the box the digit took as text: the font's digit width by 1em, baseline at the
# font's ascent, white ink on transparent (RankDigit paints it in the text colour). If the font
# changes, update `.rank-digit`'s width in src/styles/app.css to the printed em width.
#
#   python scripts/render-rank-digits.py   (needs Pillow: pip install pillow)
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "src/assets/fonts/futura-no2-d-demi-bold.ttf"
OUT = ROOT / "src/assets/digits"
SIZE = 512

font = ImageFont.truetype(str(FONT), SIZE)
ascent, _ = font.getmetrics()
OUT.mkdir(exist_ok=True)
for digit in "12345":
    width = round(font.getlength(digit))
    image = Image.new("RGBA", (width, SIZE), (255, 255, 255, 0))
    ImageDraw.Draw(image).text((0, ascent), digit, font=font, fill=(255, 255, 255, 255), anchor="ls")
    image.save(OUT / f"{digit}.png", optimize=True)
    print(f"{digit}.png: {width}x{SIZE}, width {font.getlength(digit) / SIZE:.6f}em")
