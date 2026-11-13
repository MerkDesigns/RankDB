"""Renders the backup file icon (.rankdb files in Explorer) from src/assets/extras/RankDB_Export_Icon.png.

Every size is resampled straight from the 1000 px source. Windows only scales an icon when the
size it needs is missing, and that scaling is what made the icon blurry (Large icons at 100% are
96 px, and the old .ico jumped from 64 to 128). So both outputs carry every size Explorer asks for
at 100–200% display scaling:

- src-tauri/icons/backup-file.ico: the installer's file association (GitHub version).
- store/backup-file/: the Microsoft Store package's file association (scripts/build-store.mjs copies
  them into Assets). `targetsize-N` is the size Explorer asks for and `altform-unplated` keeps it
  off the tile-coloured plate; plain BackupFile.png is the fallback.

Run with: python scripts/render-backup-icon.py (needs Pillow).
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src/assets/extras/RankDB_Export_Icon.png"
ICO = ROOT / "src-tauri/icons/backup-file.ico"
STORE = ROOT / "store/backup-file"

# Explorer's list, details, tiles, medium, large and extra-large views at 100, 125, 150 and 200%.
ICO_SIZES = [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 120, 128, 144, 160, 192, 256]
# The target sizes MSIX file-type logos support.
STORE_SIZES = [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 256]


def render(source: Image.Image, size: int) -> Image.Image:
    return source.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    if source.width != source.height:
        raise SystemExit(f"{SOURCE} must be square")

    frames = [render(source, size) for size in ICO_SIZES]
    largest = frames[-1]
    largest.save(ICO, format="ICO", sizes=[(size, size) for size in ICO_SIZES], append_images=frames[:-1])

    STORE.mkdir(parents=True, exist_ok=True)
    for old in STORE.glob("*.png"):
        old.unlink()
    render(source, 256).save(STORE / "BackupFile.png", optimize=True)
    for size in STORE_SIZES:
        image = render(source, size)
        image.save(STORE / f"BackupFile.targetsize-{size}.png", optimize=True)
        image.save(STORE / f"BackupFile.targetsize-{size}_altform-unplated.png", optimize=True)

    print(f"{ICO.relative_to(ROOT)}: {len(ICO_SIZES)} sizes; {STORE.relative_to(ROOT)}: {1 + 2 * len(STORE_SIZES)} files")


if __name__ == "__main__":
    main()
