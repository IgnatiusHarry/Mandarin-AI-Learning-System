from fastapi import APIRouter, Depends
from models.schemas import MessageRequest, MessageResponse
from middleware.auth import verify_openclaw_secret
from services.command_handler import handle_message

router = APIRouter()


@router.post("/message", response_model=MessageResponse, dependencies=[Depends(verify_openclaw_secret)])
async def receive_message(body: MessageRequest) -> MessageResponse:
    """
    Entry point for OpenClaw agent routing.
    OpenClaw posts: { telegram_id, text, message_type, supabase_auth_id? }
    Returns: { reply_text, parse_mode }
    """
    auth_id = str(body.supabase_auth_id) if body.supabase_auth_id else None
    reply = await handle_message(body.telegram_id, body.text, supabase_auth_id=auth_id)
    return MessageResponse(reply_text=reply)
