from fastapi import APIRouter, Depends, Query
from datetime import datetime, timezone, date

from db.supabase_client import get_supabase
from middleware.auth import verify_supabase_jwt
from models.schemas import UserStats

router = APIRouter()


@router.get("", response_model=UserStats)
async def get_stats(
    telegram_id: int | None = Query(default=None),
    jwt: dict = Depends(verify_supabase_jwt),
) -> UserStats:
    """Return current stats for a user."""
    sb = get_supabase()
    user_id = await _resolve_user_id(sb, telegram_id, jwt)

    now = datetime.now(timezone.utc).isoformat()
    today = date.today().isoformat()

    total = sb.table("vocabulary").select("id", count="exact").eq("user_id", user_id).execute()
    mastered = (
        sb.table("user_reviews")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("mastery_level", 4)
        .execute()
    )
    weak = (
        sb.table("user_reviews")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .lt("average_quality", 3)
        .gte("review_count", 3)
        .execute()
    )
    due = (
        sb.table("user_reviews")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .lte("next_review_at", now)
        .execute()
    )
    profile = sb.table("profiles").select("streak_days").eq("id", user_id).limit(1).execute()
    streak = profile.data[0].get("streak_days", 0) if profile.data else 0

    daily = (
        sb.table("daily_goals")
        .select("actual_reviews")
        .eq("user_id", user_id)
        .eq("goal_date", today)
        .limit(1)
        .execute()
    )
    reviewed_today = daily.data[0].get("actual_reviews", 0) if daily.data else 0

    return UserStats(
        total_words=total.count or 0,
        mastered_words=mastered.count or 0,
        weak_words=weak.count or 0,
        due_today=due.count or 0,
        streak_days=streak,
        words_reviewed_today=reviewed_today,
    )


@router.get("/history")
async def get_review_history(
    days: int = Query(default=30, le=365),
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Return daily review counts for the past N days."""
    sb = get_supabase()
    user_id = await _resolve_user_id(sb, None, jwt)

    result = (
        sb.table("daily_goals")
        .select("goal_date, actual_new_words, actual_reviews, streak_maintained")
        .eq("user_id", user_id)
        .order("goal_date", desc=True)
        .limit(days)
        .execute()
    )
    return result.data


@router.get("/mastery-distribution")
async def get_mastery_distribution(
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Return count of words at each mastery level (0-5)."""
    sb = get_supabase()
    user_id = await _resolve_user_id(sb, None, jwt)

    result = (
        sb.table("user_reviews")
        .select("mastery_level")
        .eq("user_id", user_id)
        .execute()
    )
    dist = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for row in (result.data or []):
        level = row.get("mastery_level", 0)
        dist[level] = dist.get(level, 0) + 1
    return dist


# ── helpers ──────────────────────────────────────────────────────────

async def _resolve_user_id(sb, telegram_id: int | None, jwt: dict) -> str:
    from fastapi import HTTPException
    if telegram_id:
        profile = (
            sb.table("profiles").select("id").eq("telegram_id", telegram_id).limit(1).execute()
        )
        if not profile.data:
            raise HTTPException(status_code=404, detail="User not found")
        return profile.data[0]["id"]
    uid = jwt.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Cannot identify user")
    profile = (
        sb.table("profiles").select("id").eq("supabase_auth_id", uid).limit(1).execute()
    )
    if profile.data:
        return profile.data[0]["id"]
    # Auto-create profile for first-time web users
    new_profile = (
        sb.table("profiles")
        .insert({"supabase_auth_id": uid})
        .execute()
    )
    if not new_profile.data:
        raise HTTPException(status_code=500, detail="Failed to create profile")
    return new_profile.data[0]["id"]
