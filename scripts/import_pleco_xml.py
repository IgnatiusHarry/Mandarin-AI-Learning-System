from __future__ import annotations

import argparse
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


PINYIN_TOKEN_RE = re.compile(r"[A-Za-zÜüVv]+[1-5]?")
POS_RE = re.compile(
    r"^(?:noun|verb|adjective|adverb|preposition|conjunction|auxiliary|measure word|pronoun|interjection)\b",
    re.IGNORECASE,
)
POS_VALUE_RE = re.compile(
    r"^(noun|verb|adjective|adverb|preposition|conjunction|auxiliary|measure word|pronoun|interjection)\b",
    re.IGNORECASE,
)


def _extract_tokens(pron_text: str) -> list[str]:
    cleaned = pron_text.replace("//", " ").replace("·", " ").strip()
    return PINYIN_TOKEN_RE.findall(cleaned)


def _normalize_pinyin(pron_text: str) -> tuple[str, str]:
    tokens = _extract_tokens(pron_text)
    if not tokens:
        return "", ""

    pinyin_parts: list[str] = []
    tone_parts: list[str] = []

    for token in tokens:
        pinyin_parts.append(token.rstrip("12345").lower())
        tone_parts.append(token[-1] if token[-1].isdigit() else "5")

    return " ".join(pinyin_parts), " ".join(tone_parts)


def _extract_primary_meaning(definition: str) -> str:
    compact = re.sub(r"\s+", " ", definition).strip()
    compact = re.sub(r"\([^)]*[\u4e00-\u9fff][^)]*\)", "", compact)
    compact = POS_RE.sub("", compact, count=1).strip()
    compact = re.sub(r"^\d+\s*", "", compact).strip()
    compact = compact.split(" See ", 1)[0].strip()

    chinese_index = re.search(r"[\u4e00-\u9fff]", compact)
    if chinese_index:
        compact = compact[: chinese_index.start()].strip()

    return compact.rstrip(";,.:")


def _extract_part_of_speech(definition: str) -> str | None:
    match = POS_VALUE_RE.match(re.sub(r"\s+", " ", definition).strip())
    if not match:
        return None
    return match.group(1).lower()


def _extract_hsk_level(categories: list[str]) -> int | None:
    for category in categories:
        match = re.search(r"HSK\s+3\.0/Level\s+(\d+)", category)
        if match:
            return int(match.group(1))
    return None


def _text(element: ET.Element | None) -> str:
    return "" if element is None else "".join(element.itertext()).strip()


def parse_pleco_xml(xml_path: Path) -> list[dict[str, Any]]:
    tree = ET.parse(xml_path)
    root = tree.getroot()

    cards: list[dict[str, Any]] = []
    for card in root.findall(".//card"):
        entry = card.find("entry")
        if entry is None:
            continue

        headwords = {
            node.attrib.get("charset", ""): _text(node)
            for node in entry.findall("headword")
        }

        pron = entry.find("pron")
        defn = entry.find("defn")

        pinyin = ""
        tone_numbers = ""
        if pron is not None:
            pinyin, tone_numbers = _normalize_pinyin(_text(pron))

        definition_raw = _text(defn)

        categories = [node.attrib.get("category", "") for node in card.findall("catassign") if node.attrib.get("category")]
        dictref = card.find("dictref")
        scoreinfo = card.find("scoreinfo")

        cards.append(
            {
                "word": headwords.get("tc") or headwords.get("sc") or "",
                "simplified": headwords.get("sc") or None,
                "traditional": headwords.get("tc") or None,
                "pinyin": pinyin or None,
                "tone_numbers": tone_numbers or None,
                "meaning_en": _extract_primary_meaning(definition_raw) or None,
                "part_of_speech": _extract_part_of_speech(definition_raw),
                "hsk_level": _extract_hsk_level(categories),
                "definition_raw": definition_raw or None,
                "categories": categories,
                "dictref": dictref.attrib if dictref is not None else None,
                "scoreinfo": scoreinfo.attrib if scoreinfo is not None else None,
                "created": card.attrib.get("created"),
                "modified": card.attrib.get("modified"),
            }
        )

    return cards


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert a Pleco flashcard XML export into structured JSON material."
    )
    parser.add_argument("xml_path", type=Path, help="Path to the Pleco XML export")
    parser.add_argument(
        "output_path",
        type=Path,
        nargs="?",
        help="Optional output JSON file. Defaults to the XML file name with .json",
    )
    args = parser.parse_args()

    xml_path: Path = args.xml_path.expanduser().resolve()
    output_path = args.output_path.expanduser().resolve() if args.output_path else xml_path.with_suffix(".json")

    cards = parse_pleco_xml(xml_path)
    output_path.write_text(json.dumps(cards, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {len(cards)} cards to {output_path}")


if __name__ == "__main__":
    main()