from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from materials_pipeline.merge import merge_book_with_pleco
from materials_pipeline.pleco_sources import dedupe_entries, load_pleco_path
from materials_pipeline.textbook_ntnu_pdf import parse_ntnu_textbook_pdf


def _resolve_pdf(entry: dict[str, Any], pdf_root: Path | None) -> Path:
    if entry.get("pdf"):
        return Path(entry["pdf"]).expanduser().resolve()
    rel = entry.get("relative_pdf")
    if not rel:
        raise ValueError("Each manifest entry needs 'pdf' or 'relative_pdf'")
    if not pdf_root:
        raise ValueError("Manifest needs 'pdf_root' when using 'relative_pdf'")
    return (pdf_root / rel).expanduser().resolve()


def build_catalog_from_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    """
    Parse every PDF in manifest.entries and return { books: [...] }.
    Optional manifest['pleco']: path → merge supplemental Pleco into each book.
    """
    pdf_root = Path(manifest["pdf_root"]).expanduser() if manifest.get("pdf_root") else None
    opts = manifest.get("options") or {}
    heuristic = bool(opts.get("heuristic_vocab", False))

    pleco_entries: list | None = None
    pleco_path = manifest.get("pleco")
    if pleco_path:
        pleco_entries = dedupe_entries(load_pleco_path(Path(pleco_path).expanduser()))

    books_out: list[dict[str, Any]] = []
    for i, entry in enumerate(manifest.get("entries") or [], start=1):
        try:
            pdf = _resolve_pdf(entry, pdf_root)
        except ValueError as e:
            print(f"[batch] skip entry {i}: {e}", file=sys.stderr)
            continue
        if not pdf.is_file():
            print(f"[batch] skip missing file: {pdf}", file=sys.stderr)
            continue
        name = entry.get("name") or pdf.stem
        slug = entry.get("slug")
        try:
            book = parse_ntnu_textbook_pdf(
                pdf,
                book_display_name=name,
                include_heuristic_vocab=heuristic,
                slug=slug,
            )
        except Exception as e:  # noqa: BLE001 — batch should continue
            print(f"[batch] failed {pdf}: {e}", file=sys.stderr)
            continue
        if pleco_entries:
            book = merge_book_with_pleco(book, pleco_entries)
        d = book.to_json_dict()
        if entry.get("kind"):
            d["kind"] = entry["kind"]
        if entry.get("series"):
            d["series"] = entry["series"]
        if entry.get("volume") is not None:
            d["volume"] = entry["volume"]
        books_out.append(d)
        print(f"[batch] OK {book.slug}: {len(book.chapters)} chapters ← {pdf.name}")

    return {"books": books_out, "meta": {"source": "batch_manifest", "entry_count": len(books_out)}}


def load_manifest(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))
