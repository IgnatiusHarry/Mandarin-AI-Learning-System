from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from materials_pipeline.io_json import book_from_dict  # noqa: E402
from materials_pipeline.merge import merge_book_with_pleco  # noqa: E402
from materials_pipeline.pleco_sources import dedupe_entries, load_pleco_path  # noqa: E402
from materials_pipeline.textbook_ntnu_pdf import parse_ntnu_textbook_pdf  # noqa: E402
from materials_pipeline.batch_catalog import build_catalog_from_manifest, load_manifest  # noqa: E402


def cmd_pleco(args: argparse.Namespace) -> None:
    entries = dedupe_entries(load_pleco_path(Path(args.input)))
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps([e.to_json_dict() for e in entries], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {len(entries)} Pleco entries to {out}")


def cmd_textbook(args: argparse.Namespace) -> None:
    book = parse_ntnu_textbook_pdf(
        Path(args.pdf),
        book_display_name=args.name,
        include_heuristic_vocab=bool(args.heuristic_vocab),
        slug=args.slug,
    )
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(book.to_json_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote book draft with {len(book.chapters)} chapters to {out}")


def cmd_batch(args: argparse.Namespace) -> None:
    manifest = load_manifest(Path(args.manifest))
    catalog = build_catalog_from_manifest(manifest)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    n = len(catalog.get("books") or [])
    print(f"Wrote {n} book(s) to {out}")


def cmd_merge(args: argparse.Namespace) -> None:
    book = book_from_dict(json.loads(Path(args.book_json).read_text(encoding="utf-8")))
    pleco = dedupe_entries(load_pleco_path(Path(args.pleco)))
    merged = merge_book_with_pleco(book, pleco)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(merged.to_json_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote merged book with {len(merged.chapters)} chapters to {out}")


def main() -> None:
    p = argparse.ArgumentParser(description="Mandarin materials pipeline (Pleco + NTNU PDF).")
    sub = p.add_subparsers(dest="cmd", required=True)

    p1 = sub.add_parser("pleco", help="Normalize Pleco export → JSON")
    p1.add_argument("input", type=Path)
    p1.add_argument("-o", "--output", type=Path, required=True)
    p1.set_defaults(func=cmd_pleco)

    p2 = sub.add_parser("textbook", help="Parse NTNU-style PDF → book JSON draft")
    p2.add_argument("pdf", type=Path)
    p2.add_argument("-o", "--output", type=Path, required=True)
    p2.add_argument("-n", "--name", type=str, default=None, help="Display name for the book")
    p2.add_argument("--slug", type=str, default=None, help="Stable URL slug (ASCII recommended)")
    p2.add_argument(
        "--heuristic-vocab",
        action="store_true",
        help="Enable noisy PDF vocabulary/grammar heuristics (off by default)",
    )
    p2.set_defaults(func=cmd_textbook)

    p3 = sub.add_parser("merge", help="Merge book JSON with Pleco export")
    p3.add_argument("book_json", type=Path)
    p3.add_argument("pleco", type=Path)
    p3.add_argument("-o", "--output", type=Path, required=True)
    p3.set_defaults(func=cmd_merge)

    p4 = sub.add_parser(
        "batch",
        help="Parse every PDF in a manifest → one catalog JSON (當代 1–6 + 時代華語, dll.)",
    )
    p4.add_argument("manifest", type=Path, help="JSON manifest (pdf_root + entries[])")
    p4.add_argument(
        "-o",
        "--output",
        type=Path,
        default=ROOT / "data" / "curriculum" / "catalog_from_pdfs.json",
        help="Output path (default: data/curriculum/catalog_from_pdfs.json)",
    )
    p4.set_defaults(func=cmd_batch)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
