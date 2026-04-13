from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import httpx
from supabase import create_client


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.srs import get_initial_review
from import_pleco_xml import parse_pleco_xml


class ImportSettings:
    def __init__(self) -> None:
        self.supabase_url = os.environ["SUPABASE_URL"]
        self.supabase_service_key = os.environ["SUPABASE_SERVICE_KEY"]


def resolve_profile_id(sb, user_id: str | None, telegram_id: int | None, display_name: str) -> str:
    if user_id:
        profile = sb.table("profiles").select("id").eq("id", user_id).limit(1).execute()
        if profile.data:
            return profile.data[0]["id"]
        raise SystemExit(f"Profile with id {user_id} was not found")

    if telegram_id is not None:
        profile = sb.table("profiles").select("id").eq("telegram_id", telegram_id).limit(1).execute()
        if profile.data:
            return profile.data[0]["id"]

        created = (
            sb.table("profiles")
            .insert({"telegram_id": telegram_id, "display_name": display_name})
            .execute()
        )
        return created.data[0]["id"]

    created = sb.table("profiles").insert({"display_name": display_name}).execute()
    return created.data[0]["id"]


def _chunked(items: list[dict], size: int) -> list[list[dict]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def _execute_with_retry(op, retries: int = 5):
    for attempt in range(1, retries + 1):
        try:
            return op()
        except (httpx.RemoteProtocolError, httpx.ReadTimeout, httpx.ConnectError):
            if attempt == retries:
                raise
            time.sleep(min(1.5 * attempt, 6))


def upsert_deck(sb, profile_id: str, cards: list[dict]) -> tuple[int, int]:
    saved = 0
    skipped = 0
    vocab_payloads: list[dict] = []

    for card in cards:
        word = card.get("word")
        pinyin = card.get("pinyin")
        meaning_en = card.get("meaning_en")
        if not word or not pinyin or not meaning_en:
            skipped += 1
            continue

        vocab_payloads.append(
            {
            "user_id": profile_id,
            "word": word,
            "simplified": card.get("simplified"),
            "pinyin": pinyin,
            "tone_numbers": card.get("tone_numbers"),
            "meaning_en": meaning_en,
            "meaning_id": None,
            "part_of_speech": card.get("part_of_speech"),
            "hsk_level": card.get("hsk_level"),
            "example_sentence": None,
            "example_pinyin": None,
            "memory_tip": None,
            "source": "pleco_xml",
            },
        )

    for chunk in _chunked(vocab_payloads, 200):
        result = _execute_with_retry(
            lambda: sb.table("vocabulary").upsert(chunk, on_conflict="user_id,word").execute()
        )
        rows = result.data or []
        if not rows:
            continue

        review_payloads = [
            {
                "user_id": profile_id,
                "vocabulary_id": row["id"],
                **get_initial_review(),
            }
            for row in rows
        ]
        _execute_with_retry(
            lambda: sb.table("user_reviews").upsert(review_payloads, on_conflict="user_id,vocabulary_id").execute()
        )
        saved += len(rows)
        print(f"Processed {saved}/{len(vocab_payloads)} vocabulary rows...")

    return saved, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Pleco XML cards into Supabase.")
    parser.add_argument("xml_path", type=Path, help="Path to the Pleco XML export")
    parser.add_argument("--user-id", help="Existing profiles.id to import into")
    parser.add_argument("--telegram-id", type=int, help="Existing or new telegram_id to target")
    parser.add_argument(
        "--display-name",
        default="Pleco Import",
        help="Display name used if a profile needs to be created",
    )
    args = parser.parse_args()

    settings = ImportSettings()
    sb = create_client(settings.supabase_url, settings.supabase_service_key)

    xml_path = args.xml_path.expanduser().resolve()
    cards = parse_pleco_xml(xml_path)
    profile_id = resolve_profile_id(sb, args.user_id, args.telegram_id, args.display_name)

    saved, skipped = upsert_deck(sb, profile_id, cards)
    print(f"Imported {saved} cards into Supabase for profile {profile_id}; skipped {skipped}.")


if __name__ == "__main__":
    main()