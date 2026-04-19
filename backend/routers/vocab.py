from fastapi import APIRouter, Depends, HTTPException, Query
from uuid import UUID
from db.supabase_client import get_supabase
from middleware.auth import verify_openclaw_secret, verify_supabase_jwt
from models.schemas import VocabItem
from services.ai_processor import LESSON_VOCAB, LESSON_TITLES

router = APIRouter()


@router.get("")
async def list_vocab(
    user_id: UUID | None = Query(default=None),
    jwt: dict = Depends(verify_supabase_jwt),
):
    """List all vocabulary for a user (web)."""
    sb = get_supabase()
    uid = str(user_id) if user_id else None
    if not uid:
        auth_uid = jwt.get("sub")
        if not auth_uid:
            raise HTTPException(status_code=400, detail="user_id required")
        profile = (
            sb.table("profiles")
            .select("id")
            .eq("supabase_auth_id", auth_uid)
            .limit(1)
            .execute()
        )
        if profile.data:
            uid = profile.data[0]["id"]
        else:
            # Auto-create profile for first-time web users
            new_profile = (
                sb.table("profiles")
                .insert({"supabase_auth_id": auth_uid})
                .execute()
            )
            uid = new_profile.data[0]["id"] if new_profile.data else None

    if not uid:
        return []

    result = (
        sb.table("vocabulary")
        .select("*, user_reviews(mastery_level, review_count, average_quality, next_review_at)")
        .eq("user_id", uid)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.get("/words")
async def list_vocab_words(
    lesson_tag: str | None = Query(default=None),
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Return compact word list (word, pinyin, tone_numbers, meaning_en, meaning_id) for client-side lookup."""
    sb = get_supabase()
    uid: str | None = None
    auth_uid = jwt.get("sub")
    if auth_uid:
        profile = (
            sb.table("profiles")
            .select("id")
            .eq("supabase_auth_id", auth_uid)
            .limit(1)
            .execute()
        )
        if profile.data:
            uid = profile.data[0]["id"]
    if not uid:
        return []
    query = (
        sb.table("vocabulary")
        .select("word, pinyin, tone_numbers, meaning_en, meaning_id")
        .eq("user_id", uid)
    )

    if lesson_tag and lesson_tag in LESSON_VOCAB:
        query = query.in_("word", LESSON_VOCAB[lesson_tag])

    result = query.execute()
    return result.data


@router.get("/lesson-options")
async def list_lesson_review_options(jwt: dict = Depends(verify_supabase_jwt)):
    """Tags that can filter review / vocab scope (from configured lesson decks)."""
    _ = jwt  # require login; list is static per deployment
    return [
        {"tag": tag, "title": LESSON_TITLES.get(tag, tag)}
        for tag in sorted(LESSON_VOCAB.keys())
    ]


@router.get("/{vocab_id}")
async def get_vocab(
    vocab_id: UUID,
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Get a single vocabulary item."""
    sb = get_supabase()
    result = (
        sb.table("vocabulary")
        .select("*, user_reviews(*)")
        .eq("id", str(vocab_id))
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Vocabulary not found")
    return result.data[0]


@router.delete("/{vocab_id}", status_code=204)
async def delete_vocab(
    vocab_id: UUID,
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Delete a vocabulary item and its review data."""
    sb = get_supabase()
    sb.table("vocabulary").delete().eq("id", str(vocab_id)).execute()
