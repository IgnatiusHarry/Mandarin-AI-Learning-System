from fastapi import APIRouter, Depends, HTTPException, Query
from uuid import UUID
from datetime import datetime, timezone

from db.supabase_client import get_supabase
from middleware.auth import verify_supabase_jwt
from models.schemas import ConversationStartRequest, ConversationMessageRequest
from services.ai_processor import chat_response

router = APIRouter()


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
        .single()
        .execute()
    )
    if not convo_result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    convo = convo_result.data

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

    # Get AI response
    reply, corrections, new_vocab = await chat_response(
        conversation_id=str(body.conversation_id),
        user_message=body.content,
        history=history,
        known_words=known_words,
        weak_words=weak_words,
        topic=convo.get("topic", "free conversation"),
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
            .single()
            .execute()
        )
        if not profile.data:
            raise HTTPException(status_code=404, detail="User not found")
        return profile.data["id"]
    uid = jwt.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Cannot identify user")
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
