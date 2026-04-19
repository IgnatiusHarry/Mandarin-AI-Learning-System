from __future__ import annotations

import csv
import json
import sys
from pathlib import Path
from typing import Any

from materials_pipeline.models import VocabEntry
from materials_pipeline.normalize import merge_meaning_en_id, nfc, normalize_pinyin_display, strip_noise

_SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from import_pleco_xml import parse_pleco_xml  # noqa: E402


def pleco_xml_to_entries(xml_path: Path) -> list[VocabEntry]:
    cards = parse_pleco_xml(xml_path.expanduser().resolve())
    out: list[VocabEntry] = []
    for c in cards:
        w = strip_noise(str(c.get("word") or ""))
        if not w:
            continue
        py = normalize_pinyin_display(str(c.get("pinyin") or ""))
        en = strip_noise(str(c.get("meaning_en") or ""))
        out.append(
            VocabEntry(
                word=w,
                pinyin=py,
                meaning=en,
                meaning_en=en or None,
                example_sentence=None,
                source="pleco",
                meta={"pleco_format": "xml", "definition_raw": c.get("definition_raw")},
            )
        )
    return out


def _row_get(row: dict[str, str], *keys: str) -> str:
    lower = {k.lower().strip(): v for k, v in row.items()}
    for k in keys:
        if k in row and row[k]:
            return row[k]
        lk = k.lower()
        if lk in lower and lower[lk]:
            return lower[lk]
    return ""


def pleco_csv_to_entries(csv_path: Path) -> list[VocabEntry]:
    path = csv_path.expanduser().resolve()
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",\t;")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(text.splitlines(), dialect=dialect)
    out: list[VocabEntry] = []
    for row in reader:
        if not row:
            continue
        w = strip_noise(_row_get(row, "word", "hanzi", "chinese", "traditional", "term"))
        py = normalize_pinyin_display(_row_get(row, "pinyin", "pronunciation"))
        meaning = strip_noise(
            _row_get(row, "meaning", "definition", "gloss", "english", "en", "id", "indonesian")
        )
        ex = strip_noise(_row_get(row, "example", "example_sentence", "sentence")) or None
        if not w:
            continue
        out.append(
            VocabEntry(
                word=w,
                pinyin=py,
                meaning=meaning,
                meaning_en=meaning or None,
                example_sentence=ex,
                source="pleco",
                meta={"pleco_format": "csv"},
            )
        )
    return out


def pleco_json_to_entries(json_path: Path) -> list[VocabEntry]:
    raw = json.loads(json_path.read_text(encoding="utf-8"))
    if isinstance(raw, dict) and "cards" in raw:
        raw = raw["cards"]
    if not isinstance(raw, list):
        raise ValueError("Pleco JSON must be a list or {cards: [...]}")
    out: list[VocabEntry] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        w = strip_noise(str(item.get("word") or item.get("traditional") or item.get("hanzi") or ""))
        py = normalize_pinyin_display(str(item.get("pinyin") or ""))
        meaning = strip_noise(
            str(item.get("meaning") or item.get("meaning_en") or item.get("definition") or "")
        )
        ex = item.get("example_sentence") or item.get("example")
        ex_s = strip_noise(str(ex)) if ex else None
        if not w:
            continue
        out.append(
            VocabEntry(
                word=w,
                pinyin=py,
                meaning=meaning,
                meaning_en=meaning or None,
                example_sentence=ex_s,
                source="pleco",
                meta={"pleco_format": "json"},
            )
        )
    return out


def pleco_txt_blocks(txt_path: Path) -> list[VocabEntry]:
    """
    Very loose TXT: blocks separated by blank lines, first line Hanzi, second pinyin, rest meaning.
    """
    lines = txt_path.read_text(encoding="utf-8", errors="replace").splitlines()
    blocks: list[list[str]] = []
    cur: list[str] = []
    for line in lines:
        if not line.strip():
            if cur:
                blocks.append(cur)
                cur = []
            continue
        cur.append(line.rstrip())
    if cur:
        blocks.append(cur)
    out: list[VocabEntry] = []
    for b in blocks:
        if len(b) < 2:
            continue
        w = strip_noise(b[0])
        py = normalize_pinyin_display(b[1])
        meaning = strip_noise(" ".join(b[2:]))
        if not w:
            continue
        out.append(VocabEntry(word=w, pinyin=py, meaning=meaning, source="pleco", meta={"pleco_format": "txt"}))
    return out


def load_pleco_path(path: Path) -> list[VocabEntry]:
    p = path.expanduser().resolve()
    suf = p.suffix.lower()
    if suf == ".xml":
        return pleco_xml_to_entries(p)
    if suf == ".csv":
        return pleco_csv_to_entries(p)
    if suf == ".json":
        return pleco_json_to_entries(p)
    if suf in {".txt", ".tsv"}:
        if suf == ".tsv":
            # treat as single-column TSV of words only — fallback to txt logic won't work; use csv
            return pleco_csv_to_entries(p)
        return pleco_txt_blocks(p)
    raise ValueError(f"Unsupported Pleco export type: {p}")


def dedupe_entries(entries: list[VocabEntry]) -> list[VocabEntry]:
    seen: set[str] = set()
    out: list[VocabEntry] = []
    for e in entries:
        key = nfc(e.word) + "|" + nfc(e.meaning)[:200]
        if key in seen:
            continue
        seen.add(key)
        out.append(e)
    return out


def export_pleco_json(entries: list[VocabEntry]) -> list[dict[str, Any]]:
    return [e.to_json_dict() for e in entries]
