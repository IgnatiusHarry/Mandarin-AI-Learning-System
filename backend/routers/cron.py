from fastapi import APIRouter, Depends
from datetime import date, datetime, timezone

from db.supabase_client import get_supabase
from middleware.auth import verify_cron_secret
from services.telegram_sender import send_message

router = APIRouter()

MILESTONES = [10, 50, 100, 250, 500]


@router.post("/morning-briefing", dependencies=[Depends(verify_cron_secret)])
async def morning_briefing():
    """Send morning study reminders to all active users."""
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    users = sb.table("profiles").select("id, telegram_id, streak_days").execute()

    sent, failed = 0, 0
    for user in (users.data or []):
        if not user.get("telegram_id"):
            continue

        due = (
            sb.table("user_reviews")
            .select("id", count="exact")
            .eq("user_id", user["id"])
            .lte("next_review_at", now)
            .execute()
        )
        due_count = due.count or 0
        streak = user.get("streak_days", 0)

        msg = (
            f"🌅 *早安！今天的學習計劃*\n\n"
            f"📚 待複習單字：*{due_count}* 個\n"
            f"🔥 連續學習：*{streak}* 天\n\n"
        )
        if due_count > 0:
            msg += "輸入 /review 開始複習！💪"
        else:
            msg += "今天沒有複習任務，可以學新單字或 /chat 練習對話！"

        ok = await send_message(user["telegram_id"], msg)
        if ok:
            sent += 1
        else:
            failed += 1

    return {"sent": sent, "failed": failed}


@router.post("/evening-summary", dependencies=[Depends(verify_cron_secret)])
async def evening_summary():
    """Send evening summary and update streaks."""
    sb = get_supabase()
    today = date.today().isoformat()

    users = sb.table("profiles").select("id, telegram_id, streak_days, last_active_date").execute()

    sent, failed = 0, 0
    for user in (users.data or []):
        if not user.get("telegram_id"):
            continue

        daily = (
            sb.table("daily_goals")
            .select("actual_new_words, actual_reviews")
            .eq("user_id", user["id"])
            .eq("goal_date", today)
            .single()
            .execute()
        )

        reviewed_today = daily.data.get("actual_reviews", 0) if daily.data else 0
        new_words_today = daily.data.get("actual_new_words", 0) if daily.data else 0

        # Update streak
        new_streak = user.get("streak_days", 0)
        if reviewed_today > 0:
            if user.get("last_active_date") != today:
                new_streak += 1
        else:
            new_streak = 0

        sb.table("profiles").update(
            {"streak_days": new_streak, "last_active_date": today}
        ).eq("id", user["id"]).execute()
        sb.table("daily_goals").upsert(
            {"user_id": user["id"], "goal_date": today, "streak_maintained": reviewed_today > 0},
            on_conflict="user_id,goal_date",
        ).execute()

        # Build summary message
        total_vocab = (
            sb.table("vocabulary").select("id", count="exact").eq("user_id", user["id"]).execute()
        )
        total = total_vocab.count or 0

        mastered = (
            sb.table("user_reviews")
            .select("id", count="exact")
            .eq("user_id", user["id"])
            .gte("mastery_level", 4)
            .execute()
        )
        mastered_count = mastered.count or 0

        msg = (
            f"🌙 *今日學習總結*\n\n"
            f"📖 新學單字：{new_words_today} 個\n"
            f"✅ 複習次數：{reviewed_today} 次\n"
            f"🏆 已掌握：{mastered_count} 個\n"
            f"🔥 連續學習：{new_streak} 天\n"
        )

        # Check milestones
        for milestone in MILESTONES:
            if mastered_count >= milestone and (mastered_count - reviewed_today) < milestone:
                msg += f"\n🎉 *恭喜！你已掌握 {milestone} 個單字！*"
                break

        if reviewed_today == 0:
            msg += "\n\n💡 今天還沒有複習，明天記得繼續加油！"
        else:
            msg += "\n\n很棒！明天繼續保持 💪"

        ok = await send_message(user["telegram_id"], msg)
        if ok:
            sent += 1
        else:
            failed += 1

    return {"sent": sent, "failed": failed}
