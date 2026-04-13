from fastapi import APIRouter, Depends, HTTPException

from db.supabase_client import get_supabase
from middleware.auth import verify_supabase_jwt
from models.schemas import LinkTelegramRequest

router = APIRouter()


@router.post("/link-telegram")
async def link_telegram(
    body: LinkTelegramRequest,
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Link current web profile with Telegram/OpenClaw ID."""
    sb = get_supabase()
    auth_id = jwt.get("sub")
    if not auth_id:
        raise HTTPException(status_code=401, detail="Cannot identify user")

    profile = (
        sb.table("profiles")
        .select("id")
        .eq("supabase_auth_id", auth_id)
        .limit(1)
        .execute()
    )
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile_id = profile.data[0]["id"]

    existing_tg = (
        sb.table("profiles")
        .select("id")
        .eq("telegram_id", body.telegram_id)
        .limit(1)
        .execute()
    )
    if existing_tg.data and existing_tg.data[0]["id"] != profile_id:
        raise HTTPException(
            status_code=409,
            detail="Telegram ID already linked to another profile",
        )

    updated = (
        sb.table("profiles")
        .update({"telegram_id": body.telegram_id})
        .eq("id", profile_id)
        .execute()
    )

    return {
        "status": "ok",
        "profile_id": profile_id,
        "telegram_id": body.telegram_id,
        "updated": bool(updated.data),
    }
