import re
from uuid import UUID
from db.supabase_client import get_supabase
from services.ai_processor import extract_vocab
from services.srs import get_initial_review


# ── helpers ──────────────────────────────────────────────────────────


def _is_chinese(text: str) -> bool:
    """Return True if the text contains Chinese characters."""
    return bool(re.search(r"[\u4e00-\u9fff\u3400-\u4dbf]", text))


async def get_or_create_profile(telegram_id: int, supabase_auth_id: str | None = None) -> dict:
    """Fetch profile by telegram_id or link it to an existing web profile."""
    sb = get_supabase()
    result = (
        sb.table("profiles").select("*").eq("telegram_id", telegram_id).limit(1).execute()
    )
    if result.data:
        profile = result.data[0]
        # Link Telegram-first profile to web auth ID once available.
        if supabase_auth_id and not profile.get("supabase_auth_id"):
            updated = (
                sb.table("profiles")
                .update({"supabase_auth_id": supabase_auth_id})
                .eq("id", profile["id"])
                .execute()
            )
            if updated.data:
                return updated.data[0]
        return profile

    # If OpenClaw can provide web auth ID, reuse the same profile to keep data unified.
    if supabase_auth_id:
        web_profile = (
            sb.table("profiles")
            .select("*")
            .eq("supabase_auth_id", supabase_auth_id)
            .limit(1)
            .execute()
        )
        if web_profile.data:
            linked = (
                sb.table("profiles")
                .update({"telegram_id": telegram_id})
                .eq("id", web_profile.data[0]["id"])
                .execute()
            )
            if linked.data:
                return linked.data[0]
            return web_profile.data[0]

    new_profile = (
        sb.table("profiles")
        .insert({"telegram_id": telegram_id, "supabase_auth_id": supabase_auth_id})
        .execute()
    )
    return new_profile.data[0]


async def handle_message(telegram_id: int, text: str, supabase_auth_id: str | None = None) -> str:
    """
    Route incoming text to the correct handler.
    Returns a Markdown-formatted reply string.
    """
    profile = await get_or_create_profile(telegram_id, supabase_auth_id=supabase_auth_id)
    user_id = profile["id"]
    text = text.strip()

    if text.startswith("/"):
        return await handle_command(user_id, telegram_id, text)
    elif _is_chinese(text):
        return await handle_vocab_extraction(user_id, text)
    else:
        return (
            "請貼上中文文字讓我幫你提取生詞，或使用以下指令：\n\n"
            "/review — 開始複習\n"
            "/stats — 查看今日進度\n"
            "/add 詞 pīnyīn meaning — 手動新增\n"
            "/weak — 查看弱點單字\n"
            "/chat [主題] — 開始對話練習"
        )


async def handle_command(user_id: str, telegram_id: int, text: str) -> str:
    """Dispatch slash commands."""
    parts = text.split(maxsplit=1)
    cmd = parts[0].lower()
    args = parts[1] if len(parts) > 1 else ""

    if cmd == "/review":
        return await cmd_review(user_id)
    elif cmd == "/stats":
        return await cmd_stats(user_id)
    elif cmd == "/add":
        return await cmd_add(user_id, args)
    elif cmd == "/weak":
        return await cmd_weak(user_id)
    elif cmd == "/chat":
        return await cmd_chat(user_id, args)
    elif cmd == "/start" or cmd == "/help":
        return (
            "👋 你好！我是 *明老師*，你的普通話學習助手！\n\n"
            "📌 *使用方法：*\n"
            "• 貼上任何中文文字 → 自動提取生詞\n"
            "• /review — 今日複習卡片\n"
            "• /stats — 今日學習進度\n"
            "• /add 學習 xué xí to study — 手動新增生詞\n"
            "• /weak — 查看需要加強的單字\n"
            "• /chat [主題] — 開始對話練習\n\n"
            "加油！💪"
        )
    else:
        return f"未知指令：`{cmd}`。輸入 /help 查看所有指令。"


async def handle_vocab_extraction(user_id: str, text: str) -> str:
    """Extract vocab from Chinese text, save to DB, return summary."""
    sb = get_supabase()

    try:
        vocab_items = await extract_vocab(text)
    except Exception as e:
        return f"❌ AI 提取失敗：{e}"

    if not vocab_items:
        return "🔍 沒有找到新的生詞。"

    saved, skipped = 0, 0
    reply_lines = ["✅ *提取到以下生詞：*\n"]

    for item in vocab_items:
        try:
            # Insert vocab (ignore conflict = already exists)
            vocab_result = (
                sb.table("vocabulary")
                .upsert(
                    {
                        "user_id": user_id,
                        **item.model_dump(exclude_none=True),
                        "source": "telegram",
                    },
                    on_conflict="user_id,word",
                    ignore_duplicates=True,
                )
                .execute()
            )

            if vocab_result.data:
                vocab_id = vocab_result.data[0]["id"]
                # Create initial SRS entry
                sb.table("user_reviews").upsert(
                    {"user_id": user_id, "vocabulary_id": vocab_id, **get_initial_review()},
                    on_conflict="user_id,vocabulary_id",
                    ignore_duplicates=True,
                ).execute()
                saved += 1

                tone_info = f"（{item.tone_numbers}聲）" if item.tone_numbers else ""
                reply_lines.append(
                    f"• *{item.word}* {item.pinyin} {tone_info}\n"
                    f"  {item.meaning_en}"
                    + (f" / {item.meaning_id}" if item.meaning_id else "")
                )
            else:
                skipped += 1

        except Exception:
            skipped += 1

    reply_lines.append(f"\n📚 新增 {saved} 個，跳過 {skipped} 個（已存在）")
    reply_lines.append("輸入 /review 開始複習！")
    return "\n".join(reply_lines)


async def cmd_review(user_id: str) -> str:
    """Fetch the first due card and prompt the user."""
    sb = get_supabase()
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    result = (
        sb.table("user_reviews")
        .select("*, vocabulary(*)")
        .eq("user_id", user_id)
        .lte("next_review_at", now)
        .order("next_review_at")
        .limit(1)
        .execute()
    )

    if not result.data:
        return "🎉 今天沒有需要複習的單字了！明天再來吧。"

    row = result.data[0]
    vocab = row["vocabulary"]
    due_count_result = (
        sb.table("user_reviews")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .lte("next_review_at", now)
        .execute()
    )
    total_due = due_count_result.count or 1

    # Start a review session
    session = (
        sb.table("review_sessions")
        .insert({"user_id": user_id, "source": "telegram", "is_active": True})
        .execute()
    )
    session_id = session.data[0]["id"] if session.data else "unknown"

    return (
        f"📚 *複習時間！* 今天還有 {total_due} 個單字需要複習。\n\n"
        f"━━━━━━━━━━━━━━━\n"
        f"*{vocab['word']}*\n"
        f"詞性：{vocab.get('part_of_speech', '—')}\n\n"
        f"例句：{vocab.get('example_sentence', '—')}\n"
        f"━━━━━━━━━━━━━━━\n\n"
        f"你知道這個字的意思嗎？\n"
        f"回覆：\n"
        f"1️⃣ 完全不記得　2️⃣ 模糊印象　3️⃣ 費力想起\n"
        f"4️⃣ 稍微猶豫　　5️⃣ 完全記得\n\n"
        f"_vocab\_id:{vocab['id']} session:{session_id}_"
    )


async def cmd_stats(user_id: str) -> str:
    """Return today's learning stats."""
    from datetime import datetime, timezone, date

    sb = get_supabase()
    today = date.today().isoformat()
    now = datetime.now(timezone.utc).isoformat()

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
    profile = sb.table("profiles").select("streak_days").eq("id", user_id).single().execute()
    streak = profile.data.get("streak_days", 0) if profile.data else 0

    return (
        f"📊 *今日學習進度*\n\n"
        f"📚 總單字數：{total.count or 0}\n"
        f"🏆 已掌握：{mastered.count or 0}\n"
        f"⚠️ 弱點單字：{weak.count or 0}\n"
        f"📋 待複習：{due.count or 0}\n"
        f"🔥 連續學習：{streak} 天"
    )


async def cmd_add(user_id: str, args: str) -> str:
    """/add 學習 xué xí to study [meaning_id]"""
    parts = args.strip().split(maxsplit=3)
    if len(parts) < 3:
        return (
            "❌ 格式錯誤。請使用：\n"
            "`/add 學習 xué xí to study`\n"
            "（詞語 拼音 英文意思）"
        )

    sb = get_supabase()
    word, pinyin, meaning_en = parts[0], parts[1] + (" " + parts[2] if len(parts) > 3 else ""), parts[-1]

    try:
        result = (
            sb.table("vocabulary")
            .upsert(
                {
                    "user_id": user_id,
                    "word": word,
                    "pinyin": pinyin,
                    "meaning_en": meaning_en,
                    "source": "manual",
                },
                on_conflict="user_id,word",
                ignore_duplicates=True,
            )
            .execute()
        )
        if result.data:
            from services.srs import get_initial_review
            sb.table("user_reviews").upsert(
                {"user_id": user_id, "vocabulary_id": result.data[0]["id"], **get_initial_review()},
                on_conflict="user_id,vocabulary_id",
                ignore_duplicates=True,
            ).execute()
            return f"✅ *{word}* （{pinyin}）已新增！\n明天會加入複習。"
        else:
            return f"ℹ️ *{word}* 已經在你的單字庫裡了。"
    except Exception as e:
        return f"❌ 新增失敗：{e}"


async def cmd_weak(user_id: str) -> str:
    """Show top weak words."""
    sb = get_supabase()
    result = (
        sb.table("user_reviews")
        .select("average_quality, review_count, mastery_level, vocabulary(word, pinyin, meaning_en)")
        .eq("user_id", user_id)
        .lt("average_quality", 3)
        .gte("review_count", 3)
        .order("average_quality")
        .limit(10)
        .execute()
    )

    if not result.data:
        return "✨ 目前沒有弱點單字！繼續保持！"

    lines = ["⚠️ *需要加強的單字：*\n"]
    for row in result.data:
        v = row["vocabulary"]
        score = row["average_quality"]
        lines.append(
            f"• *{v['word']}* {v['pinyin']} — {v['meaning_en']}\n"
            f"  平均分：{score:.1f}/5 （複習 {row['review_count']} 次）"
        )
    return "\n".join(lines)


async def cmd_chat(user_id: str, args: str) -> str:
    """Start an AI conversation session."""
    topic = args.strip() or "free conversation"
    sb = get_supabase()

    convo = (
        sb.table("conversations")
        .insert({"user_id": user_id, "topic": topic, "source": "telegram"})
        .execute()
    )
    if not convo.data:
        return "❌ 無法開始對話，請稍後再試。"

    convo_id = convo.data[0]["id"]

    return (
        f"💬 *對話練習開始！* 主題：{topic}\n\n"
        f"你好！我是小明，你的普通話練習夥伴 😊\n"
        f"今天想聊什麼呢？\n\n"
        f"_convo\_id:{convo_id}_\n"
        f"（輸入 /end 結束對話）"
    )
