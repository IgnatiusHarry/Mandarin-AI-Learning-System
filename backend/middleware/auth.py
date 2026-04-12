from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import get_settings
import jwt

security = HTTPBearer(auto_error=False)


async def verify_openclaw_secret(request: Request) -> None:
    """Verify X-API-Key header matches OPENCLAW_API_SECRET."""
    settings = get_settings()
    api_key = request.headers.get("X-API-Key")
    if not api_key or api_key != settings.openclaw_api_secret:
        raise HTTPException(status_code=401, detail="Invalid API key")


async def verify_cron_secret(request: Request) -> None:
    """Verify X-Cron-Secret header matches CRON_SECRET."""
    settings = get_settings()
    cron_secret = request.headers.get("X-Cron-Secret")
    if not cron_secret or cron_secret != settings.cron_secret:
        raise HTTPException(status_code=401, detail="Invalid cron secret")


async def verify_supabase_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Verify Supabase Auth JWT from web app. Returns decoded payload."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing authorization")

    settings = get_settings()
    token = credentials.credentials

    try:
        # Supabase JWTs are signed with the JWT secret (anon key is the public key)
        # For verification, we use the JWT secret from Supabase project settings
        payload = jwt.decode(
            token,
            settings.supabase_anon_key,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
