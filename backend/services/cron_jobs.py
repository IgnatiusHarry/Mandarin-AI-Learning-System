from datetime import date, datetime, timezone

from db.supabase_client import get_supabase
from services.telegram_sender import send_message

MILESTONES = [10, 50, 100, 250, 500]


async def run_morning_briefing() -> dict:
    """Send 9 AM reminder to active Telegram users."""
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    users = sb.table("profiles").select("id, telegram_id, streak_days").execute()

    sent, failed = 0, 0
    for user in (users.data or []):
        telegram_id = user.get("telegram_id")
        if not telegram_id:
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
            f"📚 {due_count} kata perlu direview hari ini!\n"
            f"🔥 Streak: {streak} hari\n\n"
            "Ketik /review untuk mulai flashcard."
        )

        ok = await send_message(telegram_id, msg)
        if ok:
            sent += 1
        else:
            failed += 1

    return {"sent": sent, "failed": failed}


async def run_evening_summary() -> dict:
    """Send nightly summary and maintain streak status."""
    sb = get_supabase()
    today = date.today().isoformat()

    users = (
        sb.table("profiles")
        .select("id, telegram_id, streak_days, last_active_date")
        .execute()
    )

    sent, failed = 0, 0
    for user in (users.data or []):
        telegram_id = user.get("telegram_id")
        if not telegram_id:
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
            {
                "user_id": user["id"],
                "goal_date": today,
                "streak_maintained": reviewed_today > 0,
            },
            on_conflict="user_id,goal_date",
        ).execute()

        total_vocab = (
            sb.table("vocabulary")
            .select("id", count="exact")
            .eq("user_id", user["id"])
            .execute()
        )
        total_words = total_vocab.count or 0

        mastered = (
            sb.table("user_reviews")
            .select("id", count="exact")
            .eq("user_id", user["id"])
            .gte("mastery_level", 4)
            .execute()
        )
        mastered_count = mastered.count or 0

        msg = (
            "🌙 Ringkasan belajar hari ini\n\n"
            f"📖 Kata baru: {new_words_today}\n"
            f"✅ Review selesai: {reviewed_today}\n"
            f"🏆 Mastered: {mastered_count} dari {total_words}\n"
            f"🔥 Streak: {new_streak} hari"
        )

        for milestone in MILESTONES:
            if mastered_count >= milestone and (mastered_count - reviewed_today) < milestone:
                msg += f"\n\n🎉 Milestone tercapai: {milestone} kata mastered!"
                break

        if reviewed_today == 0:
            msg += "\n\nBesok lanjut lagi ya."

        ok = await send_message(telegram_id, msg)
        if ok:
            sent += 1
        else:
            failed += 1

    return {"sent": sent, "failed": failed}
