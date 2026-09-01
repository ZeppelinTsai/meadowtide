"""Export responsive WebP variants from PNG source(s) without upscaling.

兩種模式：
  --input FILE       單一來源檔（原本的用法，world-map.png 用這個）。
  --input-dir DIR     整個資料夾——DIR 底下每個 *.png 各自輸出一組響應式
                      版本（檔名用來源檔案的 stem 當 --name），CG／立繪
                      這種「一堆各自獨立的圖檔」用這個，不用一張一張跑。

兩種模式互斥，一定要指定其中一個。
"""

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


def export_directory(input_dir: Path, output_dir: Path, widths: list[int], quality: int) -> None:
    if not input_dir.is_dir():
        raise SystemExit(f"Input dir not found: {input_dir}")
    png_files = sorted(input_dir.glob("*.png"))
    if not png_files:
        print(f"（{input_dir} 底下沒有找到 .png 檔案，沒事可做）")
        return
    for source in png_files:
        export_variants(source, output_dir, source.stem, widths, quality)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", type=Path, help="單一來源 PNG 檔案")
    parser.add_argument("--input-dir", type=Path, help="整個資料夾，底下每個 *.png 各自輸出一組")
    parser.add_argument("--output-dir", type=Path, help="輸出資料夾，預設跟來源同一個資料夾")
    parser.add_argument("--name", help="輸出檔名前綴，只在 --input（單一檔案模式）有效；--input-dir 模式一律用各檔案自己的檔名")
    parser.add_argument("--widths", type=parse_widths, default=parse_widths("480,960,1440"))
    parser.add_argument("--quality", type=int, default=88)
    args = parser.parse_args()
    if not 1 <= args.quality <= 100:
        parser.error("quality must be between 1 and 100")
    if args.input and args.input_dir:
        parser.error("--input 和 --input-dir 只能擇一")
    if not args.input and not args.input_dir:
        # 完全不給參數時保留舊行為：`npm run assets:webp` 一直是這樣用
        # 的，向下相容，預設處理世界地圖底圖。
        args.input = Path("public/assets/map/world-map.png")

    if args.input:
        output_dir = args.output_dir or args.input.parent
        name = args.name or args.input.stem
        export_variants(args.input, output_dir, name, args.widths, args.quality)
    else:
        if args.name:
            parser.error("--name 只能搭配 --input 使用，--input-dir 模式請省略")
        output_dir = args.output_dir or args.input_dir
        export_directory(args.input_dir, output_dir, args.widths, args.quality)


if __name__ == "__main__":
    main()
