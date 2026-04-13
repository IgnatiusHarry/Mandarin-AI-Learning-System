from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from config import get_settings
from services.cron_jobs import run_evening_summary, run_morning_briefing

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> None:
    global _scheduler
    settings = get_settings()

    if _scheduler is not None and _scheduler.running:
        return

    _scheduler = AsyncIOScheduler(timezone=settings.cron_timezone)
    _scheduler.add_job(
        run_morning_briefing,
        CronTrigger(hour=settings.cron_morning_hour, minute=0),
        id="morning-briefing",
        replace_existing=True,
    )
    _scheduler.add_job(
        run_evening_summary,
        CronTrigger(hour=settings.cron_evening_hour, minute=0),
        id="evening-summary",
        replace_existing=True,
    )
    _scheduler.start()


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
    _scheduler = None
