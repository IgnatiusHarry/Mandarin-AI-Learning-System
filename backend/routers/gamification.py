from fastapi import APIRouter, Depends, HTTPException

from db.supabase_client import get_supabase
from middleware.auth import verify_supabase_jwt

router = APIRouter()

SUBSCRIPTION_PLANS = [
    {
        "id": "monthly-pro",
        "name": "Mandarin Pro Monthly",
        "price_idr": 99000,
        "interval": "month",
        "features": [
            "Unlimited AI conversation",
            "Priority personalized study plan",
            "Advanced mastery analytics",
        ],
    },
    {
        "id": "yearly-pro",
        "name": "Mandarin Pro Yearly",
        "price_idr": 899000,
        "interval": "year",
        "features": [
            "Everything in monthly",
            "Exclusive pronunciation missions",
            "48% yearly savings",
        ],
    },
]


@router.get("/profile")
async def get_gamification_profile(jwt: dict = Depends(verify_supabase_jwt)):
    """Return user gamification profile (xp, hearts, subscription tier)."""
    sb = get_supabase()
    profile = await _resolve_profile(sb, jwt)
    user_id = profile["id"]

    stats = (
        sb.table("daily_goals")
        .select("actual_reviews")
        .eq("user_id", user_id)
        .order("goal_date", desc=True)
        .limit(30)
        .execute()
    )

    reviews_30d = sum((r.get("actual_reviews", 0) or 0) for r in (stats.data or []))
    mastered = (
        sb.table("user_reviews")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("mastery_level", 4)
        .execute()
    )
    mastered_count = mastered.count or 0

    # Derived XP so it works even before dedicated xp column exists.
    xp = reviews_30d * 5 + mastered_count * 10
    level = max(1, xp // 100 + 1)

    return {
        "xp": xp,
        "level": level,
        "hearts": profile.get("hearts", 5),
        "subscription_tier": profile.get("subscription_tier", "free"),
        "streak_days": profile.get("streak_days", 0),
    }


@router.get("/quests")
async def get_quests(jwt: dict = Depends(verify_supabase_jwt)):
    """Return quest progress using current user activity."""
    sb = get_supabase()
    profile = await _resolve_profile(sb, jwt)
    user_id = profile["id"]

    daily = (
        sb.table("daily_goals")
        .select("actual_reviews, actual_new_words")
        .eq("user_id", user_id)
        .order("goal_date", desc=True)
        .limit(1)
        .execute()
    )
    row = daily.data[0] if daily.data else {"actual_reviews": 0, "actual_new_words": 0}

    mastered = (
        sb.table("user_reviews")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("mastery_level", 4)
        .execute()
    )

    quests = [
        {
            "id": "reviews-10",
            "title": "Complete 10 reviews",
            "target": 10,
            "progress": row.get("actual_reviews", 0) or 0,
            "reward_xp": 25,
        },
        {
            "id": "new-words-5",
            "title": "Learn 5 new words",
            "target": 5,
            "progress": row.get("actual_new_words", 0) or 0,
            "reward_xp": 35,
        },
        {
            "id": "mastered-50",
            "title": "Reach 50 mastered words",
            "target": 50,
            "progress": mastered.count or 0,
            "reward_xp": 80,
        },
    ]

    return quests


@router.get("/leaderboard")
async def get_leaderboard(jwt: dict = Depends(verify_supabase_jwt)):
    """Return a lightweight leaderboard based on streak + mastery + reviews."""
    sb = get_supabase()

    profiles = (
        sb.table("profiles")
        .select("id, display_name, streak_days")
        .order("created_at")
        .limit(100)
        .execute()
    )

    rows = []
    for p in profiles.data or []:
        user_id = p["id"]
        mastered = (
            sb.table("user_reviews")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .gte("mastery_level", 4)
            .execute()
        )
        reviews = (
            sb.table("daily_goals")
            .select("actual_reviews")
            .eq("user_id", user_id)
            .order("goal_date", desc=True)
            .limit(30)
            .execute()
        )
        total_reviews = sum((d.get("actual_reviews", 0) or 0) for d in (reviews.data or []))
        score = (mastered.count or 0) * 10 + total_reviews * 2 + (p.get("streak_days", 0) or 0) * 3
        rows.append(
            {
                "user_id": user_id,
                "display_name": p.get("display_name") or "Learner",
                "streak_days": p.get("streak_days", 0) or 0,
                "mastered_words": mastered.count or 0,
                "reviews_30d": total_reviews,
                "score": score,
            }
        )

    rows.sort(key=lambda x: x["score"], reverse=True)
    return rows[:20]


@router.get("/study-plan")
async def get_personalized_study_plan(jwt: dict = Depends(verify_supabase_jwt)):
    """Build a personalized daily plan from weak + due + recent progress."""
    sb = get_supabase()
    profile = await _resolve_profile(sb, jwt)
    user_id = profile["id"]

    due_cards = (
        sb.table("user_reviews")
        .select("next_review_at, vocabulary(word, pinyin, meaning_en)")
        .eq("user_id", user_id)
        .order("next_review_at")
        .limit(5)
        .execute()
    )
    weak_cards = (
        sb.table("user_reviews")
        .select("average_quality, vocabulary(word, pinyin, meaning_en)")
        .eq("user_id", user_id)
        .lt("average_quality", 3)
        .gte("review_count", 3)
        .order("average_quality")
        .limit(5)
        .execute()
    )

    focus_words = []
    for row in weak_cards.data or []:
        v = row.get("vocabulary")
        if v:
            focus_words.append(
                {
                    "word": v.get("word"),
                    "pinyin": v.get("pinyin"),
                    "meaning": v.get("meaning_en"),
                    "reason": "weak",
                }
            )

    if len(focus_words) < 5:
        for row in due_cards.data or []:
            v = row.get("vocabulary")
            if not v:
                continue
            already = any(w["word"] == v.get("word") for w in focus_words)
            if already:
                continue
            focus_words.append(
                {
                    "word": v.get("word"),
                    "pinyin": v.get("pinyin"),
                    "meaning": v.get("meaning_en"),
                    "reason": "due",
                }
            )
            if len(focus_words) >= 5:
                break

    daily_goal = profile.get("daily_goal_words", 5) or 5
    streak = profile.get("streak_days", 0) or 0

    missions = [
        {
            "id": "review-core",
            "title": "Core Review Sprint",
            "description": "Finish your due cards first for retention.",
            "target": max(10, daily_goal * 2),
            "metric": "reviews",
        },
        {
            "id": "tone-focus",
            "title": "Tone Focus Drill",
            "description": "Repeat 5 weak words out loud with tones.",
            "target": 5,
            "metric": "pronunciation",
        },
        {
            "id": "chat-mission",
            "title": "Conversation Mission",
            "description": "Send at least 6 Mandarin chat messages tonight.",
            "target": 6,
            "metric": "messages",
        },
    ]

    return {
        "streak_days": streak,
        "daily_goal_words": daily_goal,
        "focus_words": focus_words,
        "missions": missions,
    }


@router.get("/subscription/plans")
async def get_subscription_plans():
    return SUBSCRIPTION_PLANS


@router.get("/subscription/status")
async def get_subscription_status(jwt: dict = Depends(verify_supabase_jwt)):
    sb = get_supabase()
    profile = await _resolve_profile(sb, jwt)
    tier = profile.get("subscription_tier", "free")
    return {
        "tier": tier,
        "is_active": tier != "free",
    }


async def _resolve_profile(sb, jwt: dict) -> dict:
    uid = jwt.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Cannot identify user")

    profile = (
        sb.table("profiles")
        .select("*")
        .eq("supabase_auth_id", uid)
        .limit(1)
        .execute()
    )
    if profile.data:
        return profile.data[0]

    created = (
        sb.table("profiles")
        .insert(
            {
                "supabase_auth_id": uid,
                "display_name": (jwt.get("email") or "learner").split("@")[0],
            }
        )
        .execute()
    )
    if not created.data:
        raise HTTPException(status_code=500, detail="Failed to bootstrap profile")
    return created.data[0]
