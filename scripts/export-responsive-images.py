"""Export responsive WebP variants from a PNG source without upscaling."""

from __future__ import annotations

import argparse
from pathlib import Path

try:
    from PIL import Image
except ImportError as error:
    raise SystemExit("Pillow is required: python -m pip install Pillow") from error


def parse_widths(value: str) -> list[int]:
    widths = sorted({int(part.strip()) for part in value.split(",") if part.strip()})
    if not widths or any(width <= 0 for width in widths):
        raise argparse.ArgumentTypeError("widths must be positive comma-separated integers")
    return widths


def export_variants(source: Path, output_dir: Path, name: str, widths: list[int], quality: int) -> None:
    if source.suffix.lower() != ".png":
        raise SystemExit(f"Source must be PNG: {source}")
    if not source.is_file():
        raise SystemExit(f"Source not found: {source}")
    output_dir.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image.load()
        for width in widths:
            if width > image.width:
                print(f"skip {width}px (source is only {image.width}px wide)")
                continue
            height = round(image.height * width / image.width)
            resized = image.resize((width, height), Image.Resampling.LANCZOS)
            output = output_dir / f"{name}-{width}.webp"
            resized.save(output, "WEBP", quality=quality, method=6)
            print(f"{output}: {width}x{height}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path("public/assets/map/world-map.png"))
    parser.add_argument("--output-dir", type=Path, default=Path("public/assets/map"))
    parser.add_argument("--name", default="world-map")
    parser.add_argument("--widths", type=parse_widths, default=parse_widths("480,960,1440"))
    parser.add_argument("--quality", type=int, default=88)
    args = parser.parse_args()
    if not 1 <= args.quality <= 100:
        parser.error("quality must be between 1 and 100")
    export_variants(args.input, args.output_dir, args.name, args.widths, args.quality)


if __name__ == "__main__":
    main()