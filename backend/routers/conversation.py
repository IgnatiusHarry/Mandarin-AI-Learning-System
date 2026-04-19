from fastapi import APIRouter, Depends, HTTPException, Query
from uuid import UUID
from datetime import datetime, timezone
import re

from db.supabase_client import get_supabase
from middleware.auth import verify_supabase_jwt
from models.schemas import ConversationStartRequest, ConversationMessageRequest
from services.ai_processor import chat_response, LESSON_VOCAB

router = APIRouter()


def _detect_lesson_tag(topic: str) -> str | None:
    """Detect if the topic corresponds to a known lesson."""
    if topic in LESSON_VOCAB:
        return topic

    match = re.search(r"第\s*(\d+)\s*課", topic)
    if match:
        candidate = f"時代華語-{int(match.group(1))}"
        if candidate in LESSON_VOCAB:
            return candidate

    if "時代華語-10" in topic:
        return "時代華語-10"

    return None


def _detect_lesson_mode(topic: str) -> str:
    lowered = topic.lower()
    if "vocabulary" in lowered or "詞彙" in topic:
        return "vocabulary"
    if "grammar" in lowered or "文法" in topic:
        return "grammar"
    if "quiz" in lowered or "soal" in lowered or "問題" in topic:
        return "quiz"
    return "mixed"


@router.post("/start")
async def start_conversation(
    body: ConversationStartRequest,
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Start a new conversation session."""
    sb = get_supabase()
    user_id = await _resolve_user_id(sb, body.telegram_id, jwt)

    result = (
        sb.table("conversations")
        .insert(
            {
                "user_id": user_id,
                "topic": body.topic or "free conversation",
                "source": body.source,
            }
        )
        .execute()
    )
    return result.data[0]


@router.post("/message")
async def send_message(
    body: ConversationMessageRequest,
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Send a message and get an AI response."""
    sb = get_supabase()
    user_id = await _resolve_user_id(sb, body.telegram_id, jwt)

    # Fetch conversation
    convo_result = (
        sb.table("conversations")
        .select("*")
        .eq("id", str(body.conversation_id))
        .limit(1)
        .execute()
    )
    if not convo_result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    convo = convo_result.data[0]

    profile_result = (
        sb.table("profiles")
        .select("display_name, hsk_level, native_language")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    profile = profile_result.data[0] if profile_result.data else {}
    user_level = profile.get("hsk_level") or 3
    native_language = profile.get("native_language") or "Indonesian"

    # Fetch message history (last 20)
    history_result = (
        sb.table("conversation_messages")
        .select("role, content")
        .eq("conversation_id", str(body.conversation_id))
        .order("created_at")
        .limit(20)
        .execute()
    )
    history = [{"role": m["role"], "content": m["content"]} for m in (history_result.data or [])]

    # Get known words and weak words for context
    known = (
        sb.table("vocabulary")
        .select("word")
        .eq("user_id", user_id)
        .limit(100)
        .execute()
    )
    known_words = [r["word"] for r in (known.data or [])]

    weak = (
        sb.table("user_reviews")
        .select("vocabulary(word)")
        .eq("user_id", user_id)
        .lt("average_quality", 3)
        .gte("review_count", 3)
        .limit(20)
        .execute()
    )
    weak_words = [r["vocabulary"]["word"] for r in (weak.data or []) if r.get("vocabulary")]

    # Detect lesson focus and load chapter vocab from user's deck
    convo_topic = convo.get("topic", "")
    lesson_tag = _detect_lesson_tag(convo_topic)
    lesson_mode = _detect_lesson_mode(convo_topic) if lesson_tag else None
    lesson_vocab: list[dict] = []
    if lesson_tag:
        word_list = LESSON_VOCAB.get(lesson_tag, [])
        if word_list:
            lesson_result = (
                sb.table("vocabulary")
                .select("word,pinyin,meaning_en,meaning_id,hsk_level")
                .eq("user_id", user_id)
                .in_("word", word_list)
                .execute()
            )
            lesson_vocab = [
                row
                for row in (lesson_result.data or [])
                if row.get("hsk_level") is None or row.get("hsk_level") <= user_level + 1
            ]

    # Get AI response
    reply, corrections, new_vocab = await chat_response(
        conversation_id=str(body.conversation_id),
        user_message=body.content,
        history=history,
        known_words=known_words,
        weak_words=weak_words,
        topic=convo_topic or "free conversation",
        lesson_tag=lesson_tag,
        lesson_vocab=lesson_vocab,
        lesson_mode=lesson_mode,
        user_level=user_level,
        native_language=native_language,
    )

    # Save user message
    now = datetime.now(timezone.utc).isoformat()
    sb.table("conversation_messages").insert(
        {"conversation_id": str(body.conversation_id), "role": "user", "content": body.content}
    ).execute()

    # Save AI reply
    sb.table("conversation_messages").insert(
        {
            "conversation_id": str(body.conversation_id),
            "role": "assistant",
            "content": reply,
            "corrections": corrections if corrections else None,
            "vocab_introduced": new_vocab if new_vocab else None,
        }
    ).execute()

    # Update message count
    sb.table("conversations").update(
        {"message_count": convo.get("message_count", 0) + 2}
    ).eq("id", str(body.conversation_id)).execute()

    return {
        "reply": reply,
        "corrections": corrections,
        "new_vocab": new_vocab,
    }


@router.get("/history")
async def get_history(
    conversation_id: UUID = Query(...),
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Get full message history for a conversation."""
    sb = get_supabase()
    result = (
        sb.table("conversation_messages")
        .select("*")
        .eq("conversation_id", str(conversation_id))
        .order("created_at")
        .execute()
    )
    return result.data


@router.get("")
async def list_conversations(
    jwt: dict = Depends(verify_supabase_jwt),
):
    """List all conversations for the current user."""
    sb = get_supabase()
    user_id = await _resolve_user_id(sb, None, jwt)
    result = (
        sb.table("conversations")
        .select("id, topic, source, started_at, message_count")
        .eq("user_id", user_id)
        .order("started_at", desc=True)
        .limit(20)
        .execute()
    )
    return result.data


@router.post("/end")
async def end_conversation(
    conversation_id: UUID,
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Mark a conversation as ended."""
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    sb.table("conversations").update({"ended_at": now}).eq(
        "id", str(conversation_id)
    ).execute()
    return {"status": "ok"}


# ── helpers ──────────────────────────────────────────────────────────

async def _resolve_user_id(sb, telegram_id: int | None, jwt: dict) -> str:
    if telegram_id:
        profile = (
            sb.table("profiles")
            .select("id")
            .eq("telegram_id", telegram_id)
            .limit(1)
            .execute()
        )
        if not profile.data:
            raise HTTPException(status_code=404, detail="User not found")
        return profile.data[0]["id"]
    uid = jwt.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Cannot identify user")
    profile = (
        sb.table("profiles")
        .select("id")
        .eq("supabase_auth_id", uid)
        .limit(1)
        .execute()
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
