from fastapi import APIRouter, Depends, HTTPException, Query
from uuid import UUID
from db.supabase_client import get_supabase
from middleware.auth import verify_openclaw_secret, verify_supabase_jwt
from models.schemas import VocabItem

router = APIRouter()


@router.get("")
async def list_vocab(
    user_id: UUID | None = Query(default=None),
    jwt: dict = Depends(verify_supabase_jwt),
):
    """List all vocabulary for a user (web)."""
    sb = get_supabase()
    uid = str(user_id) if user_id else jwt.get("sub")
    if not uid:
        raise HTTPException(status_code=400, detail="user_id required")

    result = (
        sb.table("vocabulary")
        .select("*, user_reviews(mastery_level, review_count, average_quality, next_review_at)")
        .eq("user_id", uid)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.get("/{vocab_id}")
async def get_vocab(
    vocab_id: UUID,
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Get a single vocabulary item."""
    sb = get_supabase()
    result = (
        sb.table("vocabulary")
        .select("*, user_reviews(*)")
        .eq("id", str(vocab_id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Vocabulary not found")
    return result.data


@router.delete("/{vocab_id}", status_code=204)
async def delete_vocab(
    vocab_id: UUID,
    jwt: dict = Depends(verify_supabase_jwt),
):
    """Delete a vocabulary item and its review data."""
    sb = get_supabase()
    sb.table("vocabulary").delete().eq("id", str(vocab_id)).execute()
