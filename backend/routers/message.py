from fastapi import APIRouter, Depends
from models.schemas import MessageRequest, MessageResponse
from middleware.auth import verify_openclaw_secret
from services.command_handler import handle_message

router = APIRouter()


@router.post("/message", response_model=MessageResponse, dependencies=[Depends(verify_openclaw_secret)])
async def receive_message(body: MessageRequest) -> MessageResponse:
    """
    Entry point for OpenClaw agent routing.
    OpenClaw posts: { telegram_id, text, message_type }
    Returns: { reply_text, parse_mode }
    """
    reply = await handle_message(body.telegram_id, body.text)
    return MessageResponse(reply_text=reply)
