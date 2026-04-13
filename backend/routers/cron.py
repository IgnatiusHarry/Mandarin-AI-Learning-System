from fastapi import APIRouter, Depends

from middleware.auth import verify_cron_secret
from services.cron_jobs import run_evening_summary, run_morning_briefing

router = APIRouter()


@router.post("/morning-briefing", dependencies=[Depends(verify_cron_secret)])
async def morning_briefing():
    """Send morning study reminders to all active users."""
    return await run_morning_briefing()


@router.post("/evening-summary", dependencies=[Depends(verify_cron_secret)])
async def evening_summary():
    """Send evening summary and update streaks."""
    return await run_evening_summary()
