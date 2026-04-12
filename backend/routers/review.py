from fastapi import APIRouter, Depends, HTTPException, Query
from uuid import UUID
from datetime import datetime, timezone, date

from db.supabase_client import get_supabase
from middleware.auth import verify_supabase_jwt
from models.schemas import ReviewAnswerRequest
from services.srs import calculate_next_review, update_average_quality

router = APIRouter()


@router.get("/due")
async def get_due_cards(
    telegram_id: int | None = Query(default=None),
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Return all cards due for review today."""
    sb = get_supabase()
    user_id = await _resolve_user_id(sb, telegram_id, jwt)

    now = datetime.now(timezone.utc).isoformat()
    result = (
        sb.table("user_reviews")
        .select("*, vocabulary(*)")
        .eq("user_id", user_id)
        .lte("next_review_at", now)
        .order("next_review_at")
        .execute()
    )
    return result.data


@router.post("/answer")
async def submit_answer(
    body: ReviewAnswerRequest,
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Submit a review answer and update SRS state."""
    sb = get_supabase()
    user_id = await _resolve_user_id(sb, body.telegram_id, jwt)

    # Fetch current SRS state
    review = (
        sb.table("user_reviews")
        .select("*")
        .eq("user_id", user_id)
        .eq("vocabulary_id", str(body.vocabulary_id))
        .single()
        .execute()
    )
    if not review.data:
        raise HTTPException(status_code=404, detail="Review record not found")

    row = review.data
    srs = calculate_next_review(
        ease_factor=row["ease_factor"],
        interval=row["interval_days"],
        quality=body.quality,
    )
    new_avg = update_average_quality(
        row["average_quality"], row["review_count"], body.quality
    )

    sb.table("user_reviews").update(
        {
            "interval_days": srs.interval,
            "ease_factor": srs.ease_factor,
            "mastery_level": srs.mastery_level,
            "next_review_at": srs.next_review_at.isoformat(),
            "last_reviewed_at": datetime.now(timezone.utc).isoformat(),
            "review_count": row["review_count"] + 1,
            "average_quality": new_avg,
        }
    ).eq("user_id", user_id).eq("vocabulary_id", str(body.vocabulary_id)).execute()

    # Log the review
    if body.response_time_ms is not None:
        active_session = (
            sb.table("review_sessions")
            .select("id")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if active_session.data:
            sb.table("review_log").insert(
                {
                    "session_id": active_session.data[0]["id"],
                    "vocabulary_id": str(body.vocabulary_id),
                    "quality": body.quality,
                    "response_time_ms": body.response_time_ms,
                }
            ).execute()

    # Update daily goal
    _upsert_daily_review_count(sb, user_id, body.quality)

    return {
        "next_review_in_days": srs.interval,
        "mastery_level": srs.mastery_level,
        "ease_factor": srs.ease_factor,
    }


@router.post("/session/start")
async def start_session(
    telegram_id: int | None = Query(default=None),
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Start a review session."""
    sb = get_supabase()
    user_id = await _resolve_user_id(sb, telegram_id, jwt)

    result = (
        sb.table("review_sessions")
        .insert({"user_id": user_id, "source": "web", "is_active": True})
        .execute()
    )
    return result.data[0]


@router.post("/session/end")
async def end_session(
    session_id: UUID,
    words_reviewed: int = 0,
    words_correct: int = 0,
    duration_seconds: int | None = None,
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Finalize a review session."""
    sb = get_supabase()
    sb.table("review_sessions").update(
        {
            "is_active": False,
            "words_reviewed": words_reviewed,
            "words_correct": words_correct,
            "duration_seconds": duration_seconds,
        }
    ).eq("id", str(session_id)).execute()
    return {"status": "ok"}


@router.get("/weak")
async def get_weak_words(
    telegram_id: int | None = Query(default=None),
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Words with average_quality < 3 AND reviewed >= 3 times."""
    sb = get_supabase()
    user_id = await _resolve_user_id(sb, telegram_id, jwt)

    result = (
        sb.table("user_reviews")
        .select("*, vocabulary(*)")
        .eq("user_id", user_id)
        .lt("average_quality", 3)
        .gte("review_count", 3)
        .order("average_quality")
        .limit(20)
        .execute()
    )
    return result.data


# ── internal helpers ─────────────────────────────────────────────────

async def _resolve_user_id(sb, telegram_id: int | None, jwt: dict) -> str:
    if telegram_id:
        profile = (
            sb.table("profiles")
            .select("id")
            .eq("telegram_id", telegram_id)
            .single()
            .execute()
        )
        if not profile.data:
            raise HTTPException(status_code=404, detail="User not found")
        return profile.data["id"]
    uid = jwt.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Cannot identify user")
    # Find profile by supabase_auth_id
    profile = (
        sb.table("profiles")
        .select("id")
        .eq("supabase_auth_id", uid)
        .single()
        .execute()
    )
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not linked")
    return profile.data["id"]


def _upsert_daily_review_count(sb, user_id: str, quality: int):
    today = date.today().isoformat()
    correct = 1 if quality >= 3 else 0
    sb.rpc(
        "upsert_daily_review",
        {"p_user_id": user_id, "p_date": today, "p_correct": correct},
    ).execute()
