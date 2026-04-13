from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import get_settings
import httpx

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
        # Validate token directly against Supabase Auth API.
        # This avoids brittle local JWT verification assumptions.
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={
                    "apikey": settings.supabase_anon_key,
                    "Authorization": f"Bearer {token}",
                },
            )

        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        user = response.json()
        if not user or not user.get("id"):
            raise HTTPException(status_code=401, detail="Invalid user payload")

        return {
            "sub": user["id"],
            "email": user.get("email"),
            "aud": user.get("aud"),
            "role": user.get("role"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {e}")
