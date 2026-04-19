from __future__ import annotations

import re
import unicodedata


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", (s or "").strip())


def strip_noise(s: str) -> str:
    s = nfc(s)
    # Private-use / format chars common in Pleco / PDF paste
    s = re.sub(r"[\u200b-\u200f\ufeff\ue000-\uf8ff]", "", s)
    return s.strip()


PINYIN_SYLLABLE = re.compile(
    r"[a-zA-ZüÜ]+[1-5]?(?:[·.\s]+[a-zA-ZüÜ]+[1-5]?)*",
)


def normalize_pinyin_display(raw: str) -> str:
    """Trim symbols; keep tone marks or digit tones; collapse whitespace."""
    t = strip_noise(raw).replace("//", " ").replace("·", " ").replace(".", " ")
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def merge_meaning_en_id(meaning: str, en: str | None, id_: str | None) -> str:
    parts: list[str] = []
    m = strip_noise(meaning)
    if m:
        parts.append(m)
    e = strip_noise(en or "")
    i = strip_noise(id_ or "")
    if e and e not in m:
        parts.append(e)
    if i and i not in " ".join(parts):
        parts.append(i)
    return " / ".join(dict.fromkeys(parts))  # de-dupe preserve order


def dedupe_vocab_key(word: str, meaning: str = "") -> str:
    return f"{nfc(word)}|{nfc(meaning)[:120]}"
